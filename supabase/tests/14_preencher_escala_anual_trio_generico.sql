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

-- CASO A: trio real (Bruno/Caique/Kilson), estado de hoje — confirma
-- que a generalização reproduz exatamente o resultado do stress-test
-- original (2026-08-27): 6 linhas por semana (312 em 52 semanas), sem
-- anomalias de H3.
savepoint antes_caso_a;

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'caminho feliz com o trio real (Bruno/Caique/Kilson) não rebenta'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte()),
    tests.semanas_ano_seguinte() * 6,
    'gera 6 linhas por semana do ano seguinte com o trio real (H3+H2+H4 do trio, H1 Sergio, H4 Leonardo+Gerente)'
);
select is(
    (select count(*)::int from (
        select semana_ref from escala_semanal
         where extract(year from semana_ref) = tests.ano_seguinte() and turno = 'H3'
         group by semana_ref having count(*) <> 1
    ) t),
    0,
    'exatamente 1 H3 por semana no ano seguinte, sem anomalias'
);

rollback to savepoint antes_caso_a;

-- CASO B: só 2 ativos em OPERADOR_H3 (Kilson desativado dentro da
-- transação) — confirma que a falha continua controlada (sem
-- exceção) mas agora com mensagem genérica por contagem, não por nome.
savepoint antes_caso_b;

update usuarios set ativo = false where nome = 'Kilson' and perfil = 'OPERADOR_H3';

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'com só 2 OPERADOR_H3 ativos, não rebenta — falha controlada'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte()),
    0,
    'com só 2 ativos, não gera nenhuma linha para o ano seguinte'
);
select is(
    (select descricao_detalhada from logs_auditoria where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    format('Só 2 OPERADOR_H3 ativo(s) ao preencher %s — mínimo de 3 para rodar H3/H2/H4. Preenchimento não avançou.', tests.ano_seguinte()),
    'regista a mensagem nova, por contagem, não mais por nome hardcoded'
);

rollback to savepoint antes_caso_b;

-- CASO C: 5 ativos (3 reais + 2 sintéticos, nenhum elegível a H2) —
-- confirma que a rotação generaliza para mais de 3 pessoas e que
-- elegivel_h2 é respeitado: os 2 novos nunca ocupam H2.
savepoint antes_caso_c;

select tests.criar_usuario('Quarto Teste', 'quarto.teste@x.pt', 'OPERADOR_H3') as quarto_id \gset
select tests.criar_usuario('Quinto Teste', 'quinto.teste@x.pt', 'OPERADOR_H3') as quinto_id \gset

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'com 5 OPERADOR_H3 ativos (2 sintéticos, não elegíveis a H2), não rebenta'
);
select is(
    (select count(*)::int from escala_semanal
      where extract(year from semana_ref) = tests.ano_seguinte()
        and usuario_id in (:'quarto_id', :'quinto_id')
        and turno = 'H2'),
    0,
    'os 2 novos, sem elegivel_h2, nunca aparecem em H2 no ano inteiro'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = tests.ano_seguinte()),
    tests.semanas_ano_seguinte() * 8,
    'com 5 candidatos, gera 8 linhas por semana do ano seguinte (H3+H2+3xH4 do pool de 5, H1 Sergio, H4 Leonardo+Gerente)'
);

rollback to savepoint antes_caso_c;

select * from finish();
rollback;
