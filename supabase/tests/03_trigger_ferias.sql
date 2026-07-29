begin;
select plan(6);

select tests.criar_usuario('Bruno Diniz', 'bruno@teste.pt', 'OPERADOR_H3') as bruno_id \gset
select tests.criar_usuario('Kilson Júnior', 'kilson@teste.pt', 'OPERADOR_H3') as kilson_id \gset

-- (a) sem sobreposição entre colegas diferentes
select lives_ok(
    $$ insert into ferias (usuario_id, data_inicio, data_fim) values (:'bruno_id', '2026-08-10', '2026-08-14') $$,
    'primeiro pedido de férias insere sem problema'
);

select throws_ok(
    $$ insert into ferias (usuario_id, data_inicio, data_fim) values (:'kilson_id', '2026-08-12', '2026-08-16') $$,
    'P0001',
    'Já existem férias pedidas/aprovadas de outro colega sobrepostas a este período.',
    'colega diferente com período sobreposto é bloqueado, mesmo os dois em PENDENTE'
);

select lives_ok(
    $$ insert into ferias (usuario_id, data_inicio, data_fim) values (:'kilson_id', '2026-08-20', '2026-08-24') $$,
    'período sem sobreposição real é aceite normalmente'
);

-- (b) saldo anual de 22 dias úteis (soma de PENDENTE + APROVADA)
select tests.criar_usuario('Caique Araújo', 'caique@teste.pt', 'OPERADOR_H3') as caique_id \gset
select lives_ok(
    $$ insert into ferias (usuario_id, data_inicio, data_fim) values (:'caique_id', '2026-01-05', '2026-01-30') $$,
    'primeiro grande bloco de férias (dentro do saldo de 22 dias úteis) é aceite'
);
select throws_ok(
    $$ insert into ferias (usuario_id, data_inicio, data_fim) values (:'caique_id', '2026-11-02', '2026-11-06') $$,
    'P0001',
    'Este pedido ultrapassa o saldo anual de 22 dias úteis de férias.',
    'segundo pedido no mesmo ano civil que ultrapasse 22 dias úteis é bloqueado'
);

-- (c) bloqueia se já há escala atribuída no período pedido
select tests.criar_usuario('Sérgio Gomes', 'sergio@teste.pt', 'OPERADOR') as sergio_id \gset
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-09-03', :'sergio_id', 'H1');
select throws_ok(
    $$ insert into ferias (usuario_id, data_inicio, data_fim) values (:'sergio_id', '2026-09-05', '2026-09-06') $$,
    'P0001',
    'Já existe escala atribuída a esta pessoa num período sobreposto a este pedido de férias.',
    'pedido de férias sobreposto a turno já escalado é bloqueado na submissão'
);

select * from finish();
rollback;
