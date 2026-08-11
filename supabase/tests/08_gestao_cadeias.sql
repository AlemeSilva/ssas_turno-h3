begin;
select plan(5);

select tests.criar_usuario('Gerente Teste', 'gerente6@teste.pt', 'GERENTE') as gerente_id \gset
select tests.autenticar_como(:'gerente_id');

-- Adicionar uma cadeia nova (situação rara, mas prevista)
select lives_ok(
    $$ insert into cadeias_catalogo (nome_cadeia, categoria, ordem) values ('SD_NOVA', 'NORMAL', 19) $$,
    'Gerente consegue adicionar uma cadeia nova ao catálogo'
);

-- Desativar (nunca apagar) é o caminho correto
update cadeias_catalogo set ativo = false where nome_cadeia = 'SD_NOVA';
select is((select ativo from cadeias_catalogo where nome_cadeia = 'SD_NOVA'), false,
    'desativar uma cadeia sem histórico funciona normalmente');

-- Sem histórico, pode mesmo ser apagada
select lives_ok(
    $$ delete from cadeias_catalogo where nome_cadeia = 'SD_NOVA' $$,
    'uma cadeia sem qualquer histórico em cadeias_diarias pode ser apagada'
);

-- Com histórico, o apagar é fisicamente impedido pelo trigger — só
-- resta desativar. Cadeia de teste própria (não uma real do catálogo,
-- tipo 'SD_FL', que já tem histórico real acumulado) para a contagem
-- abaixo não colidir com linhas de produção.
insert into cadeias_catalogo (nome_cadeia, categoria, ordem) values ('SD_TESTE_HIST', 'NORMAL', 98);
insert into planos (data_inicio_ciclo, criado_por) values ('2099-09-03', :'gerente_id') returning id as plano_id \gset
insert into cadeias_diarias (id_plano, secao, data, nome_cadeia) values (:'plano_id', 'BATCH_SAB_DOM', '2099-09-05', 'SD_TESTE_HIST');

select throws_ok(
    $$ delete from cadeias_catalogo where nome_cadeia = 'SD_TESTE_HIST' $$,
    'P0001',
    'Esta cadeia já tem histórico registado — desative-a (ativo=false) em vez de a apagar.',
    'uma cadeia com histórico em cadeias_diarias nunca pode ser apagada, só desativada'
);

update cadeias_catalogo set ativo = false where nome_cadeia = 'SD_TESTE_HIST';
select is((select count(*)::int from cadeias_diarias where nome_cadeia = 'SD_TESTE_HIST'), 1,
    'desativar a cadeia preserva o registo histórico intacto em cadeias_diarias');

select * from finish();
rollback;
