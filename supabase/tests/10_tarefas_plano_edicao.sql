-- =====================================================================
-- Peer-review de 2026-08-14 sobre a edição de tarefas excecionais
-- (migração 0031): cobre a lacuna real que a policy tarefas_write
-- (para all, sem distinguir origem) deixava — um operador do ciclo
-- conseguia UPDATE/DELETE a tarefas TEMPLATE/MANUTENCAO via API
-- direta, não só às EXCECIONAL que a interface expõe para edição.
-- Cobre também atualizado_em (bloqueio otimista) e o novo registo de
-- auditoria EDICAO_TAREFA para edições que não reabrem aprovação.
-- =====================================================================
begin;
select plan(8);

select tests.criar_usuario('Operador Dez', 'operador10@teste.pt', 'OPERADOR_H3') as operador_id \gset
select tests.criar_usuario('Gerente Dez', 'gerente10@teste.pt', 'GERENTE') as gerente_id \gset

-- Ciclo e escala seguros — 2099, longe de qualquer dado real.
select tests.autenticar_como(:'gerente_id');
insert into escala_semanal (usuario_id, semana_ref, turno) values (:'operador_id', '2099-12-19', 'H3');
insert into planos (data_inicio_ciclo, criado_por) values ('2099-12-17', :'gerente_id') returning id as plano_id \gset

insert into tarefas_plano (id_plano, data_execucao, descricao_tarefa, equipa_responsavel, origem)
values (:'plano_id', '2099-12-19', 'Tarefa fixa do modelo', 'DEOS - Operações', 'TEMPLATE') returning id as tarefa_template_id \gset

select tests.autenticar_como(:'operador_id');

-- 1) INSERT continua sem restrição de origem — criarPlano() insere as
-- tarefas TEMPLATE do modelo em nome do próprio operador do ciclo.
select lives_ok(
    format($f$ insert into tarefas_plano (id_plano, data_execucao, descricao_tarefa, equipa_responsavel, origem)
                values (%L, '2099-12-19', 'Outra tarefa fixa', 'DEOS - Operações', 'TEMPLATE') $f$, :'plano_id'),
    'o operador do ciclo consegue inserir tarefas TEMPLATE (criarPlano insere o modelo em nome dele)'
);

-- 2) mas não pode ALTERAR uma tarefa TEMPLATE já existente.
update tarefas_plano set descricao_tarefa = 'Alterado indevidamente' where id = :'tarefa_template_id';
select is(
    (select descricao_tarefa from tarefas_plano where id = :'tarefa_template_id'), 'Tarefa fixa do modelo',
    'o operador do ciclo não consegue editar uma tarefa TEMPLATE — RLS filtra a linha, UPDATE afeta 0 registos'
);

-- 3) nem apagá-la.
delete from tarefas_plano where id = :'tarefa_template_id';
select is(
    (select count(*) from tarefas_plano where id = :'tarefa_template_id')::int, 1,
    'o operador do ciclo não consegue apagar uma tarefa TEMPLATE'
);

-- 4) mas edita livremente uma tarefa EXCECIONAL sua.
insert into tarefas_plano (id_plano, data_execucao, descricao_tarefa, equipa_responsavel, origem)
values (:'plano_id', '2099-12-19', 'Tarefa avulsa', 'DEOS - Operações', 'EXCECIONAL') returning id as tarefa_exc_id \gset

select atualizado_em::text as antes from tarefas_plano where id = :'tarefa_exc_id' \gset
select pg_sleep(0.01);
update tarefas_plano set descricao_tarefa = 'Tarefa avulsa corrigida' where id = :'tarefa_exc_id';
select is(
    (select descricao_tarefa from tarefas_plano where id = :'tarefa_exc_id'), 'Tarefa avulsa corrigida',
    'o operador do ciclo edita livremente uma tarefa EXCECIONAL'
);

-- 5) atualizado_em avança sozinho em cada UPDATE — é nele que o
-- frontend se apoia para o bloqueio otimista (evitar sobrepor em
-- silêncio a alteração de outra pessoa).
select isnt(
    (select atualizado_em::text from tarefas_plano where id = :'tarefa_exc_id'), :'antes',
    'atualizado_em avança sozinho a cada UPDATE'
);

-- 6) e também consegue apagar a sua própria tarefa EXCECIONAL.
delete from tarefas_plano where id = :'tarefa_exc_id';
select is(
    (select count(*) from tarefas_plano where id = :'tarefa_exc_id')::int, 0,
    'o operador do ciclo consegue apagar uma tarefa EXCECIONAL'
);

-- 7) uma edição normal (plano ainda em Rascunho, não reabre nada) já
-- fica registada em logs_auditoria — antes desta migração não havia
-- rasto nenhum de edições fora do caso de reabertura de aprovação.
-- Filtra pelo id desta tarefa em concreto porque a asserção 4, mais
-- acima, já gerou o seu próprio registo EDICAO_TAREFA para o mesmo
-- plano — sem o filtro, a contagem incluiria os dois.
insert into tarefas_plano (id_plano, data_execucao, descricao_tarefa, equipa_responsavel, origem)
values (:'plano_id', '2099-12-19', 'Tarefa a auditar', 'DEOS - Operações', 'EXCECIONAL') returning id as tarefa_audit_id \gset
update tarefas_plano set descricao_tarefa = 'Tarefa auditada' where id = :'tarefa_audit_id';
select is(
    (select count(*)::int from logs_auditoria
      where referencia_tipo = 'PLANO' and referencia_id = :'plano_id' and acao = 'EDICAO_TAREFA'
        and descricao_detalhada like '%(id ' || :'tarefa_audit_id' || ')%'),
    1,
    'editar uma tarefa (mesmo sem reabrir aprovação) fica registado em logs_auditoria'
);

-- 8) o Gerente continua a poder editar livremente uma tarefa TEMPLATE
-- (a restrição de origem é só para quem não é Gerente/delegado).
select tests.autenticar_como(:'gerente_id');
update tarefas_plano set descricao_tarefa = 'Corrigido pelo Gerente' where id = :'tarefa_template_id';
select is(
    (select descricao_tarefa from tarefas_plano where id = :'tarefa_template_id'), 'Corrigido pelo Gerente',
    'o Gerente edita livremente uma tarefa TEMPLATE'
);

select * from finish();
rollback;
