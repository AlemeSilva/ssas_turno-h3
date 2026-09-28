begin;
select plan(7);

select tests.criar_usuario('Zeta Um', 'zeta1-29@teste.pt', 'OPERADOR') as zeta_id \gset
select tests.criar_usuario('Zeta Gerente', 'zeta-gerente-29@teste.pt', 'GERENTE') as zeta_gerente_id \gset
select tests.criar_usuario('Zeta Bruno H3', 'zeta-bruno-29@teste.pt', 'OPERADOR_H3') as bruno_id \gset
select tests.criar_usuario('Zeta Kilson H3', 'zeta-kilson-29@teste.pt', 'OPERADOR_H3') as kilson_id \gset

-- FÉRIAS: o caso normal continua a funcionar ---------------------------
select tests.autenticar_como(:'zeta_id');
insert into ferias (usuario_id, data_inicio, data_fim, tipo)
values (:'zeta_id', current_date + 10, current_date + 12, 'FERIAS') returning id as ferias_zeta_id \gset

select tests.autenticar_como(:'zeta_gerente_id');
update ferias set status = 'APROVADA', aprovado_por = :'zeta_gerente_id' where id = :'ferias_zeta_id';
select is((select status::text from ferias where id = :'ferias_zeta_id'), 'APROVADA',
    'Gerente continua a poder aprovar o pedido de outra pessoa');

-- FÉRIAS: ninguém decide o próprio --------------------------------------
insert into ferias (usuario_id, data_inicio, data_fim, tipo)
values (:'zeta_gerente_id', current_date + 20, current_date + 22, 'FERIAS') returning id as ferias_gerente_id \gset

select throws_ok(
    format($f$update ferias set status = 'APROVADA', aprovado_por = %L where id = %L$f$, :'zeta_gerente_id', :'ferias_gerente_id'),
    'P0001',
    'Não podes decidir (aprovar/rejeitar) o teu próprio pedido de férias/licença — pede a outro Gerente ou delegado.',
    'o Gerente titular não pode aprovar o seu próprio pedido de férias'
);

select tests.autenticar_como(:'kilson_id');
select throws_ok(
    format($f$insert into ferias (usuario_id, data_inicio, data_fim, tipo, status) values (%L, current_date + 30, current_date + 31, 'FERIAS', 'APROVADA')$f$, :'kilson_id'),
    'P0001',
    'Não podes decidir (aprovar/rejeitar) o teu próprio pedido de férias/licença — pede a outro Gerente ou delegado.',
    'não nasce já APROVADA um pedido inserido pelo próprio'
);

-- FÉRIAS: um delegado decide o pedido do titular (continua a funcionar) --
select tests.autenticar_como(:'zeta_gerente_id');
delete from delegacoes_aprovacao where data_inicio <= current_date + 30 and data_fim >= current_date - 30;
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'zeta_gerente_id', :'bruno_id', current_date - 1, current_date + 1);

select tests.autenticar_como(:'bruno_id');
update ferias set status = 'REJEITADA', aprovado_por = :'bruno_id' where id = :'ferias_gerente_id';
select is((select status::text from ferias where id = :'ferias_gerente_id'), 'REJEITADA',
    'um delegado consegue decidir o pedido do próprio titular');

-- TROCAS: o caso normal continua a funcionar -----------------------------
select tests.autenticar_como(:'zeta_gerente_id');
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2099-08-08', :'bruno_id', 'H3');

select tests.autenticar_como(:'bruno_id');
insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref)
values (:'bruno_id', :'kilson_id', '2099-08-08') returning id as troca_normal_id \gset

select tests.autenticar_como(:'zeta_gerente_id');
update trocas_escala set status = 'APROVADA', aprovado_por = :'zeta_gerente_id' where id = :'troca_normal_id';
select is((select status::text from trocas_escala where id = :'troca_normal_id'), 'APROVADA',
    'Gerente continua a poder aprovar a troca de outra pessoa');

-- TROCAS: um delegado que é o próprio proponente não aprova a sua troca --
select tests.autenticar_como(:'kilson_id');
insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref)
values (:'kilson_id', :'bruno_id', '2099-08-15') returning id as troca_propria_id \gset

select tests.autenticar_como(:'zeta_gerente_id');
delete from delegacoes_aprovacao where data_inicio <= current_date + 30 and data_fim >= current_date - 30;
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'zeta_gerente_id', :'kilson_id', current_date - 1, current_date + 1);

select tests.autenticar_como(:'kilson_id');
select throws_ok(
    format($f$update trocas_escala set status = 'APROVADA', aprovado_por = %L where id = %L$f$, :'kilson_id', :'troca_propria_id'),
    'P0001',
    'Não podes decidir (aprovar/rejeitar) a tua própria troca de H3 — pede a outro Gerente ou delegado.',
    'um delegado que é o próprio proponente não pode aprovar a sua troca'
);

select throws_ok(
    format($f$insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref, status) values (%L, %L, '2099-08-22', 'APROVADA')$f$, :'kilson_id', :'bruno_id'),
    'P0001',
    'Não podes decidir (aprovar/rejeitar) a tua própria troca de H3 — pede a outro Gerente ou delegado.',
    'não nasce já APROVADA uma troca inserida pelo próprio proponente'
);

select * from finish();
rollback;
