-- =====================================================================
-- Uma troca de H3 só aceita como semana_ref o SÁBADO em que a semana
-- começa.
--
-- A escala é ao sábado: cada linha de escala_semanal cobre de sábado a
-- sexta, e o H3 dessa semana ativa-se às 22h da sexta anterior (critério
-- do Gerente, 2026-09-25; ver CRITERIOS_FUNCIONAIS.md). O formulário das
-- trocas pedia a "Quinta de referência" (o rótulo do plano de fim de
-- semana, que é outra coisa) e a base de dados aceitava qualquer data.
-- trg_aplica_troca_aprovada() age na data exata do semana_ref: com uma
-- quinta, não mexia em nenhuma semana real e ainda deixava na escala uma
-- linha solta nessa quinta (foi o que aconteceu com a troca #59, de
-- 2026-10-15 — a linha solta fez o aviso "H3 por atribuir" acusar uma
-- semana sem H3 que não existia).
--
-- A verificação junta-se às que já existiam (0054) e só vale para o que
-- muda daqui para a frente: um INSERT, uma alteração do semana_ref, ou a
-- aprovação de uma proposta. Uma troca antiga já APROVADA numa quinta
-- (a #59) continua editável e consultável; uma proposta antiga numa
-- quinta pode ser rejeitada mas já não aprovada.
-- =====================================================================

create or replace function trg_valida_troca() returns trigger as $$
begin
    if not exists (select 1 from usuarios where id = new.usuario_substituto and perfil = 'OPERADOR_H3' and ativo = true) then
        raise exception 'O substituto de uma troca de H3 tem de ter perfil OPERADOR_H3 e estar ativo.';
    end if;
    if not exists (select 1 from usuarios where id = new.usuario_proponente and ativo = true) then
        raise exception 'O proponente de uma troca de H3 tem de estar ativo.';
    end if;
    -- extract(dow): domingo = 0 … sábado = 6. Num INSERT o "old" é nulo,
    -- por isso só a primeira condição conta.
    if extract(dow from new.semana_ref) <> 6 and (
        tg_op = 'INSERT'
        or new.semana_ref is distinct from old.semana_ref
        or (new.status = 'APROVADA' and old.status is distinct from 'APROVADA')
    ) then
        raise exception 'A semana de uma troca de H3 começa ao sábado — escolhe o sábado dessa semana.';
    end if;
    return new;
end;
$$ language plpgsql;
