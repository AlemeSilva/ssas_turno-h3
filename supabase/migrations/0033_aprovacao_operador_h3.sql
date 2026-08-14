-- =====================================================================
-- Operadores H3 passam a poder aprovar o plano do seu próprio ciclo,
-- não só o Gerente/delegado — são eles que planeiam, apresentam em
-- reunião e ajustam, faz sentido também poderem aprovar.
--
-- planos_update (migração 0002) já era mais permissiva do que a
-- interface deixava perceber: `using (pode_editar_plano(id))`, sem
-- with check, permitia a quem tem pode_editar_plano(id) — Gerente/
-- delegado OU o operador do ciclo, nunca só Gerente — alterar QUALQUER
-- coluna de planos, incluindo status diretamente para APROVADO, por
-- chamada direta à API. Só o botão "Aprovar" estava escondido na
-- interface para quem não é Gerente — a mesma classe de falha já
-- corrigida noutros sítios desta app (fronteira só na interface).
--
-- Duas peças, separadas de propósito — RLS decide QUEM, trigger decide
-- QUE transição é válida:
--
-- (Nota de correção: a primeira versão desta migração tentava fazer
-- tudo com duas políticas RLS separadas, uma para submeter e outra
-- para aprovar. O pgTAP apanhou que isso não funciona — com múltiplas
-- políticas permissivas, o Postgres combina os "with check" de TODAS
-- por OR, não só o da política cujo "using" admitiu a linha. Na
-- prática isso deixava aprovar_check validar uma linha que só tinha
-- sido admitida pelo using de submeter, permitindo saltar Rascunho→
-- Aprovado direto. Daí vir agora como política única + trigger.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) RLS — quem pode mexer numa linha de planos, e autoatribuição
--    obrigatória de quem aprova (não se pode creditar outra pessoa).
-- ---------------------------------------------------------------------
drop policy if exists planos_update on planos;
drop policy if exists planos_update_submeter on planos;
drop policy if exists planos_update_aprovar on planos;

create policy planos_update on planos
    for update to authenticated
    using (pode_editar_plano(id))
    with check (pode_editar_plano(id) and (aprovado_por is null or aprovado_por = auth.uid()));

-- ---------------------------------------------------------------------
-- 2) Trigger — só é possível aprovar (status → APROVADO) a partir de
--    Pendente de aprovação; nunca direto de Rascunho. Deliberadamente
--    estreito: não mexe em mais nenhuma transição (a reabertura para
--    Pendente de aprovação, de Aprovado/Em Execução, continua a
--    funcionar sem tocar aqui — só bloqueia entradas em APROVADO).
-- ---------------------------------------------------------------------
create or replace function trg_planos_transicao_aprovacao() returns trigger as $$
begin
    if new.status = 'APROVADO' and old.status is distinct from 'PENDENTE_APROVACAO' then
        raise exception 'Só é possível aprovar um plano que esteja Pendente de aprovação (estado atual: %).', old.status;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_planos_transicao_aprovacao on planos;
create trigger trg_planos_transicao_aprovacao
before update on planos
for each row execute function trg_planos_transicao_aprovacao();
