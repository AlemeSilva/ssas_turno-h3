-- =====================================================================
-- Migração 0033: operadores H3 aprovam o plano do seu próprio ciclo,
-- não só o Gerente/delegado. planos_update passa a ter with check
-- (autoatribuição obrigatória do aprovador) e um trigger novo garante
-- que só se aprova a partir de Pendente de aprovação, nunca direto de
-- Rascunho — ver o comentário de correção na própria migração sobre
-- porque isto não pode ser feito só com duas políticas RLS separadas.
-- =====================================================================
begin;
select plan(12);

select tests.criar_usuario('Operador Doze A', 'operador12a@teste.pt', 'OPERADOR_H3') as operador_a_id \gset
select tests.criar_usuario('Operador Doze B', 'operador12b@teste.pt', 'OPERADOR_H3') as operador_b_id \gset
select tests.criar_usuario('Gerente Doze', 'gerente12@teste.pt', 'GERENTE') as gerente_id \gset

select tests.autenticar_como(:'gerente_id');
insert into escala_semanal (usuario_id, semana_ref, turno) values (:'operador_a_id', '2099-11-07', 'H3');
insert into escala_semanal (usuario_id, semana_ref, turno) values (:'operador_b_id', '2099-11-14', 'H3');
insert into planos (data_inicio_ciclo, criado_por) values ('2099-11-05', :'gerente_id') returning id as plano_a_id \gset
insert into planos (data_inicio_ciclo, criado_por) values ('2099-11-12', :'gerente_id') returning id as plano_b_id \gset

-- 1) O operador do ciclo A submete o seu próprio plano para aprovação.
select tests.autenticar_como(:'operador_a_id');
update planos set status = 'PENDENTE_APROVACAO' where id = :'plano_a_id';
select is(
    (select status from planos where id = :'plano_a_id'), 'PENDENTE_APROVACAO',
    'o operador do ciclo submete o seu próprio plano para aprovação'
);

-- 2) ...e também o aprova ele mesmo — a funcionalidade pedida.
update planos set status = 'APROVADO', aprovado_por = :'operador_a_id', data_aprovacao = now() where id = :'plano_a_id';
select is(
    (select status from planos where id = :'plano_a_id'), 'APROVADO',
    'o operador do ciclo aprova o seu próprio plano, não só o Gerente'
);
select is(
    (select aprovado_por from planos where id = :'plano_a_id'), :'operador_a_id',
    'fica registado como aprovador o próprio operador'
);

-- 3) Prepara o plano B (ciclo de outro operador) para os próximos dois
-- testes — submetido pelo Gerente, para isolar só o que eles provam.
select tests.autenticar_como(:'gerente_id');
update planos set status = 'PENDENTE_APROVACAO' where id = :'plano_b_id';

-- 4) O operador do ciclo A NÃO consegue aprovar o plano do ciclo B —
-- pode_editar_plano(id) só cobre o ciclo do próprio operador. Bloqueado
-- pelo USING (a linha nem chega a ser candidata) — silencioso, 0 linhas.
select tests.autenticar_como(:'operador_a_id');
update planos set status = 'APROVADO', aprovado_por = :'operador_a_id', data_aprovacao = now() where id = :'plano_b_id';
select is(
    (select status from planos where id = :'plano_b_id'), 'PENDENTE_APROVACAO',
    'o operador do ciclo A não consegue aprovar o plano do ciclo B — RLS filtra a linha, UPDATE afeta 0 registos'
);

-- 5) O operador do ciclo B não se pode fazer passar por outro
-- aprovador. Aqui o USING já admite a linha (é o seu próprio ciclo) —
-- quem bloqueia é o WITH CHECK, que dá erro explícito, não silêncio.
select tests.autenticar_como(:'operador_b_id');
select throws_ok(
    format($f$ update planos set status = 'APROVADO', aprovado_por = %L, data_aprovacao = now() where id = %L $f$, :'gerente_id', :'plano_b_id'),
    '42501',
    'new row violates row-level security policy for table "planos"',
    'não é possível aprovar creditando outra pessoa como aprovador — só a si mesmo'
);

