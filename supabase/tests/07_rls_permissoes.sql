-- CAMADA 1 / segurança: RLS é a fronteira real, não a UI. Estes testes
-- tentam escrever diretamente contra a base de dados como cada perfil,
-- exatamente como um bypass da interface tentaria.
--
-- Nota de semântica do Postgres RLS, importante para não escrever
-- testes que pareçam certos mas nunca disparem: uma política USING
-- (sem WITH CHECK) que exclui uma linha faz o UPDATE/DELETE afetar
-- silenciosamente 0 linhas — não lança exceção. Só uma violação de
-- WITH CHECK num INSERT lança mesmo um erro (SQLSTATE 42501). Por
-- isso os casos de UPDATE abaixo verificam "o valor não mudou", e só
-- os casos de INSERT usam throws_ok.
--
-- Nota de execução: lives_ok/throws_ok recebem SQL como argumento de
-- texto — se essa string usar $$...$$ (dollar-quoting), o psql NÃO
-- substitui :'variavel' lá dentro (só substitui em texto SQL "normal").
-- Por isso, sempre que a query precisa de uma variável, constrói-se
-- com format(...,%L) — a substituição de :'variavel' acontece na
-- posição de argumento do format(), fora do dollar-quote interno.
begin;
select plan(12);

select tests.criar_usuario('Kilson Júnior', 'kilson5@teste.pt', 'OPERADOR_H3') as kilson_id \gset
select tests.criar_usuario('Bruno Diniz', 'bruno5@teste.pt', 'OPERADOR_H3') as bruno_id \gset
select tests.criar_usuario('Sérgio Gomes', 'sergio5@teste.pt', 'OPERADOR') as sergio_id \gset
select tests.criar_usuario('Gerente Teste', 'gerente5@teste.pt', 'GERENTE') as gerente_id \gset

-- data_inicio_ciclo (Quinta) e escala_semanal.semana_ref (Sábado, +2
-- dias) têm de estar corretamente desfasados 2 dias entre si — é
-- assim que operador_do_ciclo() os liga desde a correção da migração
-- 0022 (antes dessa migração, a função nunca comparava as datas
-- certas e nunca devolvia ninguém).
insert into escala_semanal (semana_ref, usuario_id, turno) values ('2099-08-08', :'kilson_id', 'H3');
insert into planos (data_inicio_ciclo, criado_por, observacoes_gerais) values ('2099-08-06', :'gerente_id', 'valor original') returning id as plano_id \gset

-- OPERADOR (nem sequer H3) só consulta, nunca escreve
select tests.autenticar_como(:'sergio_id');
select lives_ok(
    format($f$ select * from planos where id = %L $f$, :'plano_id'),
    'OPERADOR consegue sempre ler o plano (consulta aberta a toda a equipa)'
);
update planos set observacoes_gerais = 'tentativa indevida' where id = :'plano_id';
select is(
    (select observacoes_gerais from planos where id = :'plano_id'), 'valor original',
    'OPERADOR comum não consegue editar o plano por escrita direta na API — RLS filtra a linha, UPDATE afeta 0 registos'
);

-- OPERADOR_H3 que NÃO está escalado nesta semana também não pode editar
select tests.autenticar_como(:'bruno_id');
update planos set observacoes_gerais = 'tentativa indevida bruno' where id = :'plano_id';
select is(
    (select observacoes_gerais from planos where id = :'plano_id'), 'valor original',
    'OPERADOR_H3 que não é o escalado desta semana específica não consegue alterar este plano'
);

-- OPERADOR_H3 escalado para ESTA semana pode editar
select tests.autenticar_como(:'kilson_id');
update planos set observacoes_gerais = 'nota do operador escalado' where id = :'plano_id';
select is(
    (select observacoes_gerais from planos where id = :'plano_id'), 'nota do operador escalado',
    'o operador especificamente escalado para este ciclo consegue editar o seu próprio plano'
);

