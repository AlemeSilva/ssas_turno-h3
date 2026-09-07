begin;
select plan(5);

-- Isto corre contra uma base com dados reais (não só num Postgres
-- local vazio) — limpa temporariamente, só dentro desta transação
-- (revertida no fim, nunca commitada), qualquer férias/escala real
-- que possa colidir com as datas fixas usadas abaixo.
delete from ferias where data_inicio <= '2026-12-31' and data_fim >= '2026-01-01';
delete from escala_semanal where semana_ref between '2026-01-01' and '2026-12-31';

-- Todos os utilizadores de teste como OPERADOR simples — só para não
-- interagir com nenhuma outra regra de perfil.
--
-- Desde a migração 0044, trg_valida_ferias bloqueia sobreposição entre
-- QUALQUER par de colegas (deixou de ser só entre OPERADOR_H3) — por
-- isso cada um dos 5 casos abaixo usa a sua própria semana (espaçadas
-- de propósito), para não colidirem entre si; o padrão de dias dentro
-- de cada semana é o que importa para trg_valida_escala_sobre_ferias,
-- não a semana em si.
select tests.criar_usuario('Caique Teste', 'caique.teste@x.pt', 'OPERADOR') as caique_id \gset
select tests.criar_usuario('Bruno Teste', 'bruno.teste@x.pt', 'OPERADOR') as bruno_id \gset
select tests.criar_usuario('Kilson Teste', 'kilson.teste@x.pt', 'OPERADOR') as kilson_id \gset
select tests.criar_usuario('Sergio Teste', 'sergio.teste@x.pt', 'OPERADOR') as sergio_id \gset
select tests.criar_usuario('Leonardo Teste', 'leonardo.teste@x.pt', 'OPERADOR') as leonardo_id \gset

-- Semana de referência para todos os casos: sábado 2026-08-29 a
-- sexta 2026-09-04 — mesma janela do caso real do Caique.

-- (a) férias em só 3 dos 7 dias da semana (caso real: Caique,
-- 02-04/09) já não bloqueia a mudança de turno.
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-08-29', :'caique_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'caique_id', '2026-09-02', '2026-09-04', 'APROVADA');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = '2026-08-29' $f$, :'caique_id'),
    'férias em só 3 dos 7 dias da semana já não bloqueia a mudança de turno (caso real: Caique, 2026-08-27)'
);

-- (b) um único dia de férias na semana também não bloqueia os
-- restantes dias. Semana própria (2026-08-08) para não sobrepor com o
-- caso (a).
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-08-08', :'bruno_id', 'H1');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'bruno_id', '2026-08-10', '2026-08-10', 'APROVADA');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = '2026-08-08' $f$, :'bruno_id'),
    '1 único dia de férias na semana não bloqueia a mudança de turno dos restantes dias'
);

-- (c) férias a cobrir a semana inteira (um só registo) continua a
-- bloquear — não sobra nenhum dia de trabalho para atribuir turno.
-- Semana própria (2026-07-18).
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-07-18', :'kilson_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'kilson_id', '2026-07-18', '2026-07-24', 'APROVADA');
select throws_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = '2026-07-18' $f$, :'kilson_id'),
    'P0001',
    'Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.',
    'férias a cobrir os 7 dias da semana (um só registo) continua a bloquear a mudança de turno'
);

-- (d) férias a cobrir a semana inteira através de DOIS registos não
-- contíguos (nenhum sozinho cobre a semana, mas juntos cobrem os 7
-- dias) também bloqueia — confirma que a validação é dia a dia
-- (união), não olha só para um registo de férias de cada vez. Semana
-- própria (2026-06-27).
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-06-27', :'sergio_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'sergio_id', '2026-06-27', '2026-06-30', 'APROVADA');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'sergio_id', '2026-07-01', '2026-07-03', 'APROVADA');
select throws_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = '2026-06-27' $f$, :'sergio_id'),
    'P0001',
    'Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.',
    'dois registos de férias não contíguos que juntos cobrem os 7 dias também bloqueiam (validação dia a dia, não por registo)'
);

-- (e) sem qualquer férias, a mudança de turno continua a funcionar
-- normalmente — não-regressão do caminho mais comum. Semana própria
-- (2026-06-06).
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-06-06', :'leonardo_id', 'H4');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H1' where usuario_id = %L and semana_ref = '2026-06-06' $f$, :'leonardo_id'),
    'sem férias nenhuma, a mudança de turno continua a funcionar sem qualquer bloqueio (não-regressão)'
);

select * from finish();
rollback;
