begin;
select plan(6);

-- Isto corre contra uma base com dados reais — limpa temporariamente,
-- só dentro desta transação (revertida no fim), qualquer escala já
-- gravada para 2027 que possa colidir com os casos abaixo.
delete from escala_semanal where extract(year from semana_ref) = 2027;

-- CASO A: caminho feliz (1 Gerente ativo, estado real de hoje) —
-- não-regressão: 312 linhas, sem aviso.
savepoint antes_caso_a;

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'caminho feliz continua sem rebentar depois de escolher o Gerente titular'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027),
    312,
    'com 1 só Gerente ativo, continua a gerar as mesmas 312 linhas'
);
select is(
    (select acao from logs_auditoria where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    'PREENCHIMENTO_AUTOMATICO',
    'com 1 só Gerente ativo, o log fica limpo — sem aviso'
);

rollback to savepoint antes_caso_a;

-- CASO B: 2 Gerentes ativos em simultâneo (o real, mais antigo, e um
-- sintético criado agora) — só o mais antigo (o real) deve receber
-- H4; o sintético não deve aparecer nenhuma vez em H4; log AVISO a
-- mencionar 2 Gerentes.
savepoint antes_caso_b;

select id as gerente_real_id from usuarios where perfil = 'GERENTE' and ativo order by criado_em asc limit 1 \gset
select tests.criar_usuario('Gerente Sintético', 'gerente.sintetico@x.pt', 'GERENTE') as gerente_novo_id \gset

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'com 2 Gerentes ativos em simultâneo, não rebenta'
);
select is(
    (select count(*)::int from escala_semanal
      where extract(year from semana_ref) = 2027
        and usuario_id = :'gerente_real_id' and turno = 'H4'),
    52,
    'o Gerente mais antigo (o real) recebe H4 nas 52 semanas, como sempre'
);
select is(
    (select count(*)::int from escala_semanal
      where extract(year from semana_ref) = 2027
        and usuario_id = :'gerente_novo_id' and turno = 'H4'),
    0,
    'o Gerente sintético (mais recente) nunca recebe H4 — só o titular é automático'
);

rollback to savepoint antes_caso_b;

select * from finish();
rollback;
