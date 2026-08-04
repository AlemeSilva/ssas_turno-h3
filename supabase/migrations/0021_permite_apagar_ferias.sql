-- =====================================================================
-- ferias não tinha nenhuma política de DELETE — nem o próprio dono do
-- pedido, nem o Gerente, conseguiam apagar uma linha (RLS bloqueia
-- silenciosamente, sem erro, quando não há policy para o comando).
--
-- Motivo concreto: uma linha de férias de 18/02/2026 do Pedro ficou
-- registada por engano (ele trabalhou nesse dia, em H4) e inflacionou
-- o saldo anual dele para 23 dias em vez de 22 — corrigido
-- manualmente, mas sem forma de o Gerente repetir isto sozinho.
--
-- Mesma regra já usada em ferias_update: o próprio dono enquanto o
-- pedido está PENDENTE, ou o Gerente/delegado em qualquer estado.
-- =====================================================================

drop policy if exists ferias_delete on ferias;
create policy ferias_delete on ferias
  for delete
  using ((usuario_id = auth.uid() and status = 'PENDENTE') or is_gerente_ou_delegado());
