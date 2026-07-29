-- =====================================================================
-- Turno H3 — Row Level Security
-- =====================================================================
-- Migração idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY.
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY é sempre idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares (CREATE OR REPLACE — sempre idempotente)
-- ---------------------------------------------------------------------
create or replace function usuario_ativo(p_id uuid) returns boolean as $$
    select coalesce((select ativo from usuarios where id = p_id), false);
$$ language sql stable security definer;

create or replace function is_gerente_ou_delegado() returns boolean as $$
    select
        exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true)
        or exists (
            select 1 from delegacoes_aprovacao
             where substituto = auth.uid()
               and current_date between data_inicio and data_fim
        );
$$ language sql stable security definer;

create or replace function is_operador_do_ciclo(p_data_inicio_ciclo date) returns boolean as $$
    select auth.uid() = operador_do_ciclo(p_data_inicio_ciclo);
$$ language sql stable security definer;

create or replace function pode_editar_plano(p_id_plano bigint) returns boolean as $$
    select is_gerente_ou_delegado()
        or is_operador_do_ciclo((select data_inicio_ciclo from planos where id = p_id_plano));
$$ language sql stable security definer;

-- ---------------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------------
alter table usuarios enable row level security;

drop policy if exists usuarios_select_all on usuarios;
create policy usuarios_select_all on usuarios
    for select to authenticated using (true);

drop policy if exists usuarios_update_gerente on usuarios;
create policy usuarios_update_gerente on usuarios
    for update to authenticated using (is_gerente_ou_delegado());

drop policy if exists usuarios_insert_gerente on usuarios;
create policy usuarios_insert_gerente on usuarios
    for insert to authenticated with check (is_gerente_ou_delegado());

-- ---------------------------------------------------------------------
-- ESCALA SEMANAL
-- ---------------------------------------------------------------------
alter table escala_semanal enable row level security;

drop policy if exists escala_select_all on escala_semanal;
create policy escala_select_all on escala_semanal
    for select to authenticated using (true);

drop policy if exists escala_write_gerente on escala_semanal;
create policy escala_write_gerente on escala_semanal
    for all to authenticated using (is_gerente_ou_delegado()) with check (is_gerente_ou_delegado());

-- ---------------------------------------------------------------------
-- FÉRIAS
-- ---------------------------------------------------------------------
alter table ferias enable row level security;

drop policy if exists ferias_select_all on ferias;
create policy ferias_select_all on ferias
    for select to authenticated using (true);

drop policy if exists ferias_insert_propria on ferias;
create policy ferias_insert_propria on ferias
    for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists ferias_update on ferias;
create policy ferias_update on ferias
    for update to authenticated using (
        (usuario_id = auth.uid() and status = 'PENDENTE')
        or is_gerente_ou_delegado()
    );

-- ---------------------------------------------------------------------
-- TROCAS DE ESCALA
-- ---------------------------------------------------------------------
alter table trocas_escala enable row level security;

drop policy if exists trocas_select_all on trocas_escala;
create policy trocas_select_all on trocas_escala
    for select to authenticated using (true);

drop policy if exists trocas_insert on trocas_escala;
create policy trocas_insert on trocas_escala
    for insert to authenticated with check (
        usuario_proponente = auth.uid()
        and exists (select 1 from usuarios where id = auth.uid() and perfil = 'OPERADOR_H3' and ativo = true)
    );

drop policy if exists trocas_update_gerente on trocas_escala;
create policy trocas_update_gerente on trocas_escala
    for update to authenticated using (is_gerente_ou_delegado());

-- ---------------------------------------------------------------------
-- DELEGAÇÕES DE APROVAÇÃO
-- ---------------------------------------------------------------------
alter table delegacoes_aprovacao enable row level security;

drop policy if exists delegacoes_select_all on delegacoes_aprovacao;
create policy delegacoes_select_all on delegacoes_aprovacao
    for select to authenticated using (true);

drop policy if exists delegacoes_write_titular on delegacoes_aprovacao;
create policy delegacoes_write_titular on delegacoes_aprovacao
    for all to authenticated using (
        gerente_titular = auth.uid()
        and exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true)
    )
    with check (
        gerente_titular = auth.uid()
        and exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true)
    );

