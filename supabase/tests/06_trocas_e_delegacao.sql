begin;
select plan(7);

select tests.criar_usuario('Bruno Diniz', 'bruno4@teste.pt', 'OPERADOR_H3') as bruno_id \gset
select tests.criar_usuario('Kilson Júnior', 'kilson4@teste.pt', 'OPERADOR_H3') as kilson_id \gset
select tests.criar_usuario('Leonardo Madruga', 'leonardo4@teste.pt', 'OPERADOR') as leonardo_id \gset
select tests.criar_usuario('Gerente Teste', 'gerente4@teste.pt', 'GERENTE') as gerente_id \gset

insert into escala_semanal (semana_ref, usuario_id, turno) values ('2026-08-06', :'bruno_id', 'H3');

-- O substituto de uma troca tem de ser OPERADOR_H3
select throws_ok(
    $$ insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref) values (:'bruno_id', :'leonardo_id', '2026-08-06') $$,
    'P0001',
    'O substituto de uma troca de H3 tem de ter perfil OPERADOR_H3 e estar ativo.',
    'não é possível propor um OPERADOR comum (não-H3) como substituto numa troca'
);

insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref)
values (:'bruno_id', :'kilson_id', '2026-08-06') returning id as troca_id \gset

select is((select status from trocas_escala where id = :'troca_id'), 'PROPOSTA'::status_troca,
    'troca nasce em estado PROPOSTA, simplificado (sem passo de aceite do colega)');

-- Aprovar a troca deve refletir-se imediatamente na escala_semanal
update trocas_escala set status = 'APROVADA', aprovado_por = :'gerente_id' where id = :'troca_id';

select is(
    (select usuario_id from escala_semanal where semana_ref = '2026-08-06' and turno = 'H3'),
    :'kilson_id',
    'aprovar a troca substitui automaticamente o operador H3 dessa semana na escala'
);
select is(
    (select count(*)::int from escala_semanal where semana_ref = '2026-08-06' and turno = 'H3' and usuario_id = :'bruno_id'),
    0,
    'o proponente original deixa de constar como H3 dessa semana depois da troca aprovada'
);

-- Delegação: aditiva, sem sobreposição
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'gerente_id', :'bruno_id', '2026-09-01', '2026-09-10');

select throws_ok(
    $$ insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
       values (:'gerente_id', :'kilson_id', '2026-09-05', '2026-09-15') $$,
    'P0001',
    'Já existe uma delegação de aprovação ativa nesse período.',
    'não é possível criar duas delegações com janelas sobrepostas'
);

-- Confirma que a leitura de is_gerente_ou_delegado() reconhece o substituto
-- dentro da janela da delegação, mantendo o titular com poder também.
select tests.autenticar_como(:'bruno_id');
select ok(is_gerente_ou_delegado(), 'substituto dentro da janela de delegação passa a ter poderes de Gerente');

select tests.autenticar_como(:'gerente_id');
select ok(is_gerente_ou_delegado(), 'o Gerente titular mantém sempre o seu próprio poder de aprovar, mesmo com delegação ativa');

select * from finish();
rollback;
