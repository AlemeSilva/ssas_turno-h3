begin;
select plan(9);

-- Migração 0061: o semana_ref de uma troca de H3 é sempre o SÁBADO em que a
-- semana começa (a escala é ao sábado — CRITERIOS_FUNCIONAIS.md). Datas de
-- 2099, longe de qualquer escala real (a suite corre contra uma base com
-- dados reais, dentro de uma transação revertida): 2099-08-08 é sábado, o
-- dia 06 é a quinta e o 07 a sexta antes dele; 2099-08-13 e 2099-08-20 são
-- quintas.

select tests.criar_usuario('Bruno 28', 'bruno28@teste.pt', 'OPERADOR_H3') as bruno_id \gset
select tests.criar_usuario('Kilson 28', 'kilson28@teste.pt', 'OPERADOR_H3') as kilson_id \gset
select tests.criar_usuario('Gerente 28', 'gerente28@teste.pt', 'GERENTE') as gerente_id \gset

-- Quinta (o rótulo do plano de fim de semana, que o formulário chegou a
-- pedir) e sexta (o dia em que o H3 se ativa, às 22h): a semana continua a
-- ser a do sábado seguinte, por isso nenhuma das duas serve.
select throws_ok(
    format($f$ insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref) values (%L, %L, '2099-08-06') $f$, :'bruno_id', :'kilson_id'),
    'P0001',
    'A semana de uma troca de H3 começa ao sábado — escolhe o sábado dessa semana.',
    'uma troca numa quinta é recusada'
);
select throws_ok(
    format($f$ insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref) values (%L, %L, '2099-08-07') $f$, :'bruno_id', :'kilson_id'),
    'P0001',
    'A semana de uma troca de H3 começa ao sábado — escolhe o sábado dessa semana.',
    'uma troca numa sexta é recusada — o H3 ativa-se às 22h dessa sexta, mas a semana é a do sábado seguinte'
);

select lives_ok(
    format($f$ insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref) values (%L, %L, '2099-08-08') $f$, :'bruno_id', :'kilson_id'),
    'uma troca no sábado é aceite'
);
select id as troca_id from trocas_escala where usuario_proponente = :'bruno_id' and semana_ref = '2099-08-08' \gset

select throws_ok(
    format($f$ update trocas_escala set semana_ref = '2099-08-06' where id = %L $f$, :'troca_id'),
    'P0001',
    'A semana de uma troca de H3 começa ao sábado — escolhe o sábado dessa semana.',
    'mudar a data de uma proposta para uma quinta é recusado'
);

-- A aprovação de uma troca de sábado continua a passar o H3 dessa semana.
select lives_ok(
    format($f$ update trocas_escala set status = 'APROVADA', aprovado_por = %L where id = %L $f$, :'gerente_id', :'troca_id'),
    'aprovar uma troca de sábado continua a funcionar'
);
select is(
    (select usuario_id from escala_semanal where semana_ref = '2099-08-08' and turno = 'H3'),
    :'kilson_id',
    'e o substituto fica com o H3 dessa semana'
);

-- Trocas antigas numa quinta (a #59, de 2026-10-15, é uma): só se criam com
-- os triggers desligados, como já existiam antes da migração.
set local session_replication_role = replica;
insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref, status, aprovado_por)
values (:'kilson_id', :'bruno_id', '2099-08-13', 'APROVADA', :'gerente_id') returning id as antiga_aprovada_id \gset
insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref)
values (:'kilson_id', :'bruno_id', '2099-08-20') returning id as antiga_proposta_id \gset
set local session_replication_role = origin;

select lives_ok(
    format($f$ update trocas_escala set justificativa = 'Troca antiga, registada numa quinta' where id = %L $f$, :'antiga_aprovada_id'),
    'uma troca antiga já aprovada numa quinta continua a poder ser editada'
);
select throws_ok(
    format($f$ update trocas_escala set status = 'APROVADA', aprovado_por = %L where id = %L $f$, :'gerente_id', :'antiga_proposta_id'),
    'P0001',
    'A semana de uma troca de H3 começa ao sábado — escolhe o sábado dessa semana.',
    'uma proposta antiga numa quinta já não pode ser aprovada'
);
select lives_ok(
    format($f$ update trocas_escala set status = 'REJEITADA', aprovado_por = %L where id = %L $f$, :'gerente_id', :'antiga_proposta_id'),
    'mas pode ser rejeitada'
);

select * from finish();
rollback;
