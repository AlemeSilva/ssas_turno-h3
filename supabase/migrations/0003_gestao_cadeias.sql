-- =====================================================================
-- Gestão do catálogo de cadeias — permite ao Gerente adicionar ou
-- desativar cadeias. Nunca se apaga uma cadeia com histórico.
-- Migração idempotente.
-- =====================================================================

alter table cadeias_catalogo add column if not exists ativo boolean not null default true;

alter table gir_fl_dependencias drop constraint if exists gir_fl_dependencias_nome_cadeia_fkey;
alter table gir_fl_dependencias
    add constraint gir_fl_dependencias_nome_cadeia_fkey
    foreign key (nome_cadeia) references cadeias_catalogo(nome_cadeia) on delete cascade;

-- ---------------------------------------------------------------------
-- Escrita no catálogo: só Gerente/delegado
-- ---------------------------------------------------------------------
drop policy if exists cadeias_catalogo_write_gerente on cadeias_catalogo;
create policy cadeias_catalogo_write_gerente on cadeias_catalogo
    for all to authenticated using (is_gerente_ou_delegado()) with check (is_gerente_ou_delegado());

drop policy if exists gir_fl_dependencias_write_gerente on gir_fl_dependencias;
create policy gir_fl_dependencias_write_gerente on gir_fl_dependencias
    for all to authenticated using (is_gerente_ou_delegado()) with check (is_gerente_ou_delegado());

create or replace function trg_impede_apagar_cadeia_com_historico() returns trigger as $$
begin
    if exists (select 1 from cadeias_diarias where nome_cadeia = old.nome_cadeia) then
        raise exception 'Esta cadeia já tem histórico registado — desative-a (ativo=false) em vez de a apagar.';
    end if;
    return old;
end;
$$ language plpgsql;

create or replace trigger trg_cadeias_catalogo_protege_historico
before delete on cadeias_catalogo
for each row execute function trg_impede_apagar_cadeia_com_historico();
