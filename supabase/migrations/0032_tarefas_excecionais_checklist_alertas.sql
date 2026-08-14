-- =====================================================================
-- Tarefas excecionais passam a poder ser marcadas como concluídas a
-- partir do Checklist Ativo (bloco próprio, fora das 5 secções fixas)
-- e a participar nos alertas de hora-limite ultrapassada (painel do
-- Checklist e barra superior — hr_limite já existia na coluna, só
-- faltava o formulário capturá-la). Duas peças novas na base, a
-- espelhar o padrão já usado em checklist_itens:
--
-- 1) Conclusão fica imutável (como um item de checklist) até um
--    Gerente/delegado "destravar" com justificativa — mesmo mecanismo
--    (current_setting('app.permitir_destravar')) e mesma forma do RPC
--    destravar_checklist_item, já com a verificação de permissão no
--    corpo da função desde o início (a migração 0024 teve de corrigir
--    isso a posteriori no checklist; aqui fica certo já na primeira).
--
-- 2) Concluir uma tarefa é uma ação normal de execução do fim de
--    semana, não uma alteração de conteúdo — não deve reabrir a
--    aprovação do plano. trg_tarefas_reabre_aprovacao (0002, já
--    estendida em 0031) passa a distinguir os dois casos comparando
--    OLD e NEW, e a ignorar-se por completo durante um destravar (que
--    já regista o seu próprio rasto em auditoria, para não duplicar).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Colunas de destravar (espelham checklist_itens)
-- ---------------------------------------------------------------------
alter table tarefas_plano add column if not exists destravado_por uuid references usuarios(id);
alter table tarefas_plano add column if not exists destravado_em timestamptz;
alter table tarefas_plano add column if not exists destravado_motivo text;

-- ---------------------------------------------------------------------
-- 2) Imutabilidade após concluída — mesmo mecanismo do checklist
-- ---------------------------------------------------------------------
create or replace function trg_tarefas_plano_imutavel() returns trigger as $$
begin
    if old.status = 'CONCLUIDO' and current_setting('app.permitir_destravar', true) is distinct from 'true' then
        if new.status is distinct from old.status
           or new.executado_por is distinct from old.executado_por
           or new.dt_hr_conclusao_real is distinct from old.dt_hr_conclusao_real then
            raise exception 'Tarefa concluída é imutável. Use a função destravar_tarefa_plano para correções, com justificativa.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tarefas_plano_imutavel on tarefas_plano;
create trigger trg_tarefas_plano_imutavel
before update on tarefas_plano
for each row execute function trg_tarefas_plano_imutavel();

create or replace function destravar_tarefa_plano(p_id bigint, p_motivo text) returns void as $$
begin
    if not is_gerente_ou_delegado() then
        raise exception 'Sem permissão — reservado ao Gerente/delegado.';
    end if;

    perform set_config('app.permitir_destravar', 'true', true);

    update tarefas_plano
       set status = 'PENDENTE',
           executado_por = null,
           dt_hr_conclusao_real = null,
           destravado_por = auth.uid(),
           destravado_em = now(),
           destravado_motivo = p_motivo
     where id = p_id;

    insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
    values ('TAREFA_PLANO', p_id, auth.uid(), 'OVERRIDE_TAREFA', p_motivo);

    perform set_config('app.permitir_destravar', 'false', true);
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- 3) Concluir não reabre a aprovação — só edição de conteúdo continua a
--    reabrir. Distingue-se comparando as colunas de conteúdo entre OLD
--    e NEW; se nenhuma mudou, é uma conclusão (ou um destravar) e não
--    uma edição. Durante o próprio destravar (RPC acima), a função
--    devolve de imediato — esse fluxo já regista OVERRIDE_TAREFA, um
--    segundo registo aqui seria duplicado.
-- ---------------------------------------------------------------------
create or replace function trg_tarefas_reabre_aprovacao() returns trigger as $$
declare
    v_plano planos%rowtype;
    v_reabriu boolean := false;
    v_so_conclusao boolean := false;
begin
    if current_setting('app.permitir_destravar', true) = 'true' then
        return new;
    end if;

    select * into v_plano from planos where id = coalesce(new.id_plano, old.id_plano);

    if tg_op = 'UPDATE' then
        v_so_conclusao :=
            new.data_execucao is not distinct from old.data_execucao
            and new.descricao_tarefa is not distinct from old.descricao_tarefa
            and new.equipa_responsavel is not distinct from old.equipa_responsavel
            and new.hora_arranque is not distinct from old.hora_arranque
            and new.dt_previsao is not distinct from old.dt_previsao
            and new.hr_previsao_termino is not distinct from old.hr_previsao_termino
            and new.hr_limite is not distinct from old.hr_limite
            and new.observacao is not distinct from old.observacao;
    end if;

    if v_plano.status in ('APROVADO', 'EM_EXECUCAO') and not is_gerente_ou_delegado() and not v_so_conclusao then
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
        values ('PLANO', v_plano.id, auth.uid(),
                case when v_so_conclusao then 'CONCLUSAO_TAREFA' else 'EDICAO_TAREFA' end,
                case when v_so_conclusao
                     then 'Tarefa "' || coalesce(new.descricao_tarefa, '') || '" (id ' || new.id || ') marcada como ' || new.status || '.'
                     else 'Tarefa "' || coalesce(new.descricao_tarefa, '') || '" (id ' || new.id || ') editada.'
                end);
    end if;

    return new;
end;
$$ language plpgsql security definer;

-- O trigger trg_tarefas_plano_reabre (migração 0002) já aponta para
-- esta função — create or replace function é suficiente.
