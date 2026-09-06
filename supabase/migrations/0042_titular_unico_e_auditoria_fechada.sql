-- =====================================================================
-- Duas correções do dossiê de auditoria de segurança de 2026-09-05,
-- decididas explicitamente pelo Gerente (as outras 3 do mesmo lote
-- ficaram deliberadamente de fora: máquina de estados do Plano não se
-- mexe — "o objetivo é corrigir fragilidade de segurança, não
-- funcionalidades"; ferias fica para nova ronda de discussão; férias/
-- trocas/planos não vão ser auditados):
--
-- 1) Proíbe sobreposição de Gerente titular — nunca mais do que uma
--    conta com perfil='GERENTE' and ativo=true em simultâneo. Antes
--    disto, nada impedia dois titulares ativos ao mesmo tempo, cada um
--    com poder total e sem hierarquia entre si (0038 só desambiguava
--    um efeito colateral cosmético disso — quem ficava com H4 fixo —
--    nunca a causa).
-- 2) logs_auditoria: a política de INSERT do próprio utilizador passa
--    a exigir uma acao de uma lista fechada, correspondente aos únicos
--    2 pontos reais de escrita direta do cliente hoje (fora de RPCs/
--    triggers security definer, que continuam a bypassar RLS
--    normalmente): AlterarSenhaDialog.tsx e PainelAlertas.tsx. Antes
--    disto, qualquer utilizador autenticado podia inserir uma entrada
--    de auditoria com uma acao arbitrária, auto-atribuída.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Gerente titular único
-- ---------------------------------------------------------------------
-- Índice único parcial sobre uma expressão constante: todas as linhas
-- que satisfazem o predicado (perfil GERENTE, ativo) indexam o mesmo
-- valor (true) — uma segunda linha assim colide sempre com a primeira.
-- Preferido a um trigger com "exists(...)" porque um índice único é
-- garantido pelo próprio Postgres mesmo sob transações concorrentes
-- (duas promoções simultâneas serializam corretamente); um "exists"
-- dentro de um trigger tem uma janela de corrida teórica entre as duas
-- transações verificarem a condição e nenhuma delas ainda ter submetido.
create unique index if not exists ux_usuarios_gerente_titular_unico
    on usuarios ((true))
    where perfil = 'GERENTE' and ativo = true;

-- ---------------------------------------------------------------------
-- 2) logs_auditoria — lista fechada de ações no INSERT direto do cliente
-- ---------------------------------------------------------------------
drop policy if exists logs_insert_proprio on logs_auditoria;
create policy logs_insert_proprio on logs_auditoria
    for insert to authenticated with check (
        id_usuario = auth.uid()
        and acao in (
            'PASSWORD_ALTERADA_PROPRIA',   -- AlterarSenhaDialog.tsx
            'ESCALONAMENTO_HR_LIMITE',      -- PainelAlertas.tsx
            'ESCALONAMENTO_GIR_FL',         -- PainelAlertas.tsx
            'ESCALONAMENTO_CHECAGEM_20H',   -- PainelAlertas.tsx
            'ESCALONAMENTO_CHECAGEM_15H'    -- PainelAlertas.tsx
        )
    );
