-- =====================================================================
-- Cobertura da migração 0059 — revogar_sessoes_utilizador() (SECURITY
-- DEFINER, sem guarda) estava executável por anon e authenticated, e
-- qualquer pessoa podia terminar a sessão de qualquer utilizador.
--
-- Utilizador e sessão criados já aqui, antes de autenticar —
-- criar_usuario() não é security definer. A sessão é uma linha mínima
-- em auth.sessions (só id e user_id são obrigatórios).
-- =====================================================================
begin;
select plan(8);

select tests.criar_usuario('Alvo 26', 'alvo26@teste.pt', 'OPERADOR') as alvo_id \gset
select tests.criar_usuario('Curioso 26', 'curioso26@teste.pt', 'OPERADOR') as curioso_id \gset
insert into auth.sessions (id, user_id, created_at, updated_at) values
    (gen_random_uuid(), :'alvo_id', now(), now()),
    (gen_random_uuid(), :'curioso_id', now(), now());

select is(has_function_privilege('anon', 'revogar_sessoes_utilizador(uuid)', 'execute'), false,
    'um utilizador anónimo não pode executar a função');
select is(has_function_privilege('authenticated', 'revogar_sessoes_utilizador(uuid)', 'execute'), false,
    'um utilizador autenticado não pode executar a função');
select is(has_function_privilege('service_role', 'revogar_sessoes_utilizador(uuid)', 'execute'), true,
    'o service_role (as Edge Functions) continua a poder executá-la');

-- Um utilizador autenticado qualquer tenta terminar a sessão de outro.
select tests.autenticar_como(:'curioso_id');
select throws_ok(
    format($f$ select revogar_sessoes_utilizador(%L) $f$, :'alvo_id'),
    '42501',
    'permission denied for function revogar_sessoes_utilizador',
    'um utilizador autenticado é recusado ao tentar terminar a sessão de outro'
);

-- auth.sessions não é legível por authenticated: volta-se ao role de ligação.
reset role;
select is((select count(*)::int from auth.sessions where user_id = :'alvo_id'), 1,
    'a sessão do alvo continua lá depois da tentativa recusada');

-- O servidor continua a conseguir usá-la (aqui o role de ligação, que é o dono).
select lives_ok(
    format($f$ select revogar_sessoes_utilizador(%L) $f$, :'alvo_id'),
    'quem tem permissão (o dono, o service_role) continua a poder terminar sessões'
);
select is((select count(*)::int from auth.sessions where user_id = :'alvo_id'), 0,
    'e a sessão do alvo é mesmo terminada');
select is((select count(*)::int from auth.sessions where user_id = :'curioso_id'), 1,
    'terminar as sessões de um utilizador não toca nas de mais ninguém');

select * from finish();
rollback;
