-- =====================================================================
-- Migração 0032: tarefas excecionais passam a poder ser marcadas como
-- concluídas (bloco próprio no Checklist Ativo, fora das 5 secções
-- fixas) e a participar nos alertas de hora-limite. Este ficheiro cobre
-- as duas peças novas na base de dados: a conclusão não deve reabrir a
-- aprovação do plano (é execução normal, não edição de conteúdo — uma
-- edição real continua a reabrir, testado aqui como regressão), e a
-- conclusão fica imutável até um Gerente destravar com justificativa,
-- tal como já acontece em checklist_itens (05_checklist_imutavel.sql).
-- =====================================================================
begin;
select plan(11);

select tests.criar_usuario('Operador Onze', 'operador11@teste.pt', 'OPERADOR_H3') as operador_id \gset
select tests.criar_usuario('Gerente Onze', 'gerente11@teste.pt', 'GERENTE') as gerente_id \gset

select tests.autenticar_como(:'gerente_id');
insert into escala_semanal (usuario_id, semana_ref, turno) values (:'operador_id', '2100-01-02', 'H3');
insert into planos (data_inicio_ciclo, criado_por) values ('2099-12-31', :'gerente_id') returning id as plano_id \gset

-- Tarefas inseridas com o plano ainda em Rascunho — inserir com o
-- plano já aprovado reabriria de imediato (comportamento correto, mas
-- não é o que a preparação deste teste precisa).
select tests.autenticar_como(:'operador_id');
insert into tarefas_plano (id_plano, data_execucao, descricao_tarefa, equipa_responsavel, origem, hr_limite)
values (:'plano_id', '2100-01-02', 'Tarefa a concluir', 'DEOS - Operações', 'EXCECIONAL', '10:00') returning id as tarefa_a_id \gset
insert into tarefas_plano (id_plano, data_execucao, descricao_tarefa, equipa_responsavel, origem)
values (:'plano_id', '2100-01-02', 'Tarefa a editar', 'DEOS - Operações', 'EXCECIONAL') returning id as tarefa_b_id \gset

select tests.autenticar_como(:'gerente_id');
-- Achado à parte, sem relação com o dossiê de segurança: esta linha
-- saltava RASCUNHO→APROVADO direto — a migração 0033 (posterior a este
-- ficheiro) passou a bloquear isso com trg_planos_transicao_aprovacao,
-- e este ficheiro nunca tinha sido atualizado para o novo caminho
-- obrigatório. Confirmado com um teste de controlo (mesmo ficheiro,
-- zero migrações aplicadas) que isto já falhava antes de qualquer
-- alteração desta sessão.
update planos set status = 'PENDENTE_APROVACAO' where id = :'plano_id';
update planos set status = 'APROVADO', aprovado_por = :'gerente_id', data_aprovacao = now() where id = :'plano_id';

-- 1) Regressão: editar conteúdo de uma tarefa excecional continua a
-- reabrir a aprovação, exatamente como a migração 0031 já garantia.
select tests.autenticar_como(:'operador_id');
update tarefas_plano set descricao_tarefa = 'Tarefa a editar (corrigida)' where id = :'tarefa_b_id';
select is(
    (select status from planos where id = :'plano_id'), 'PENDENTE_APROVACAO',
    'editar o conteúdo de uma tarefa excecional continua a reabrir a aprovação do plano'
);
select is(
    (select count(*)::int from logs_auditoria where referencia_tipo = 'PLANO' and referencia_id = :'plano_id' and acao = 'REABERTURA_APROVACAO'),
    1,
    'a reabertura por edição de conteúdo fica registada em auditoria'
);

select tests.autenticar_como(:'gerente_id');
update planos set status = 'APROVADO' where id = :'plano_id';

-- 2) Concluir uma tarefa excecional não reabre a aprovação — é
-- execução normal do fim de semana, não uma alteração de conteúdo.
select tests.autenticar_como(:'operador_id');
update tarefas_plano set status = 'CONCLUIDO', executado_por = :'operador_id', dt_hr_conclusao_real = now() where id = :'tarefa_a_id';
select is(
    (select status from tarefas_plano where id = :'tarefa_a_id'), 'CONCLUIDO',
    'o operador do ciclo conclui a sua própria tarefa excecional'
);
select is(
    (select status from planos where id = :'plano_id'), 'APROVADO',
    'concluir uma tarefa NÃO reabre a aprovação do plano'
);
select is(
    (select count(*)::int from logs_auditoria
      where referencia_tipo = 'PLANO' and referencia_id = :'plano_id' and acao = 'CONCLUSAO_TAREFA'
        and descricao_detalhada like '%(id ' || :'tarefa_a_id' || ')%'),
    1,
    'a conclusão fica registada em auditoria como CONCLUSAO_TAREFA, não EDICAO_TAREFA'
);
select is(
    (select count(*)::int from logs_auditoria where referencia_tipo = 'PLANO' and referencia_id = :'plano_id' and acao = 'REABERTURA_APROVACAO'),
    1,
    'nenhuma segunda reabertura foi registada ao concluir — continua só a do passo 1'
);

-- 3) Depois de concluída, fica imutável — só destravar_tarefa_plano
-- pode reverter, tal como um item de checklist já concluído.
select throws_ok(
    $$ update tarefas_plano set status = 'PENDENTE' where id = $$ || :'tarefa_a_id',
    'P0001',
    'Tarefa concluída é imutável. Use a função destravar_tarefa_plano para correções, com justificativa.',
    'depois de concluída, um UPDATE direto ao estado é bloqueado pelo trigger'
);

-- 4) destravar_tarefa_plano é reservado ao Gerente/delegado — mesma
-- classe de falha que a migração 0024 corrigiu no checklist (a
-- verificação tem de estar no corpo da função, não só na interface).
select throws_ok(
    $$ select destravar_tarefa_plano($$ || :'tarefa_a_id' || $$, 'tentativa sem permissão') $$,
    'P0001',
    'Sem permissão — reservado ao Gerente/delegado.',
    'o operador do ciclo não pode destravar — só Gerente/delegado'
);

-- 5) Gerente destrava com justificativa: repõe o estado e regista
-- OVERRIDE_TAREFA, sem duplicar CONCLUSAO_TAREFA no mesmo movimento.
select tests.autenticar_como(:'gerente_id');
select destravar_tarefa_plano(:'tarefa_a_id', 'Marcado por engano durante o turno');
select is(
    (select status from tarefas_plano where id = :'tarefa_a_id'), 'PENDENTE',
    'destravar_tarefa_plano repõe status=PENDENTE (nunca edita o carimbo diretamente)'
);
select is(
    (select destravado_motivo from tarefas_plano where id = :'tarefa_a_id'), 'Marcado por engano durante o turno',
    'justificativa do destravar fica registada na própria tarefa'
);
select is(
    (select count(*)::int from logs_auditoria
      where referencia_tipo = 'PLANO' and referencia_id = :'plano_id' and acao = 'CONCLUSAO_TAREFA'
        and descricao_detalhada like '%(id ' || :'tarefa_a_id' || ')%'),
    1,
    'destravar não duplica o registo de CONCLUSAO_TAREFA — continua só o do passo 2'
);

select * from finish();
rollback;
