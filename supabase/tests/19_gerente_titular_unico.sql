-- =====================================================================
-- Migração 0042 (dossiê de segurança de 2026-09-05, achado "Alto" —
-- nada impedia duas contas com perfil='GERENTE' and ativo=true em
-- simultâneo, cada uma com poder total e sem hierarquia entre si).
-- ux_usuarios_gerente_titular_unico proíbe a sobreposição na origem.
--
-- Corre (tal como 17_preencher_escala_anual_gerente_titular.sql) sem
-- tests.autenticar_como — a ligação de teste liga como o dono/superuser
-- da base, que faz bypass de RLS; isto isola deliberadamente o próprio
-- índice único como a coisa a provar, sem depender de nenhuma policy
-- de RLS pelo caminho. Cobre o que o caso B de 17 não cobre: uma
-- segunda conta GERENTE inativa continua permitida; a proibição vale
-- tanto para criar como para promover por UPDATE; um handover
-- sequencial (desativar antes de ativar o novo) continua a funcionar.
-- =====================================================================
begin;
select plan(4);

select id as gerente_real_id from usuarios where perfil = 'GERENTE' and ativo = true order by criado_em asc limit 1 \gset
select tests.criar_usuario('Operador Dezanove', 'operador19@teste.pt', 'OPERADOR') as operador_id \gset

-- 1) Uma segunda conta GERENTE INATIVA não colide — o índice só cobre
-- ativo=true, nunca impediu ter ex-Gerentes registados no sistema.
select lives_ok(
    $$ select tests.criar_usuario('Gerente Inativo Dezanove', 'gerente19inativo@teste.pt', 'GERENTE', false) $$,
    'uma segunda conta GERENTE pode existir, desde que inativa'
);

-- 2) A proibição vale também para promover um utilizador já existente
-- por UPDATE, não só para criar um novo com tests.criar_usuario.
select throws_ok(
    format($f$ update usuarios set perfil = 'GERENTE' where id = %L $f$, :'operador_id'),
    '23505',
    'duplicate key value violates unique constraint "ux_usuarios_gerente_titular_unico"',
    'promover um utilizador existente a Gerente ativo também é bloqueado, não só criar um novo'
);

-- 3) Handover sequencial continua a funcionar: desativa o titular atual
-- primeiro, só depois ativa o novo — nunca há sobreposição real.
update usuarios set ativo = false where id = :'gerente_real_id';
select lives_ok(
    format($f$ update usuarios set perfil = 'GERENTE', ativo = true where id = %L $f$, :'operador_id'),
    'depois de desativar o titular anterior, ativar um novo titular funciona normalmente'
);
select is(
    (select count(*)::int from usuarios where perfil = 'GERENTE' and ativo = true),
    1,
    'continua a existir exatamente 1 Gerente titular ativo depois do handover sequencial'
);

select * from finish();
rollback;
