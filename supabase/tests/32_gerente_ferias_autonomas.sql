begin;
select plan(15);

-- Isola as datas deste teste sem deixar qualquer alteração persistente.
delete from ferias
where data_inicio <= tests.dia(12, 31)
  and data_fim >= tests.dia(1, 1);

create temp table _gerente_ids on commit drop as
select
    tests.criar_usuario('Gerente Teste 32', 'gerente32@teste.pt', 'GERENTE') as gerente_id,
    tests.criar_usuario('Colega A Teste 32', 'colega-a32@teste.pt', 'OPERADOR') as colega_a_id,
    tests.criar_usuario('Colega B Teste 32', 'colega-b32@teste.pt', 'OPERADOR') as colega_b_id,
    tests.criar_usuario('Colega C Teste 32', 'colega-c32@teste.pt', 'OPERADOR') as colega_c_id,
    tests.criar_usuario('Delegado Teste 32', 'delegado32@teste.pt', 'OPERADOR') as delegado_id;
grant select on _gerente_ids to authenticated;

-- Uma ausência já aprovada de outra pessoa não impede as férias próprias
-- do Gerente: a inscrição do Gerente nasce aprovada com autoria e data.
select tests.autenticar_como((select colega_a_id from _gerente_ids));
insert into ferias (usuario_id, data_inicio, data_fim, tipo)
values ((select colega_a_id from _gerente_ids), tests.segunda(12, 1), tests.segunda(12, 1), 'FERIAS')
;

select tests.autenticar_como((select gerente_id from _gerente_ids));
update ferias
   set status = 'APROVADA', aprovado_por = (select gerente_id from _gerente_ids), data_aprovacao = clock_timestamp()
 where usuario_id = (select colega_a_id from _gerente_ids) and data_inicio = tests.segunda(12, 1);

select lives_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids), tests.segunda(12, 1), tests.segunda(12, 1)),
    'o Gerente pode marcar férias sobrepostas às férias aprovadas de um colega'
);
select is(
    (select status::text from ferias where usuario_id = (select gerente_id from _gerente_ids) and data_inicio = tests.segunda(12, 1)),
    'APROVADA',
    'as férias do Gerente ficam aprovadas no momento do registo'
);
select ok(
    (select aprovado_por is null from ferias where usuario_id = (select gerente_id from _gerente_ids) and data_inicio = tests.segunda(12, 1)),
    'o registo automático não atribui uma aprovação a outra pessoa'
);
select ok(
    (select data_aprovacao is not null from ferias where usuario_id = (select gerente_id from _gerente_ids) and data_inicio = tests.segunda(12, 1)),
    'a aprovação automática regista a data em que as férias foram marcadas'
);
select throws_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids), tests.segunda(12, 1), tests.segunda(12, 1)),
    'P0001',
    'Já tens um pedido de férias/licença teu sobreposto a este período.',
    'o Gerente continua impedido de sobrepor férias suas'
);

-- Um pedido de colega ainda pendente continua a bloquear o Gerente.
select tests.autenticar_como((select colega_b_id from _gerente_ids));
insert into ferias (usuario_id, data_inicio, data_fim, tipo)
values ((select colega_b_id from _gerente_ids), tests.segunda(12, 8), tests.segunda(12, 8), 'FERIAS');
select tests.autenticar_como((select gerente_id from _gerente_ids));
select throws_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids), tests.segunda(12, 8), tests.segunda(12, 8)),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'um pedido pendente de colega continua a bloquear o Gerente'
);

-- A exceção é apenas para FERIAS, não para uma licença aprovada.
select tests.autenticar_como((select colega_c_id from _gerente_ids));
insert into ferias (usuario_id, data_inicio, data_fim, tipo)
values ((select colega_c_id from _gerente_ids), tests.segunda(12, 15), tests.segunda(12, 15), 'LICENCA')
;
select tests.autenticar_como((select gerente_id from _gerente_ids));
update ferias
   set status = 'APROVADA', aprovado_por = (select gerente_id from _gerente_ids), data_aprovacao = clock_timestamp()
 where usuario_id = (select colega_c_id from _gerente_ids) and data_inicio = tests.segunda(12, 15);
select throws_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids), tests.segunda(12, 15), tests.segunda(12, 15)),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'uma licença aprovada de colega continua a bloquear as férias do Gerente'
);

-- O delegado não recebe a exceção do perfil GERENTE.
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values ((select gerente_id from _gerente_ids), (select delegado_id from _gerente_ids), current_date - 1, current_date + 1);
select tests.autenticar_como((select delegado_id from _gerente_ids));
select throws_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select delegado_id from _gerente_ids), tests.segunda(12, 1), tests.segunda(12, 1)),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'o delegado continua bloqueado pelas férias aprovadas do colega'
);
select lives_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select delegado_id from _gerente_ids), tests.segunda(12, 1) - 7, tests.segunda(12, 1) - 7),
    'o delegado pode submeter férias próprias sem conflito'
);
select is(
    (select status::text from ferias where usuario_id = (select delegado_id from _gerente_ids) and data_inicio = tests.segunda(12, 1) - 7),
    'PENDENTE',
    'as férias do delegado continuam a aguardar aprovação'
);

-- A exceção não remove a precedência do período aprovado do Gerente para
-- os restantes colegas.
select tests.autenticar_como((select gerente_id from _gerente_ids));
select lives_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids), tests.segunda(12, 22), tests.segunda(12, 22)),
    'o Gerente também pode registar outro período próprio sem sobreposição'
);
select tests.autenticar_como((select colega_a_id from _gerente_ids));
select throws_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select colega_a_id from _gerente_ids), tests.segunda(12, 22), tests.segunda(12, 22)),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'as férias aprovadas do Gerente continuam a bloquear sobreposição para colegas'
);

-- O Gerente não está sujeito ao limite anual de 22 dias; a regra de ano
-- continua a aplicar-se mesmo às férias aprovadas automaticamente.
select tests.autenticar_como((select gerente_id from _gerente_ids));
select lives_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids), tests.segunda(1, 1), tests.segunda(1, 1) + 25),
    'o Gerente pode registar um período de 20 dias úteis sem aprovação externa'
);
select lives_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids), tests.segunda(2, 1), tests.segunda(2, 1)),
    'o Gerente pode ultrapassar 22 dias úteis de férias no mesmo ano'
);
select throws_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo) values (%L, %L, %L, 'FERIAS')$f$,
           (select gerente_id from _gerente_ids),
           make_date(extract(year from current_date)::int + 1, 2, 1),
           make_date(extract(year from current_date)::int + 1, 2, 1)),
    'P0001',
    'Só é possível pedir férias/licença para o ano corrente; em dezembro, apenas férias com início em janeiro do ano seguinte.',
    'a exceção do Gerente ao limite de dias não remove as regras de ano'
);

select * from finish();
rollback;
