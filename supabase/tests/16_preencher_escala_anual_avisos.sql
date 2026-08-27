begin;
select plan(9);

-- Isto corre contra uma base com dados reais — limpa temporariamente,
-- só dentro desta transação (revertida no fim), qualquer escala já
-- gravada para 2027 que possa colidir com os casos abaixo.
delete from escala_semanal where extract(year from semana_ref) = 2027;

-- CASO A: caminho feliz (estado real de hoje, nenhum pool vazio) —
-- não-regressão: 312 linhas, log continua PREENCHIMENTO_AUTOMATICO
-- puro, sem aviso nenhum.
savepoint antes_caso_a;

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'caminho feliz continua sem rebentar depois de introduzir os avisos'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027),
    312,
    'sem nenhum pool vazio, continua a gerar as mesmas 312 linhas'
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
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027),
    260,
    'sem H1 fixo, gera 260 linhas (52 semanas x 5 pessoas/semana: H3+H2+H4 do trio, H4 Leonardo+Gerente, sem H1)'
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
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027 and turno = 'H2'),
    0,
    'sem ninguém elegível, H2 fica mesmo vazio todas as 52 semanas'
);
select is(
    (select descricao_detalhada like '%H2%' from logs_auditoria
      where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    true,
    'o aviso menciona H2 especificamente, não só um texto genérico'
);

rollback to savepoint antes_caso_c;

select * from finish();
rollback;
