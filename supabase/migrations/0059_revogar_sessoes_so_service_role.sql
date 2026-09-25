-- =====================================================================
-- revogar_sessoes_utilizador() só pode ser chamada pelo servidor.
--
-- A 0018 criou-a SECURITY DEFINER e sem qualquer verificação de quem a
-- chama (apaga as linhas de auth.sessions do utilizador indicado), e
-- pretendia deixá-la só ao service_role com "revoke ... from public".
-- Não chegou: a Supabase dá EXECUTE a anon e a authenticated, por
-- defeito, em todas as funções de public — e revogar de public não
-- retira esses dois papéis. Em produção, qualquer pessoa com a chave
-- pública da app, mesmo sem conta, podia chamar
-- /rest/v1/rpc/revogar_sessoes_utilizador e terminar a sessão de
-- qualquer utilizador (provado a 2026-09-25 numa transação revertida:
-- uma sessão de teste passou de 1 para 0 com a chamada feita como anon).
-- Só faltava o UUID do alvo, que qualquer utilizador autenticado lê em
-- usuarios.
--
-- Chamadores legítimos: só as Edge Functions gerir-utilizadores e
-- desactivar-saidos, ambas com a chave de serviço (service_role) — nada
-- na app, nem nos testes, a chama com outro papel. Confirmado o resto
-- das funções SECURITY DEFINER expostas a anon: todas têm guarda a sério
-- (is_gerente_ou_delegado / is_gerente_titular) ou só leem — esta era a
-- única aberta.
-- =====================================================================

revoke all on function revogar_sessoes_utilizador(uuid) from public, anon, authenticated;
grant execute on function revogar_sessoes_utilizador(uuid) to service_role;