-- ---------------------------------------------------------------------
-- PLANOS
-- ---------------------------------------------------------------------
alter table planos enable row level security;

drop policy if exists planos_select_all on planos;
create policy planos_select_all on planos
    for select to authenticated using (true);

drop policy if exists planos_insert on planos;
create policy planos_insert on planos
    for insert to authenticated with check (
        is_gerente_ou_delegado() or is_operador_do_ciclo(data_inicio_ciclo)
    );

drop policy if exists planos_update on planos;
create policy planos_update on planos
    for update to authenticated using (pode_editar_plano(id));

-- ---------------------------------------------------------------------
-- TAREFAS DO PLANO
-- ---------------------------------------------------------------------
alter table tarefas_plano enable row level security;

drop policy if exists tarefas_select_all on tarefas_plano;
create policy tarefas_select_all on tarefas_plano
    for select to authenticated using (true);

drop policy if exists tarefas_write on tarefas_plano;
create policy tarefas_write on tarefas_plano
    for all to authenticated using (pode_editar_plano(id_plano)) with check (pode_editar_plano(id_plano));

create or replace function trg_tarefas_reabre_aprovacao() returns trigger as $$
declare
    v_plano planos%rowtype;
begin
    select * into v_plano from planos where id = coalesce(new.id_plano, old.id_plano);

    if v_plano.status in ('APROVADO', 'EM_EXECUCAO') and not is_gerente_ou_delegado() then
        update planos
           set status = 'PENDENTE_APROVACAO'
         where id = v_plano.id;

        insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
        values ('PLANO', v_plano.id, auth.uid(), 'REABERTURA_APROVACAO',
                'Alteração a tarefa após aprovação, formalmente pendente de nova aprovação do Gerente.');
    end if;
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger trg_tarefas_plano_reabre
after insert or update or delete on tarefas_plano
for each row execute function trg_tarefas_reabre_aprovacao();

-- ---------------------------------------------------------------------
-- CHECKLIST
-- ---------------------------------------------------------------------
alter table checklist_itens enable row level security;

drop policy if exists checklist_select_all on checklist_itens;
create policy checklist_select_all on checklist_itens
    for select to authenticated using (true);

drop policy if exists checklist_write on checklist_itens;
create policy checklist_write on checklist_itens
    for all to authenticated using (pode_editar_plano(id_plano)) with check (pode_editar_plano(id_plano));

-- ---------------------------------------------------------------------
-- CADEIAS DIÁRIAS
-- ---------------------------------------------------------------------
alter table cadeias_diarias enable row level security;

drop policy if exists cadeias_select_all on cadeias_diarias;
create policy cadeias_select_all on cadeias_diarias
    for select to authenticated using (true);

drop policy if exists cadeias_write on cadeias_diarias;
create policy cadeias_write on cadeias_diarias
    for all to authenticated using (pode_editar_plano(id_plano)) with check (pode_editar_plano(id_plano));

-- ---------------------------------------------------------------------
-- LOGS DE AUDITORIA — imutável
-- ---------------------------------------------------------------------
alter table logs_auditoria enable row level security;

drop policy if exists logs_select_all on logs_auditoria;
create policy logs_select_all on logs_auditoria
    for select to authenticated using (true);

drop policy if exists logs_insert_proprio on logs_auditoria;
create policy logs_insert_proprio on logs_auditoria
    for insert to authenticated with check (id_usuario = auth.uid());

-- ---------------------------------------------------------------------
-- CATÁLOGOS
-- ---------------------------------------------------------------------
alter table cadeias_catalogo enable row level security;

drop policy if exists cadeias_catalogo_select_all on cadeias_catalogo;
create policy cadeias_catalogo_select_all on cadeias_catalogo
    for select to authenticated using (true);

alter table gir_fl_dependencias enable row level security;

drop policy if exists gir_fl_dependencias_select_all on gir_fl_dependencias;
create policy gir_fl_dependencias_select_all on gir_fl_dependencias
    for select to authenticated using (true);
