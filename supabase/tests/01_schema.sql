begin;
select plan(14);

-- Tabelas centrais existem
select has_table('public', 'usuarios', 'tabela usuarios existe');
select has_table('public', 'escala_semanal', 'tabela escala_semanal existe');
select has_table('public', 'ferias', 'tabela ferias existe');
select has_table('public', 'trocas_escala', 'tabela trocas_escala existe');
select has_table('public', 'delegacoes_aprovacao', 'tabela delegacoes_aprovacao existe');
select has_table('public', 'planos', 'tabela planos existe');
select has_table('public', 'tarefas_plano', 'tabela tarefas_plano existe');
select has_table('public', 'checklist_itens', 'tabela checklist_itens existe');
select has_table('public', 'cadeias_diarias', 'tabela cadeias_diarias existe');
select has_table('public', 'cadeias_catalogo', 'tabela cadeias_catalogo existe');
select has_table('public', 'logs_auditoria', 'tabela logs_auditoria existe');

-- Colunas críticas para as regras de negócio fechadas no levantamento
select has_column('public', 'usuarios', 'limite_h3_mensal', 'trava mensal de H3 é configurável por pessoa, não fixa no código');
select has_column('public', 'usuarios', 'data_saida', 'ciclo de vida de saída existe');
select has_column('public', 'planos', 'tipo_fim_semana_manual', 'Gerente pode substituir o cálculo automático de manutenção');

select * from finish();
rollback;
