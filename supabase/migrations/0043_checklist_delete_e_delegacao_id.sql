-- =====================================================================
-- Últimas 2 correções do dossiê de auditoria de segurança de 2026-09-05:
--
-- 1) checklist_itens: RLS dividida por ação (insert/update/delete), não
--    por origem — ao contrário de tarefas_plano, esta tabela não tem
--    conceito de "item excecional"; todo o conjunto é sempre semeado de
--    uma vez por criarPlano() a partir do template fixo
--    (src/lib/templateChecklist.ts), nunca há um caminho na app para
--    inserir ou apagar um item depois disso (confirmado por grep
--    exaustivo a src/ — ItemChecklistLinha.tsx só faz UPDATE e chama
--    destravar_checklist_item, nunca insert/delete). INSERT/UPDATE
--    continuam abertos a quem pode editar o plano (é assim que
--    criarPlano() semeia o conjunto inicial, tanto para Gerente/
--    delegado como para o operador do ciclo); DELETE passa a ser
--    exclusivo de Gerente/delegado — a única ação sem nenhum uso
--    legítimo pelo operador do ciclo.
-- 2) logs_auditoria.delegacao_id: existe desde a criação da tabela mas
--    nunca era preenchida por nenhuma das ~50 escritas encontradas —
--    sem isto, não há forma de saber a partir do log se uma ação foi
--    de um delegado. Em vez de editar cada função/trigger que escreve
--    em logs_auditoria (destravar_checklist_item, destravar_tarefa_
--    plano, trg_tarefas_reabre_aprovacao, trg_headcount_parametros_
--    auditoria, fechar_mes_headcount, e as 2 escritas diretas do
--    cliente já fechadas em 0042), um único trigger before insert na
--    própria tabela preenche-a automaticamente sempre que faltar —
--    cobre todos os pontos de escrita atuais e futuros de uma só vez,
--    sem tocar em nenhuma das funções existentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) checklist_itens — DELETE exclusivo de Gerente/delegado
-- ---------------------------------------------------------------------
drop policy if exists checklist_write on checklist_itens;

create policy checklist_insert on checklist_itens
    for insert to authenticated with check (pode_editar_plano(id_plano));

create policy checklist_update on checklist_itens
    for update to authenticated using (pode_editar_plano(id_plano)) with check (pode_editar_plano(id_plano));

create policy checklist_delete on checklist_itens
    for delete to authenticated using (is_gerente_ou_delegado());

-- ---------------------------------------------------------------------
-- 2) logs_auditoria.delegacao_id — preenchimento automático
-- ---------------------------------------------------------------------
-- Mesma leitura que is_gerente_ou_delegado() já faz para o lado da
-- delegação — a trigger de anti-sobreposição (trg_valida_delegacao)
-- garante que nunca há mais do que uma linha com a janela de datas
-- ativa em toda a tabela, por isso "limit 1" aqui é só defensivo.
create or replace function delegacao_ativa_id() returns bigint as $$
    select id from delegacoes_aprovacao
     where substituto = auth.uid()
       and current_date between data_inicio and data_fim
     limit 1;
$$ language sql stable security definer set search_path = public, pg_temp;

create or replace function trg_logs_auditoria_marca_delegacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $function$
begin
    if new.delegacao_id is null then
        new.delegacao_id := delegacao_ativa_id();
    end if;
    return new;
end;
$function$;

drop trigger if exists trg_logs_auditoria_marca_delegacao on logs_auditoria;
create trigger trg_logs_auditoria_marca_delegacao
before insert on logs_auditoria
for each row execute function trg_logs_auditoria_marca_delegacao();
