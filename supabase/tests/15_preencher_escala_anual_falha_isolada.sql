begin;
select plan(6);

-- Isto corre contra uma base com dados reais — limpa temporariamente,
-- só dentro desta transação (revertida no fim), qualquer escala ou
-- férias reais que possam colidir com os casos abaixo.
delete from escala_semanal where extract(year from semana_ref) = 2027;
delete from ferias where data_inicio = '2026-12-28' and data_fim = '2027-01-08';

-- CASO A: caminho feliz — não-regressão do Achado #1 (312 linhas,
-- mesmo resultado de sempre quando não há nenhuma semana problemática).
savepoint antes_caso_a;

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'caminho feliz continua sem rebentar depois do isolamento por semana'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027),
    312,
    'sem nenhuma semana problemática, continua a gerar as mesmas 312 linhas do Achado #1'
);

rollback to savepoint antes_caso_a;

-- CASO B: mesmo cenário real do stress-test original (férias
-- aprovadas a cobrir por completo a 1a semana de 2027) — antes desta
-- migração fazia o ano inteiro falhar (0 linhas); agora só essa
-- semana falha, as outras 51 são geradas com sucesso.
savepoint antes_caso_b;

select id as bruno_id from usuarios where nome = 'Bruno' and perfil = 'OPERADOR_H3' and ativo \gset
insert into ferias (usuario_id, data_inicio, data_fim, status, tipo)
values (:'bruno_id', '2026-12-28', '2027-01-08', 'APROVADA', 'FERIAS');

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'com 1 semana problemática (férias a cobrir a semana toda), não rebenta'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027),
    306,
    '51 das 52 semanas são geradas com sucesso (306 = 51 x 6) — só a semana problemática falha, não o ano inteiro'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027 and semana_ref = '2027-01-02'),
    0,
    'a 1a semana (a que tinha o conflito) fica mesmo vazia, sem meia-semana gerada — falha atómica por semana'
);
select is(
    (select acao from logs_auditoria where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    'PREENCHIMENTO_AUTOMATICO_ERRO',
    'falha parcial fica classificada ERRO, não sucesso — mantém o Achado #1 coerente (AlertBar continua a avisar)'
);

rollback to savepoint antes_caso_b;

select * from finish();
rollback;
