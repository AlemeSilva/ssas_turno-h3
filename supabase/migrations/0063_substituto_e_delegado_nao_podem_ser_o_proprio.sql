-- =====================================================================
-- Um substituto de férias não pode ser a própria pessoa ausente; um
-- delegado de aprovação não pode ser o próprio titular.
--
-- Achado do stress-test de documentação (2026-09-28): as duas regras já
-- existiam, mas só no filtro do ecrã (InicioPage.tsx, PainelDelegacao)
-- — nenhuma constraint nem trigger as impunha na base, contra o
-- princípio PER-01 ("a base decide; o ecrã só esconde"). Confirmado por
-- consulta direta: zero linhas hoje violam qualquer uma das duas.
-- =====================================================================

create or replace function trg_valida_ferias_semanas() returns trigger as $$
begin
    if new.substituto_id is not null
       and new.substituto_id = (select f.usuario_id from ferias f where f.id = new.ferias_id)
    then
        raise exception 'O substituto de uma semana de férias/licença não pode ser a própria pessoa ausente.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trg_ferias_semanas_valida
    before insert or update on ferias_semanas
    for each row execute function trg_valida_ferias_semanas();

alter table delegacoes_aprovacao
    add constraint chk_delegacao_substituto_diferente check (substituto <> gerente_titular);
