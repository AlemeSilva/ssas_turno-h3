-- =====================================================================
-- Função auxiliar para a Edge Function gerir-utilizadores: termina
-- sessões já abertas de um utilizador ao desativá-lo. O schema `auth`
-- normalmente não está exposto via REST (PostgREST só expõe `public`
-- por omissão) — chamar isto via RPC evita depender de `auth` estar
-- exposto, a função em si corre com privilégio de definer e acede a
-- auth.sessions diretamente em SQL puro.
-- =====================================================================

create or replace function revogar_sessoes_utilizador(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
    delete from auth.sessions where user_id = p_usuario_id;
end;
$function$;

revoke all on function revogar_sessoes_utilizador(uuid) from public;
grant execute on function revogar_sessoes_utilizador(uuid) to service_role;
