-- =====================================================================
-- Peer-review de 2026-08-14 sobre a edição de tarefas excecionais
-- (Plano de Fim de Semana): três lacunas reais na camada de dados.
--
-- 1) tarefas_write não distinguia origem — um operador do ciclo (não
--    Gerente), com pode_editar_plano(id_plano)=true, já conseguia
--    fazer UPDATE/DELETE a tarefas TEMPLATE/MANUTENCAO via API direta,
--    não só às EXCECIONAL que a interface expõe para edição. INSERT
--    mantém-se sem restrição de origem — criarPlano() insere as
--    tarefas TEMPLATE/MANUTENCAO do próprio operador ao criar o seu
--    plano, isso é legítimo.
--
-- 2) Sem coluna a marcar a última alteração, editar uma tarefa (nova
--    funcionalidade em PlanoPage.tsx) era sempre "última escrita
--    ganha" — se duas pessoas editassem a mesma tarefa perto uma da
--    outra, ou a tarefa fosse apagada entretanto, a segunda gravação
--    sobrepunha-se em silêncio. atualizado_em + comparação no UPDATE
--    do frontend (bloqueio otimista) fecha isto.
--
-- 3) trg_tarefas_reabre_aprovacao só registava auditoria quando a
--    edição reabria um plano já aprovado — uma edição normal (plano
--    ainda em Rascunho/Pendente) não deixava rasto nenhum de quem
--    mudou o quê.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) atualizado_em — mantido automaticamente em cada UPDATE
-- ---------------------------------------------------------------------
alter table tarefas_plano add column if not exists atualizado_em timestamptz not null default now();

create or replace function trg_tarefas_plano_toca_atualizado_em() returns trigger as $$
begin
    -- clock_timestamp(), não now(): now() fica congelado ao valor de
    -- início da transação — dentro de uma única transação (ex.: este
    -- próprio ficheiro de teste), um INSERT seguido de UPDATE veria o
    -- mesmo instante e o bloqueio otimista nunca detetaria a mudança.
    new.atualizado_em = clock_timestamp();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tarefas_plano_atualizado_em on tarefas_plano;
create trigger trg_tarefas_plano_atualizado_em
before update on tarefas_plano
for each row execute function trg_tarefas_plano_toca_atualizado_em();

-- ---------------------------------------------------------------------
-- 2) RLS: só Gerente/delegado altera ou apaga tarefas que não sejam
--    EXCECIONAL — INSERT mantém-se sem restrição de origem.
-- ---------------------------------------------------------------------
drop policy if exists tarefas_write on tarefas_plano;

drop policy if exists tarefas_insert on tarefas_plano;
create policy tarefas_insert on tarefas_plano
    for insert to authenticated
    with check (pode_editar_plano(id_plano));

drop policy if exists tarefas_update on tarefas_plano;
create policy tarefas_update on tarefas_plano
    for update to authenticated
    using (pode_editar_plano(id_plano) and (is_gerente_ou_delegado() or origem = 'EXCECIONAL'))
    with check (pode_editar_plano(id_plano) and (is_gerente_ou_delegado() or origem = 'EXCECIONAL'));

drop policy if exists tarefas_delete on tarefas_plano;
create policy tarefas_delete on tarefas_plano
    for delete to authenticated
    using (pode_editar_plano(id_plano) and (is_gerente_ou_delegado() or origem = 'EXCECIONAL'));

-- ---------------------------------------------------------------------
-- 3) Auditoria também para edição normal (sem reabertura de aprovação)
-- ---------------------------------------------------------------------
create or replace function trg_tarefas_reabre_aprovacao() returns trigger as $$
declare
    v_plano planos%rowtype;
    v_reabriu boolean := false;
begin
    select * into v_plano from planos where id = coalesce(new.id_plano, old.id_plano);

    if v_plano.status in ('APROVADO', 'EM_EXECUCAO') and not is_gerente_ou_delegado() then
        update planos
           set status = 'PENDENTE_APROVACAO'
         where id = v_plano.id;

        v_reabriu := true;
        insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
        values ('PLANO', v_plano.id, auth.uid(), 'REABERTURA_APROVACAO',
                'Alteração a tarefa após aprovação, formalmente pendente de nova aprovação do Gerente.');
    end if;

    if tg_op = 'UPDATE' and not v_reabriu then
        insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
        values ('PLANO', v_plano.id, auth.uid(), 'EDICAO_TAREFA',
                'Tarefa "' || coalesce(new.descricao_tarefa, '') || '" (id ' || new.id || ') editada.');
    end if;

    return new;
end;
$$ language plpgsql security definer;

-- O trigger trg_tarefas_plano_reabre (migração 0002) já aponta para
-- esta função — create or replace function é suficiente, não requer
-- recriar o trigger.
