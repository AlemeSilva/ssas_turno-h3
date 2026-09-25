begin;
select plan(9);

-- Isto corre contra uma base com dados reais — limpa temporariamente,
-- só dentro desta transação (revertida no fim), qualquer escala já
-- gravada para o ano seguinte (o que preencher_escala_anual() gera) que
-- possa colidir com os casos abaixo. O ano seguinte, o número das suas
-- semanas (os sábados: 52 ou 53) e o primeiro sábado vêm de
-- tests.ano_seguinte()/semanas_ano_seguinte()/primeiro_sabado_ano_seguinte()
-- (00_helpers.sql) — um "2027" ou "312 linhas" fixo partia a 1 de janeiro.
delete from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte();

-- CASO A: caminho feliz (estado real de hoje, nenhum pool vazio) —
-- não-regressão: 6 linhas por semana, log continua
-- PREENCHIMENTO_AUTOMATICO puro, sem aviso nenhum.
savepoint antes_caso_a;

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'caminho feliz continua sem rebentar depois de introduzir os avisos'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte()),
    tests.semanas_ano_seguinte() * 6,
    'sem nenhum pool vazio, continua a gerar as mesmas 6 linhas por semana'
);
select is(
    (select acao from logs_auditoria where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    'PREENCHIMENTO_AUTOMATICO',
    'sem nenhum pool vazio, o log fica limpo — sem classificação de aviso'
);

rollback to savepoint antes_caso_a;

-- CASO B: ninguém com turno_fixo='H1' (Sergio temporariamente sem
-- turno fixo) — gera o ano na mesma, mas com aviso a mencionar H1.
savepoint antes_caso_b;

update usuarios set turno_fixo = null where nome = 'Sergio' and perfil = 'OPERADOR';

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'sem ninguém em H1 fixo, não rebenta — gera o ano na mesma'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte()),
    tests.semanas_ano_seguinte() * 5,
    'sem H1 fixo, gera 5 linhas por semana (H3+H2+H4 do trio, H4 Leonardo+Gerente, sem H1)'
);
select is(
    (select acao from logs_auditoria where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    'PREENCHIMENTO_AUTOMATICO_AVISO',
    'pool de H1 vazio fica classificado AVISO — gera na mesma, mas deixa de ser silencioso'
);

rollback to savepoint antes_caso_b;

-- CASO C: ninguém elegível para H2 (Bruno/Caique temporariamente sem
-- elegivel_h2) — gera o ano, H2 fica vazio todas as semanas, com
-- aviso a mencionar H2.
savepoint antes_caso_c;

update usuarios set elegivel_h2 = false where nome in ('Bruno', 'Caique') and perfil = 'OPERADOR_H3';

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'sem ninguém elegível para H2, não rebenta — gera o ano na mesma'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte() and turno = 'H2'),
    0,
    'sem ninguém elegível, H2 fica mesmo vazio todas as semanas'
);
select is(
    (select descricao_detalhada like '%H2%' from logs_auditoria
      where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    true,
    'o aviso menciona H2 especificamente, não só um texto genérico'
);

rollback to savepoint antes_caso_c;

-- Sem finish(): cada "rollback to savepoint" repõe também o estado interno
-- do pgTAP (os contadores), e finish() falharia com "No tests run!". O
-- plano (1..N) e as linhas ok/not ok já saíram por si.
rollback;