-- Reatribuição dinâmica: aprovar uma troca a meio da semana transfere
-- o direito de edição automaticamente para o novo escalado, sem passo
-- manual de reatribuição do plano.
-- kilson é o proponente — INSERT exige auth.uid() = usuario_proponente (já autenticado como kilson na linha acima)
insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref)
values (:'kilson_id', :'bruno_id', '2099-08-08') returning id as troca_id \gset
-- só o Gerente pode aprovar — mudar contexto antes do UPDATE
select tests.autenticar_como(:'gerente_id');
update trocas_escala set status = 'APROVADA', aprovado_por = :'gerente_id' where id = :'troca_id';

select tests.autenticar_como(:'kilson_id');
update planos set observacoes_gerais = 'kilson depois da troca' where id = :'plano_id';
select is(
    (select observacoes_gerais from planos where id = :'plano_id'), 'nota do operador escalado',
    'depois da troca aprovada, o operador antigo perde imediatamente o direito de editar'
);

select tests.autenticar_como(:'bruno_id');
update planos set observacoes_gerais = 'bruno depois da troca' where id = :'plano_id';
select is(
    (select observacoes_gerais from planos where id = :'plano_id'), 'bruno depois da troca',
    'depois da troca aprovada, o novo operador ganha o direito de editar sem passo manual'
);

-- GERENTE pode sempre editar, independentemente de quem está escalado
select tests.autenticar_como(:'gerente_id');
update planos set status = 'PENDENTE_APROVACAO' where id = :'plano_id';
select is(
    (select status from planos where id = :'plano_id')::text, 'PENDENTE_APROVACAO',
    'Gerente pode sempre editar qualquer plano'
);

-- Auditoria: só se insere em nome próprio (violação de WITH CHECK num
-- INSERT lança mesmo exceção — diferente dos casos de UPDATE acima).
-- acao tem de vir da lista fechada (0042, achado do dossiê de segurança:
-- antes disto, qualquer utilizador autenticado podia inserir uma
-- entrada de auditoria com uma acao arbitrária, auto-atribuída) — usa-se
-- aqui um valor real (o único caso hoje de escrita direta do cliente
-- fora de RPCs/triggers, AlterarSenhaDialog.tsx), não um valor de teste.
select tests.autenticar_como(:'sergio_id');
select lives_ok(
    format($f$ insert into logs_auditoria (referencia_tipo, id_usuario, acao) values ('PLANO', %L, 'PASSWORD_ALTERADA_PROPRIA') $f$, :'sergio_id'),
    'qualquer utilizador pode inserir um log em seu próprio nome, com uma ação da lista fechada'
);
select throws_ok(
    format($f$ insert into logs_auditoria (referencia_tipo, id_usuario, acao) values ('PLANO', %L, 'TESTE_FORJADO') $f$, :'kilson_id'),
    '42501',
    'new row violates row-level security policy for table "logs_auditoria"',
    'não é possível inserir um log de auditoria em nome de outra pessoa (violação de WITH CHECK)'
);
select throws_ok(
    format($f$ insert into logs_auditoria (referencia_tipo, id_usuario, acao) values ('PLANO', %L, 'ACAO_INVENTADA') $f$, :'sergio_id'),
    '42501',
    'new row violates row-level security policy for table "logs_auditoria"',
    'não é possível fabricar uma ação fora da lista fechada, mesmo em nome próprio (achado do dossiê de segurança)'
);

-- Sem política de UPDATE nenhuma em logs_auditoria: a tentativa afeta
-- silenciosamente 0 linhas, o conteúdo original mantém-se intacto.
update logs_auditoria set descricao_detalhada = 'alterado' where id_usuario = :'sergio_id';
select is(
    (select descricao_detalhada from logs_auditoria where id_usuario = :'sergio_id' and acao = 'PASSWORD_ALTERADA_PROPRIA'), null,
    'logs de auditoria são imutáveis — sem política de UPDATE, RLS nega tudo por omissão'
);

-- cadeias_catalogo: só Gerente escreve (violação de WITH CHECK num INSERT)
select throws_ok(
    $$ insert into cadeias_catalogo (nome_cadeia, categoria, ordem) values ('TESTE_CADEIA_RLS', 'NORMAL', 99) $$,
    '42501',
    'new row violates row-level security policy for table "cadeias_catalogo"',
    'OPERADOR comum não pode adicionar uma cadeia ao catálogo (violação de WITH CHECK)'
);

select * from finish();
rollback;
