-- =====================================================================
-- Correção pontual: o feriado de 05/10/2026 (Implantação da
-- República) tinha o Kilson como plantonista confirmado
-- (plantao_voluntarios.id=4), mas deveria ser o Caique — divergência
-- reportada diretamente pelo Gerente, corrigida aqui por intervenção
-- direta (não passou pela UI, por isso confirmado_por fica nulo).
-- =====================================================================

update plantao_voluntarios
   set usuario_id = (select id from usuarios where nome = 'Caique'),
       confirmado_em = now()
 where data_feriado = '2026-10-05'
   and voluntario = true;
