-- =====================================================================
-- Endurecimento de segurança — 4 correções mecânicas, sem mudança de
-- comportamento visível, identificadas no dossiê de auditoria de
-- segurança de 2026-09-05:
--
-- 1) search_path fixo nas funções security definer que ainda não o
--    tinham (padrão "Function Search Path Mutable" do Supabase
--    Advisor, já adotado desde a migração 0039 mas nunca retroaplicado
--    às mais antigas). Corpo de cada função inalterado — só se
--    acrescenta "set search_path = public, pg_temp".
-- 2) aprovado_por/data_aprovacao de planos passam a ser carimbados no
--    servidor no momento exato da transição para APROVADO, em vez de
--    confiar no valor que o cliente envia — a RLS já impedia creditar
--    outra pessoa, mas não impedia um timestamp arbitrário do browser.
-- 3) usuario_ativo() removida — código morto, nunca chamada em nenhuma
--    política ou função (confirmado por grep a todas as migrações).
-- 4) Achado adicional, apanhado ao escrever o teste do item 2 (não
--    fazia parte do dossiê original): trg_planos_transicao_aprovacao
--    disparava a sua exceção em QUALQUER UPDATE a um plano já
--    aprovado, mesmo sem o status mudar — faltava comparar old.status
--    contra new.status, não só contra 'PENDENTE_APROVACAO'. Sem
--    caminho na app que hoje edite um plano aprovado sem tocar em
--    status, nunca se manifestou em produção — corrigido na mesma
--    função por já estar a ser alterada para o item 2.
--
-- Nota deliberada: a correção de imutabilidade de cadeias_diarias
-- (também identificada no dossiê) FICA DE FORA desta migração — o
-- botão de estado em CadeiaLinha.tsx usa PROXIMO_ESTADO para ciclar
-- CONCLUIDO_AUTOMATICO/CONCLUIDO_MANUAL de volta a PENDENTE como
-- interação normal do dia a dia (não uma correção pontual); replicar
-- o trigger de checklist_itens ali quebraria essa interação. Precisa
-- de desenho próprio antes de qualquer alteração de schema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) search_path — funções puras de autorização
-- ---------------------------------------------------------------------
create or replace function is_gerente_ou_delegado() returns boolean as $$
    select
        exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true)
        or exists (
            select 1 from delegacoes_aprovacao
             where substituto = auth.uid()
               and current_date between data_inicio and data_fim
        );
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function is_gerente_titular() returns boolean as $$
    select exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true);
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function is_operador_do_ciclo(p_data_inicio_ciclo date) returns boolean as $$
    select auth.uid() = operador_do_ciclo(p_data_inicio_ciclo);
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function pode_editar_plano(p_id_plano bigint) returns boolean as $$
    select is_gerente_ou_delegado()
        or is_operador_do_ciclo((select data_inicio_ciclo from planos where id = p_id_plano));
$$ language sql stable security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 1) search_path — RPCs de destravar (corpo idêntico ao vigente)
-- ---------------------------------------------------------------------
create or replace function destravar_checklist_item(p_id bigint, p_motivo text) returns void as $$
begin
    if not is_gerente_ou_delegado() then
        raise exception 'Sem permissão — reservado ao Gerente/delegado.';
    end if;

    perform set_config('app.permitir_destravar', 'true', true);

    update checklist_itens
       set concluido = false,
           concluido_por = null,
           data_hora_conclusao = null,
           destravado_por = auth.uid(),
           destravado_em = now(),
           destravado_motivo = p_motivo
     where id = p_id;

    insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
    values ('CHECKLIST_ITEM', p_id, auth.uid(), 'OVERRIDE_CHECKLIST', p_motivo);

    perform set_config('app.permitir_destravar', 'false', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

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
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 1) search_path — trigger de reabertura de aprovação (corpo idêntico)
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
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 2) Responsabilização de aprovação de plano — carimbo no servidor
-- ---------------------------------------------------------------------
create or replace function trg_planos_transicao_aprovacao() returns trigger as $$
begin
    -- Achado adicional, apanhado ao escrever o teste da correção abaixo
    -- (12_aprovacao_operador_h3.sql, caso 10): faltava "and old.status
    -- is distinct from new.status" — sem isto, QUALQUER UPDATE a um
    -- plano já aprovado (mesmo um campo sem relação nenhuma, ex.:
    -- observacoes_gerais) tinha new.status='APROVADO' e
    -- old.status<>'PENDENTE_APROVACAO' ao mesmo tempo, disparando esta
    -- exceção mesmo sem o estado estar a mudar. Não há hoje nenhum
    -- caminho na app que edite um plano já aprovado sem tocar em
    -- status (grep confirmado a PlanoPage.tsx), por isso nunca se
    -- manifestou em produção — mas bloquearia de imediato o dia em que
    -- alguém adicionasse essa funcionalidade.
    if new.status = 'APROVADO' and old.status is distinct from new.status and old.status is distinct from 'PENDENTE_APROVACAO' then
        raise exception 'Só é possível aprovar um plano que esteja Pendente de aprovação (estado atual: %).', old.status;
    end if;

    -- Achado do dossiê de segurança: data_aprovacao era só do cliente
    -- (PlanoPage.tsx: new Date().toISOString()) — sem trigger nenhum a
    -- corrigir, um timestamp arbitrário do relógio do browser passava.
    -- Só data_aprovacao é forçada aqui: aprovado_por já fica corretamente
    -- protegido pela RLS existente (with check aprovado_por=auth.uid()),
    -- que rejeita a tentativa por inteiro se alguém tentar creditar
    -- outra pessoa — sobrepor aprovado_por aqui trocaria essa rejeição
    -- explícita por uma correção silenciosa, um comportamento pior
    -- (apanhado pelo teste 5 deste ficheiro, que passa hoje a validar
    -- exatamente essa rejeição). Só neste exato momento de transição,
    -- nunca nas restantes escritas — não deve apagar o histórico de
    -- quando aprovou numa edição não relacionada.
    if new.status = 'APROVADO' and old.status is distinct from new.status and old.status is distinct from 'APROVADO' then
        new.data_aprovacao := clock_timestamp();
    end if;

    return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- 3) Código morto
-- ---------------------------------------------------------------------
drop function if exists usuario_ativo(uuid);
