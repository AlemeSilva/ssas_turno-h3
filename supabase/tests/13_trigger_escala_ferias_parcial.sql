begin;
select plan(5);

-- Isto corre contra uma base com dados reais (não só num Postgres
-- local vazio) — limpa temporariamente, só dentro desta transação
-- (revertida no fim, nunca commitada), qualquer férias/escala real do
-- ano corrente que possa colidir com as datas usadas abaixo.
delete from ferias where data_inicio <= tests.dia(12, 31) and data_fim >= tests.dia(1, 1);
delete from escala_semanal where semana_ref between tests.dia(1, 1) and tests.dia(12, 31);

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

-- Datas do ano corrente e calculadas (00_helpers.sql): trg_valida_ferias
-- só aceita férias do ano em curso, e semana_ref é sempre um sábado —
-- tests.sabado(mês, dia) é o primeiro sábado em ou depois desse dia
-- (em 2026 devolve exatamente 29/08, 08/08, 18/07, 27/06 e 06/06, as
-- datas do caso real), e as férias de cada caso são deslocamentos a
-- partir dele, para o padrão de dias dentro da semana ser o mesmo em
-- qualquer ano.
--
-- Semana de referência do caso (a): sábado 29/08 a sexta 04/09 — mesma
-- janela do caso real do Caique.

-- (a) férias em só 3 dos 7 dias da semana (caso real: Caique,
-- 02-04/09) já não bloqueia a mudança de turno.
insert into escala_semanal (semana_ref, usuario_id, turno) values (tests.sabado(8, 29), :'caique_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'caique_id', tests.sabado(8, 29) + 4, tests.sabado(8, 29) + 6, 'APROVADA');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = tests.sabado(8, 29) $f$, :'caique_id'),
    'férias em só 3 dos 7 dias da semana já não bloqueia a mudança de turno (caso real: Caique, 2026-08-27)'
);

-- (b) um único dia de férias na semana também não bloqueia os
-- restantes dias. Semana própria (tests.sabado(8, 8)) para não sobrepor com o
-- caso (a).
insert into escala_semanal (semana_ref, usuario_id, turno) values (tests.sabado(8, 8), :'bruno_id', 'H1');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'bruno_id', tests.sabado(8, 8) + 2, tests.sabado(8, 8) + 2, 'APROVADA');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = tests.sabado(8, 8) $f$, :'bruno_id'),
    '1 único dia de férias na semana não bloqueia a mudança de turno dos restantes dias'
);

-- (c) férias a cobrir a semana inteira (um só registo) continua a
-- bloquear — não sobra nenhum dia de trabalho para atribuir turno.
-- Semana própria (tests.sabado(7, 18)).
insert into escala_semanal (semana_ref, usuario_id, turno) values (tests.sabado(7, 18), :'kilson_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'kilson_id', tests.sabado(7, 18), tests.sabado(7, 18) + 6, 'APROVADA');
select throws_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = tests.sabado(7, 18) $f$, :'kilson_id'),
    'P0001',
    'Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.',
    'férias a cobrir os 7 dias da semana (um só registo) continua a bloquear a mudança de turno'
);

-- (d) férias a cobrir a semana inteira através de DOIS registos não
-- contíguos (nenhum sozinho cobre a semana, mas juntos cobrem os 7
-- dias) também bloqueia — confirma que a validação é dia a dia
-- (união), não olha só para um registo de férias de cada vez. Semana
-- própria (tests.sabado(6, 27)).
insert into escala_semanal (semana_ref, usuario_id, turno) values (tests.sabado(6, 27), :'sergio_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'sergio_id', tests.sabado(6, 27), tests.sabado(6, 27) + 3, 'APROVADA');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'sergio_id', tests.sabado(6, 27) + 4, tests.sabado(6, 27) + 6, 'APROVADA');
select throws_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = tests.sabado(6, 27) $f$, :'sergio_id'),
    'P0001',
    'Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.',
    'dois registos de férias não contíguos que juntos cobrem os 7 dias também bloqueiam (validação dia a dia, não por registo)'
);

-- (e) sem qualquer férias, a mudança de turno continua a funcionar
-- normalmente — não-regressão do caminho mais comum. Semana própria
-- (tests.sabado(6, 6)).
insert into escala_semanal (semana_ref, usuario_id, turno) values (tests.sabado(6, 6), :'leonardo_id', 'H4');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H1' where usuario_id = %L and semana_ref = tests.sabado(6, 6) $f$, :'leonardo_id'),
    'sem férias nenhuma, a mudança de turno continua a funcionar sem qualquer bloqueio (não-regressão)'
);

select * from finish();
rollback;
