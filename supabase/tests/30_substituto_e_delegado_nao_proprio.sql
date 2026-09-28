begin;
select plan(4);

select tests.criar_usuario('Omega Ausente', 'omega-ausente-30@teste.pt', 'OPERADOR') as ausente_id \gset
select tests.criar_usuario('Omega Colega', 'omega-colega-30@teste.pt', 'OPERADOR') as colega_id \gset
select tests.criar_usuario('Omega Gerente', 'omega-gerente-30@teste.pt', 'GERENTE') as gerente_id \gset

select tests.autenticar_como(:'ausente_id');
insert into ferias (usuario_id, data_inicio, data_fim, tipo)
values (:'ausente_id', current_date + 10, current_date + 16, 'FERIAS') returning id as ferias_id \gset

select tests.autenticar_como(:'gerente_id');

-- Substituto normal (outra pessoa) continua a funcionar
insert into ferias_semanas (ferias_id, semana_inicio, substituto_id)
values (:'ferias_id', (date_trunc('week', current_date + 10)::date), :'colega_id')
returning id as semana_ok_id \gset
select is((select substituto_id from ferias_semanas where id = :'semana_ok_id'), :'colega_id',
    'substituto normal (outra pessoa) continua a poder ser gravado');

-- Substituto não pode ser a própria pessoa ausente
select throws_ok(
    format($f$insert into ferias_semanas (ferias_id, semana_inicio, substituto_id) values (%L, %L, %L)$f$,
        :'ferias_id', (date_trunc('week', current_date + 10)::date + 7), :'ausente_id'),
    'P0001',
    'O substituto de uma semana de férias/licença não pode ser a própria pessoa ausente.',
    'o substituto de uma semana de férias não pode ser a própria pessoa ausente'
);

-- Delegado normal (outra pessoa) continua a funcionar
delete from delegacoes_aprovacao where data_inicio <= current_date + 30 and data_fim >= current_date - 30;
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'gerente_id', :'colega_id', current_date - 1, current_date + 1)
returning id as delegacao_ok_id \gset
select is((select substituto from delegacoes_aprovacao where id = :'delegacao_ok_id'), :'colega_id',
    'delegar num colega diferente continua a funcionar');

-- Titular não se pode delegar a si mesmo
select throws_ok(
    format($f$insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim) values (%L, %L, current_date + 5, current_date + 6)$f$,
        :'gerente_id', :'gerente_id'),
    '23514',
    'new row for relation "delegacoes_aprovacao" violates check constraint "chk_delegacao_substituto_diferente"',
    'o titular não se pode delegar a si mesmo'
);

select * from finish();
rollback;
