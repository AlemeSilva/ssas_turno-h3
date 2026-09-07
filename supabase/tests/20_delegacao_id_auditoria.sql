-- =====================================================================
-- Migração 0043 (dossiê de segurança): logs_auditoria.delegacao_id
-- passa a preencher-se sozinha, via trigger, sempre que quem escreve
-- está a agir nesse momento como substituto de uma delegação ativa —
-- sem alterar nenhuma das funções que já escrevem em logs_auditoria.
-- =====================================================================
begin;
select plan(4);

select tests.criar_usuario('Gerente Vinte', 'gerente20@teste.pt', 'GERENTE') as gerente_id \gset
select tests.criar_usuario('Bruno Vinte', 'bruno20@teste.pt', 'OPERADOR_H3') as bruno_id \gset
select tests.criar_usuario('Leonardo Vinte', 'leonardo20@teste.pt', 'OPERADOR') as leonardo_id \gset

-- Mesma limpeza pontual já usada em 06_trocas_e_delegacao.sql — só
-- dentro desta transação, revertida no fim.
delete from delegacoes_aprovacao where data_inicio <= current_date + 30 and data_fim >= current_date - 30;
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'gerente_id', :'bruno_id', current_date - 2, current_date + 2) returning id as delegacao_id \gset

-- 1) Bruno, a agir como substituto agora, escreve um log — fica ligado
-- à delegação ativa automaticamente, sem precisar de o indicar.
select tests.autenticar_como(:'bruno_id');
insert into logs_auditoria (referencia_tipo, id_usuario, acao) values ('USUARIO', :'bruno_id', 'PASSWORD_ALTERADA_PROPRIA') returning id as log_bruno_id \gset
select is(
    (select delegacao_id from logs_auditoria where id = :'log_bruno_id')::text, :'delegacao_id',
    'log escrito por um substituto em exercício fica automaticamente ligado à delegação ativa'
);

-- 2) O próprio Gerente titular não é "substituto de si próprio" — o seu
-- log fica sem delegacao_id, mesmo com uma delegação ativa em curso.
select tests.autenticar_como(:'gerente_id');
insert into logs_auditoria (referencia_tipo, id_usuario, acao) values ('USUARIO', :'gerente_id', 'PASSWORD_ALTERADA_PROPRIA') returning id as log_gerente_id \gset
select is(
    (select delegacao_id from logs_auditoria where id = :'log_gerente_id'), null,
    'log escrito pelo próprio titular fica sem delegacao_id, mesmo com uma delegação ativa em curso'
);

-- 3) Alguém que nunca foi substituto de nenhuma delegação — log sem
-- delegacao_id, o caso comum, sem regressão. (Não reutiliza a
-- delegação de bruno_id apagando-a: o log do passo 1 já ficou ligado a
-- ela pela FK, e um DELETE aqui violaria logs_auditoria_delegacao_id_fkey
-- — precisamente a prova de que o preenchimento automático funcionou.)
select tests.autenticar_como(:'leonardo_id');
insert into logs_auditoria (referencia_tipo, id_usuario, acao) values ('USUARIO', :'leonardo_id', 'PASSWORD_ALTERADA_PROPRIA') returning id as log_sem_delegacao_id \gset
select is(
    (select delegacao_id from logs_auditoria where id = :'log_sem_delegacao_id'), null,
    'alguém que nunca foi substituto de nenhuma delegação escreve um log sem delegacao_id'
);

-- 4) Migração 0046 (achado do stress-test de 2026-09-07): Leonardo, sem
-- qualquer delegação ativa, fornece explicitamente o delegacao_id real
-- de Bruno no próprio insert — tem de ser ignorado, não honrado. O
-- valor gravado tem de ser o mesmo do caso 3 (null, calculado no
-- servidor), nunca o valor falsificado pelo cliente.
select tests.autenticar_como(:'leonardo_id');
insert into logs_auditoria (referencia_tipo, id_usuario, acao, delegacao_id)
values ('USUARIO', :'leonardo_id', 'PASSWORD_ALTERADA_PROPRIA', :'delegacao_id') returning id as log_falsificado_id \gset
select is(
    (select delegacao_id from logs_auditoria where id = :'log_falsificado_id'), null,
    'um delegacao_id fornecido pelo próprio cliente é ignorado — o servidor recalcula sempre, nunca aceita o valor enviado'
);

select * from finish();
rollback;
