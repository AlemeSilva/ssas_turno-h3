begin;
select plan(8);

-- Isto corre contra uma base com dados reais (não só num Postgres
-- local vazio) — limpa temporariamente, só dentro desta transação
-- (revertida no fim, nunca commitada), qualquer férias/escala real do
-- ano corrente que possa colidir com as datas usadas abaixo. Todas são
-- do ano corrente e calculadas (tests.dia/tests.segunda, 00_helpers.sql):
-- trg_valida_ferias só aceita férias do ano em curso.
delete from ferias where data_inicio <= tests.dia(12, 31) and data_fim >= tests.dia(1, 1);
delete from escala_semanal where semana_ref between tests.dia(1, 1) and tests.dia(12, 31);

select tests.criar_usuario('Bruno Diniz', 'bruno@teste.pt', 'OPERADOR_H3') as bruno_id \gset
select tests.criar_usuario('Kilson Júnior', 'kilson@teste.pt', 'OPERADOR_H3') as kilson_id \gset

-- (a) sem sobreposição entre colegas diferentes — desde a migração
-- 0044 aplica-se a QUALQUER par de colegas, não só entre OPERADOR_H3
-- (requisito original do projeto, reafirmado pelo Gerente em 2026-09-06).
select lives_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.dia(8, 10), tests.dia(8, 14)) $f$, :'bruno_id'),
    'primeiro pedido de férias insere sem problema'
);

select throws_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.dia(8, 12), tests.dia(8, 16)) $f$, :'kilson_id'),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'colega H3 diferente com período sobreposto é bloqueado, mesmo os dois em PENDENTE'
);

select lives_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.dia(8, 20), tests.dia(8, 24)) $f$, :'kilson_id'),
    'período sem sobreposição real é aceite normalmente'
);

-- (a2) a mesma regra vale para qualquer par de colegas, não só H3 —
-- comportamento novo desde 0044, é a mudança de alcance em si.
select tests.criar_usuario('Pedro Nascimento', 'pedro3@teste.pt', 'OPERADOR') as pedro_id \gset
select throws_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.dia(8, 13), tests.dia(8, 15)) $f$, :'pedro_id'),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'um Operador comum sobreposto a um Operador H3 também é bloqueado — a regra deixou de ser só entre H3'
);
select lives_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.dia(9, 1), tests.dia(9, 3)) $f$, :'pedro_id'),
    'sem sobreposição real, o Operador comum insere normalmente'
);

-- (b) saldo anual de 22 dias úteis (soma de PENDENTE + APROVADA) — o
-- primeiro pedido tem de estar APROVADA (não PENDENTE) antes do
-- segundo, porque desde a migração 0016 só se pode ter um pedido
-- PENDENTE de cada vez por pessoa (regra testada à parte, abaixo).
-- Ambos os blocos começam numa segunda-feira e acabam numa sexta (4
-- semanas = 20 dias úteis, depois 1 semana = 5): o saldo conta dias
-- úteis, por isso o dia da semana de uma data fixa mudava o resultado
-- de um ano para o outro.
select tests.criar_usuario('Caique Araújo', 'caique@teste.pt', 'OPERADOR_H3') as caique_id \gset
select lives_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.segunda(1, 5), tests.segunda(1, 5) + 25) $f$, :'caique_id'),
    'primeiro grande bloco de férias (dentro do saldo de 22 dias úteis) é aceite'
);
update ferias set status = 'APROVADA' where usuario_id = :'caique_id';
select throws_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.segunda(11, 2), tests.segunda(11, 2) + 4) $f$, :'caique_id'),
    'P0001',
    'Este pedido ultrapassa o saldo anual de 22 dias úteis de férias.',
    'segundo pedido no mesmo ano civil que ultrapasse 22 dias úteis (somando o já aprovado) é bloqueado'
);

-- (c) um segundo pedido PENDENTE da mesma pessoa é sempre bloqueado,
-- mesmo sem qualquer sobreposição de datas — regra adicionada na
-- migração 0016, substitui o antigo "bloqueia se já há escala
-- atribuída" (migração 0017 removeu essa verificação deliberadamente:
-- o mecanismo de substituto passou a tratar a cobertura em vez de
-- impedir o pedido à partida — decisão do Gerente, 2026-08-03).
select tests.criar_usuario('Sérgio Gomes', 'sergio@teste.pt', 'OPERADOR') as sergio_id \gset
insert into ferias (usuario_id, data_inicio, data_fim) values (:'sergio_id', tests.dia(9, 5), tests.dia(9, 6));
select throws_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, tests.dia(10, 10), tests.dia(10, 11)) $f$, :'sergio_id'),
    'P0001',
    'Já tens um pedido pendente — aguarda que seja decidido antes de submeter outro.',
    'um segundo pedido PENDENTE da mesma pessoa é sempre bloqueado, mesmo sem sobreposição de datas'
);

select * from finish();
rollback;