-- 6) ...mas aprovar-se corretamente a ele mesmo já funciona.
update planos set status = 'APROVADO', aprovado_por = :'operador_b_id', data_aprovacao = now() where id = :'plano_b_id';
select is(
    (select status from planos where id = :'plano_b_id'), 'APROVADO',
    'o operador do ciclo B aprova corretamente o seu próprio plano'
);

-- 7) Ninguém consegue saltar Rascunho→Aprovado direto, nem o Gerente —
-- o trigger novo bloqueia com erro explícito.
select tests.autenticar_como(:'gerente_id');
insert into planos (data_inicio_ciclo, criado_por) values ('2099-11-19', :'gerente_id') returning id as plano_c_id \gset
select throws_ok(
    format($f$ update planos set status = 'APROVADO', aprovado_por = %L, data_aprovacao = now() where id = %L $f$, :'gerente_id', :'plano_c_id'),
    'P0001',
    'Só é possível aprovar um plano que esteja Pendente de aprovação (estado atual: RASCUNHO).',
    'nem o Gerente salta Rascunho→Aprovado direto — tem de passar por Pendente de aprovação'
);
select is(
    (select status from planos where id = :'plano_c_id'), 'RASCUNHO',
    'a tentativa falhada não deixou o plano num estado intermédio'
);

-- 8) Depois de corrigido o caminho (passa primeiro por Pendente), o
-- fluxo normal do Gerente continua a funcionar de ponta a ponta.
update planos set status = 'PENDENTE_APROVACAO' where id = :'plano_c_id';
update planos set status = 'APROVADO', aprovado_por = :'gerente_id', data_aprovacao = now() where id = :'plano_c_id';
select is(
    (select status from planos where id = :'plano_c_id'), 'APROVADO',
    'o Gerente continua a submeter e aprovar normalmente, de ponta a ponta'
);

-- 9) Achado do dossiê de segurança (0041): data_aprovacao deixa de vir
-- do relógio do browser — o trigger carimba sempre clock_timestamp()
-- no momento real da transição, mesmo que o cliente envie outra coisa.
select tests.autenticar_como(:'gerente_id');
insert into planos (data_inicio_ciclo, criado_por) values ('2099-11-26', :'gerente_id') returning id as plano_d_id \gset
update planos set status = 'PENDENTE_APROVACAO' where id = :'plano_d_id';
update planos set status = 'APROVADO', aprovado_por = :'gerente_id', data_aprovacao = '2000-01-01' where id = :'plano_d_id';
select ok(
    (select data_aprovacao from planos where id = :'plano_d_id') > now() - interval '1 minute',
    'data_aprovacao é sempre carimbada pelo servidor no momento da aprovação, ignorando o valor enviado pelo cliente'
);

-- 10) ...e só nesse exato momento — uma edição normal a um plano já
-- aprovado (aqui, observações gerais) não pode voltar a mexer no
-- carimbo de quem/quando aprovou, ou o histórico de aprovação corrompe-se.
select (select aprovado_por from planos where id = :'plano_d_id') as aprovador_original \gset
select (select data_aprovacao from planos where id = :'plano_d_id') as data_aprovacao_original \gset
update planos set observacoes_gerais = 'nota qualquer, sem relação com aprovação' where id = :'plano_d_id';
select is(
    (select aprovado_por from planos where id = :'plano_d_id')::text, :'aprovador_original',
    'uma edição não relacionada ao plano já aprovado não volta a carimbar aprovado_por'
);
select is(
    (select data_aprovacao from planos where id = :'plano_d_id')::text, :'data_aprovacao_original',
    'nem a carimbar de novo data_aprovacao'
);

select * from finish();
rollback;
