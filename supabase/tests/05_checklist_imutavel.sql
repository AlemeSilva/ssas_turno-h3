begin;
select plan(8);

select tests.criar_usuario('Kilson Júnior', 'kilson3@teste.pt', 'OPERADOR_H3') as kilson_id \gset
select tests.criar_usuario('Gerente Teste', 'gerente3@teste.pt', 'GERENTE') as gerente_id \gset

insert into planos (data_inicio_ciclo, criado_por) values ('2099-08-06', :'gerente_id') returning id as plano_id \gset
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2099-08-06', :'kilson_id', 'H3');
insert into checklist_itens (id_plano, secao, item_descricao) values (:'plano_id', 'PREPARACAO', 'Verificar espaço em disco') returning id as item_id \gset

update checklist_itens set concluido = true, concluido_por = :'kilson_id', data_hora_conclusao = now() where id = :'item_id';
select is((select concluido from checklist_itens where id = :'item_id'), true, 'marcar como concluído funciona normalmente');

select throws_ok(
    $$ update checklist_itens set concluido = false where id = $$ || :'item_id',
    'P0001',
    'Item de checklist concluído é imutável. Use a função destravar_checklist_item para correções, com justificativa.',
    'depois de concluído, um UPDATE direto ao estado é bloqueado pelo trigger — mesmo tentando desmarcar'
);

select throws_ok(
    $$ update checklist_itens set data_hora_conclusao = now() - interval '1 hour' where id = $$ || :'item_id',
    'P0001',
    'Item de checklist concluído é imutável. Use a função destravar_checklist_item para correções, com justificativa.',
    'não é possível alterar o timestamp de conclusão diretamente, nem para "corrigir"'
);

-- editar campos não relacionados à conclusão (ex.: comentário) continua livre
select lives_ok(
    $$ update checklist_itens set comentario_especifico = 'nota adicional' where id = $$ || :'item_id',
    'campos não relacionados à conclusão continuam editáveis após o carimbo'
);

-- destravar_checklist_item é o único caminho para reverter, e exige justificativa
select tests.autenticar_como(:'gerente_id');
select destravar_checklist_item(:'item_id', 'Marcado por engano durante o turno');
select is((select concluido from checklist_itens where id = :'item_id'), false,
    'destravar_checklist_item repõe concluido=false (nunca edita o carimbo diretamente)');

select is((select destravado_motivo from checklist_itens where id = :'item_id'), 'Marcado por engano durante o turno',
    'justificativa do destravar fica registada no próprio item');

-- DELETE de um item de checklist é exclusivo de Gerente/delegado (0043,
-- dossiê de segurança) — não há caminho na app para o operador do ciclo
-- apagar um item, só inserir/atualizar (criação do plano e conclusão).
insert into checklist_itens (id_plano, secao, item_descricao) values (:'plano_id', 'REUNIAO', 'Item para testar DELETE') returning id as item_delete_id \gset

select tests.autenticar_como(:'kilson_id');
delete from checklist_itens where id = :'item_delete_id';
select is(
    (select count(*)::int from checklist_itens where id = :'item_delete_id'), 1,
    'o operador do ciclo não consegue apagar um item de checklist — RLS filtra a linha, DELETE afeta 0 registos'
);

select tests.autenticar_como(:'gerente_id');
delete from checklist_itens where id = :'item_delete_id';
select is(
    (select count(*)::int from checklist_itens where id = :'item_delete_id'), 0,
    'o Gerente/delegado continua a poder apagar um item de checklist'
);

select * from finish();
rollback;
