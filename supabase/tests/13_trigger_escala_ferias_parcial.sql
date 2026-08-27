begin;
select plan(5);

-- Isto corre contra uma base com dados reais (não só num Postgres
-- local vazio) — limpa temporariamente, só dentro desta transação
-- (revertida no fim, nunca commitada), qualquer férias/escala real
-- que possa colidir com as datas fixas usadas abaixo.
delete from ferias where data_inicio <= '2026-12-31' and data_fim >= '2026-01-01';
delete from escala_semanal where semana_ref between '2026-01-01' and '2026-12-31';

-- Todos os utilizadores de teste como OPERADOR simples — deliberado,
-- para isolar esta trigger (trg_valida_escala_sobre_ferias, não olha a
-- perfil nenhum) de trg_valida_ferias, cuja validação de sobreposição
-- entre colegas só se aplica a OPERADOR_H3 e interferiria com os
-- cenários de múltiplas férias abaixo.
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
-- restantes dias.
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-08-29', :'bruno_id', 'H1');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'bruno_id', '2026-08-31', '2026-08-31', 'APROVADA');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = '2026-08-29' $f$, :'bruno_id'),
    '1 único dia de férias na semana não bloqueia a mudança de turno dos restantes dias'
);

-- (c) férias a cobrir a semana inteira (um só registo) continua a
-- bloquear — não sobra nenhum dia de trabalho para atribuir turno.
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-08-29', :'kilson_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'kilson_id', '2026-08-29', '2026-09-04', 'APROVADA');
select throws_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = '2026-08-29' $f$, :'kilson_id'),
    'P0001',
    'Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.',
    'férias a cobrir os 7 dias da semana (um só registo) continua a bloquear a mudança de turno'
);

-- (d) férias a cobrir a semana inteira através de DOIS registos não
-- contíguos (nenhum sozinho cobre a semana, mas juntos cobrem os 7
-- dias) também bloqueia — confirma que a validação é dia a dia
-- (união), não olha só para um registo de férias de cada vez.
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-08-29', :'sergio_id', 'H4');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'sergio_id', '2026-08-29', '2026-09-01', 'APROVADA');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'sergio_id', '2026-09-02', '2026-09-04', 'APROVADA');
select throws_ok(
    format($f$ update escala_semanal set turno = 'H2' where usuario_id = %L and semana_ref = '2026-08-29' $f$, :'sergio_id'),
    'P0001',
    'Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.',
    'dois registos de férias não contíguos que juntos cobrem os 7 dias também bloqueiam (validação dia a dia, não por registo)'
);

-- (e) sem qualquer férias, a mudança de turno continua a funcionar
-- normalmente — não-regressão do caminho mais comum.
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-08-29', :'leonardo_id', 'H4');
select lives_ok(
    format($f$ update escala_semanal set turno = 'H1' where usuario_id = %L and semana_ref = '2026-08-29' $f$, :'leonardo_id'),
    'sem férias nenhuma, a mudança de turno continua a funcionar sem qualquer bloqueio (não-regressão)'
);

select * from finish();
rollback;
