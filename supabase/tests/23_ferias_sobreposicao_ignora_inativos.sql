-- =====================================================================
-- Cobertura da migração 0055 — as férias de quem já saiu da equipa
-- deixam de bloquear os pedidos sobrepostos dos colegas (regra da 0044:
-- nenhuma sobreposição entre quaisquer dois elementos da equipa).
--
-- Caso real de 2026-09-25: as férias aprovadas do Pedro, desligado a
-- 21/08 (desativar apaga a escala futura mas não as férias), recusavam
-- pedidos de colegas para 28/09-02/10 e 06-09/10 com "Já existem
-- férias/licença de outro colega sobrepostas a este período".
--
-- Todos os utilizadores criados já aqui, antes de qualquer
-- tests.autenticar_como() — criar_usuario() não é security definer.
-- Datas relativas ao ano corrente: o INSERT de férias só aceita o ano
-- corrente (0004/0045), por isso datas fixas de um ano concreto deixavam
-- este teste a falhar quando o ano mudasse.
-- =====================================================================
begin;
select plan(3);

select tests.criar_usuario('Pedinte Um 23', 'pedinte1-23@teste.pt', 'OPERADOR') as p1_id \gset
select tests.criar_usuario('Pedinte Dois 23', 'pedinte2-23@teste.pt', 'OPERADOR') as p2_id \gset
select tests.criar_usuario('Pedinte Tres 23', 'pedinte3-23@teste.pt', 'OPERADOR') as p3_id \gset
select tests.criar_usuario('Saiu 23', 'saiu23@teste.pt', 'OPERADOR', false) as saiu_id \gset
select tests.criar_usuario('Colega Ativo 23', 'colega23@teste.pt', 'OPERADOR') as colega_id \gset
select tests.criar_usuario('Reativado 23', 'reativado23@teste.pt', 'OPERADOR', false) as reativado_id \gset

-- 1 de novembro do ano corrente: três janelas de uma semana, uma por
-- colega, sem se tocarem entre si.
select (date_trunc('year', current_date) + interval '10 months')::date as base \gset

-- Semeadas ainda como role de ligação (antes de autenticar) — é só
-- preparação, a RLS não é o que está em teste aqui.
insert into ferias (usuario_id, data_inicio, data_fim, status) values
    (:'saiu_id',      :'base'::date + 1,  :'base'::date + 5,  'APROVADA'),
    (:'colega_id',    :'base'::date + 8,  :'base'::date + 12, 'APROVADA'),
    (:'reativado_id', :'base'::date + 15, :'base'::date + 19, 'APROVADA');

select tests.autenticar_como(:'p1_id');
select lives_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, %L::date + 2, %L::date + 4) $f$, :'p1_id', :'base', :'base'),
    'férias aprovadas de quem já saiu da equipa (ativo = false) deixam de bloquear o pedido de um colega'
);

select tests.autenticar_como(:'p2_id');
select throws_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, %L::date + 9, %L::date + 11) $f$, :'p2_id', :'base', :'base'),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'não-regressão: férias aprovadas de um colega ATIVO continuam a bloquear pedidos sobrepostos'
);

-- Reativar exige update a usuarios, que a RLS só deixa a
-- is_gerente_ou_delegado() — por isso volta-se ao role de ligação.
reset role;
update usuarios set ativo = true where id = :'reativado_id';

select tests.autenticar_como(:'p3_id');
select throws_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, %L::date + 16, %L::date + 18) $f$, :'p3_id', :'base', :'base'),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'uma pessoa reativada volta a bloquear — o estado lido é sempre o atual, não o do momento em que as férias foram aprovadas'
);

select * from finish();
rollback;
