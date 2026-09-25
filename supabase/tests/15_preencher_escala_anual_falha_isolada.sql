begin;
select plan(6);

-- Isto corre contra uma base com dados reais — limpa temporariamente,
-- só dentro desta transação (revertida no fim), qualquer escala ou
-- férias reais que possam colidir com os casos abaixo. O ano seguinte
-- (o que preencher_escala_anual() gera), o número das suas semanas (os
-- sábados: 52 ou 53) e o primeiro sábado vêm de tests.ano_seguinte()/
-- semanas_ano_seguinte()/primeiro_sabado_ano_seguinte() (00_helpers.sql)
-- — datas e contagens fixas partiam a 1 de janeiro.
delete from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte();
delete from ferias
 where data_inicio <= tests.primeiro_sabado_ano_seguinte() + 6
   and data_fim >= make_date(tests.ano_seguinte() - 1, 12, 28);

-- CASO A: caminho feliz — não-regressão do Achado #1 (6 linhas por
-- semana, mesmo resultado de sempre quando não há nenhuma semana
-- problemática).
savepoint antes_caso_a;

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'caminho feliz continua sem rebentar depois do isolamento por semana'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte()),
    tests.semanas_ano_seguinte() * 6,
    'sem nenhuma semana problemática, continua a gerar as mesmas 6 linhas por semana do Achado #1'
);

rollback to savepoint antes_caso_a;

-- CASO B: mesmo cenário real do stress-test original (férias
-- aprovadas, de 28/12 até 6 dias depois do primeiro sábado do ano
-- seguinte, a cobrir por completo a 1a semana desse ano) — antes desta
-- migração fazia o ano inteiro falhar (0 linhas); agora só essa semana
-- falha, as outras são geradas com sucesso.
savepoint antes_caso_b;

select id as bruno_id from usuarios where nome = 'Bruno' and perfil = 'OPERADOR_H3' and ativo \gset
insert into ferias (usuario_id, data_inicio, data_fim, status, tipo)
values (:'bruno_id', make_date(tests.ano_seguinte() - 1, 12, 28), tests.primeiro_sabado_ano_seguinte() + 6, 'APROVADA', 'FERIAS');

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'com 1 semana problemática (férias a cobrir a semana toda), não rebenta'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte()),
    (tests.semanas_ano_seguinte() - 1) * 6,
    'todas as semanas menos uma são geradas com sucesso (6 linhas cada) — só a semana problemática falha, não o ano inteiro'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte() and semana_ref = tests.primeiro_sabado_ano_seguinte()),
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
