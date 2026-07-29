-- =====================================================================
-- Gestão do catálogo de cadeias — permite ao Gerente adicionar ou
-- desativar cadeias (situação rara, mas prevista). Nunca se apaga uma
-- cadeia com histórico: desativa-se (ativo=false), preservando as
-- linhas antigas em cadeias_diarias intactas para auditoria.
-- =====================================================================

alter table cadeias_catalogo add column if not exists ativo boolean not null default true;

-- Uma cadeia removida das dependências do GIR_FL não deve impedir que
-- o catálogo seja limpo por SQL direto no futuro (a app nunca apaga
-- uma cadeia com histórico, mas isto protege o caso de manutenção
-- manual da base).
alter table gir_fl_dependencias drop constraint if exists gir_fl_dependencias_nome_cadeia_fkey;
alter table gir_fl_dependencias
    add constraint gir_fl_dependencias_nome_cadeia_fkey
    foreign key (nome_cadeia) references cadeias_catalogo(nome_cadeia) on delete cascade;

-- ---------------------------------------------------------------------
-- Escrita no catálogo e nas dependências do GIR_FL: só Gerente/delegado.
-- ---------------------------------------------------------------------
create policy cadeias_catalogo_write_gerente on cadeias_catalogo
    for all to authenticated using (is_gerente_ou_delegado()) with check (is_gerente_ou_delegado());

create policy gir_fl_dependencias_write_gerente on gir_fl_dependencias
    for all to authenticated using (is_gerente_ou_delegado()) with check (is_gerente_ou_delegado());

-- Impede apagar (DELETE) uma cadeia do catálogo que já tenha histórico
-- em cadeias_diarias — força o uso de "desativar" (ativo=false) em vez
-- de remoção definitiva, preservando a auditoria.
create or replace function trg_impede_apagar_cadeia_com_historico() returns trigger as $$
begin
    if exists (select 1 from cadeias_diarias where nome_cadeia = old.nome_cadeia) then
        raise exception 'Esta cadeia já tem histórico registado — desative-a (ativo=false) em vez de a apagar.';
    end if;
    return old;
end;
$$ language plpgsql;

create trigger trg_cadeias_catalogo_protege_historico
before delete on cadeias_catalogo
for each row execute function trg_impede_apagar_cadeia_com_historico();
