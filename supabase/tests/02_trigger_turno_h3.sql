begin;
select plan(3);

select tests.criar_usuario('Kilson Júnior', 'kilson@teste.pt', 'OPERADOR_H3') as kilson_id \gset
select tests.criar_usuario('Leonardo Madruga', 'leonardo@teste.pt', 'OPERADOR') as leonardo_id \gset
select tests.criar_usuario('Gerente Teste', 'gerente@teste.pt', 'GERENTE') as gerente_id \gset

select lives_ok(
    $$ insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-07-30', :'kilson_id', 'H3') $$,
    'OPERADOR_H3 ativo pode ser escalado para H3'
);

select throws_ok(
    $$ insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-07-30', :'leonardo_id', 'H3') $$,
    'P0001',
    'Só utilizadores com perfil OPERADOR_H3 (ativos) podem ser escalados para H3.',
    'perfil OPERADOR não pode ser escalado para H3 — só H1/H2/H4'
);

select lives_ok(
    $$ insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-07-30', :'leonardo_id', 'H1') $$,
    'perfil OPERADOR pode ser escalado para H1/H2/H4 normalmente'
);

select * from finish();
rollback;
