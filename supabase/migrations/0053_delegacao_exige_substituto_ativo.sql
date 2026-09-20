-- =====================================================================
-- is_gerente_ou_delegado() concedia poderes de Gerente a um delegado
-- mesmo depois de este ser desativado a meio da janela de delegação —
-- o ramo do titular já exigia ativo = true, o ramo da delegação nunca
-- verificava o estado atual do substituto, só o intervalo de datas.
--
-- Achado da auditoria de 2026-09-20 (mesma sessão que corrigiu
-- "Ausências da equipa" a mostrar férias de gente já desativada):
-- procura sistemática por sítios que decidem algo a partir de usuarios
-- sem cruzar com ativo. Este era o mais grave dos encontrados, por
-- correr ao nível da RLS, não só da interface — a app (RequireAuth.tsx)
-- já barra a pessoa do ecrã, mas isso não protege um pedido direto à
-- API com um token ainda válido antes de a conta Auth ser mesmo
-- revogada (a função agendada desactivar-saidos só corre no dia
-- seguinte à data_saida).
-- =====================================================================

create or replace function is_gerente_ou_delegado() returns boolean as $$
    select
        exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true)
        or exists (
            select 1 from delegacoes_aprovacao d
            join usuarios u on u.id = d.substituto
             where d.substituto = auth.uid()
               and current_date between d.data_inicio and d.data_fim
               and u.ativo = true
        );
$$ language sql stable security definer set search_path = public, pg_temp;
