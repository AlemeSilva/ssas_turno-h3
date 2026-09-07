-- =====================================================================
-- Cobertura dos 3 mecanismos mais recentes (peer-review de 2026-08-12),
-- até agora sem nenhum teste automático:
--   A) ferias_semanas — RLS (só Gerente/delegado escreve) + unicidade
--      (ferias_id, semana_inicio), migração 0025.
--   B) usuarios.turno_fixo — chk_turno_fixo_valores e
--      chk_turno_fixo_so_operador, migração 0029.
--   C) plantao_voluntarios — a política mais sensível: primeira escolha
--      aberta a Gerente/delegado, mas ALTERAR uma já confirmada passa a
--      ser exclusiva do Gerente titular, migração 0027.
--
-- Mesma semântica de UPDATE-sob-RLS de 07_rls_permissoes.sql: uma
-- política USING que exclui a linha faz o UPDATE/DELETE afetar
-- silenciosamente 0 linhas (sem exceção) — só violações de WITH CHECK
-- num INSERT lançam erro. Por isso os casos de "titular só" abaixo
-- verificam "nada mudou" em vez de throws_ok.
-- =====================================================================
begin;
select plan(14);

select tests.criar_usuario('Sérgio Nono', 'sergio9@teste.pt', 'OPERADOR') as sergio_id \gset
select tests.criar_usuario('Gerente Nono', 'gerente9@teste.pt', 'GERENTE') as gerente_id \gset
select tests.criar_usuario('Kilson Nono', 'kilson9@teste.pt', 'OPERADOR_H3') as kilson_id \gset

-- ---------------------------------------------------------------------
-- A) ferias_semanas
-- ---------------------------------------------------------------------
-- Ano corrente obrigatório (trg_valida_ferias) — 2026-05-04/08 está
-- livre de qualquer férias real de qualquer pessoa (verificado contra
-- produção; desde a migração 0044 a sobreposição bloqueia-se entre
-- qualquer par de colegas, não só H3, por isso já não basta verificar
-- só ausências de OPERADOR_H3 nesta janela). ferias_insert_propria
-- exige inserir em nome próprio — nunca o Gerente a pedir em nome de
-- outro.
select tests.autenticar_como(:'kilson_id');
insert into ferias (usuario_id, data_inicio, data_fim)
values (:'kilson_id', '2026-05-04', '2026-05-08') returning id as ferias_id \gset

select tests.autenticar_como(:'sergio_id');
select throws_ok(
    format($f$ insert into ferias_semanas (ferias_id, semana_inicio) values (%L, '2026-05-04') $f$, :'ferias_id'),
    '42501',
    'new row violates row-level security policy for table "ferias_semanas"',
    'OPERADOR comum não pode decidir o substituto de uma semana de férias (violação de WITH CHECK)'
);

select tests.autenticar_como(:'gerente_id');
select lives_ok(
    format($f$ insert into ferias_semanas (ferias_id, semana_inicio, substituto_id, confirmado_por, confirmado_em)
                values (%L, '2026-05-04', %L, %L, now()) $f$, :'ferias_id', :'sergio_id', :'gerente_id'),
    'Gerente/delegado consegue decidir o substituto de uma semana específica'
);

select tests.autenticar_como(:'sergio_id');
update ferias_semanas set substituto_id = null where ferias_id = :'ferias_id' and semana_inicio = '2026-05-04';
select is(
    (select substituto_id from ferias_semanas where ferias_id = :'ferias_id' and semana_inicio = '2026-05-04')::text, :'sergio_id',
    'OPERADOR comum não consegue alterar o substituto já decidido — RLS filtra a linha, UPDATE afeta 0 registos'
);

select tests.autenticar_como(:'gerente_id');
select throws_ok(
    format($f$ insert into ferias_semanas (ferias_id, semana_inicio) values (%L, '2026-05-04') $f$, :'ferias_id'),
    '23505',
    'duplicate key value violates unique constraint "uq_ferias_semanas"',
    'a mesma semana civil não pode ter duas decisões de substituto para a mesma ausência (unique ferias_id+semana_inicio)'
);

select tests.autenticar_como(:'sergio_id');
select lives_ok(
    format($f$ select * from ferias_semanas where ferias_id = %L $f$, :'ferias_id'),
    'qualquer utilizador autenticado consegue ler as decisões de substituto (consulta aberta a toda a equipa)'
);

-- ---------------------------------------------------------------------
-- B) usuarios.turno_fixo
-- ---------------------------------------------------------------------
select tests.autenticar_como(:'gerente_id');
select throws_ok(
    format($f$ update usuarios set turno_fixo = 'H3' where id = %L $f$, :'sergio_id'),
    '23514',
    'new row for relation "usuarios" violates check constraint "chk_turno_fixo_valores"',
    'turno_fixo só aceita H1 ou H4 — chk_turno_fixo_valores rejeita qualquer outro valor'
);

select lives_ok(
    format($f$ update usuarios set turno_fixo = 'H1' where id = %L $f$, :'sergio_id'),
    'H1 é um valor válido de turno_fixo para um OPERADOR'
);
select is(
    (select turno_fixo from usuarios where id = :'sergio_id')::text, 'H1',
    'o valor válido de turno_fixo ficou mesmo gravado'
);

select throws_ok(
    format($f$ update usuarios set turno_fixo = 'H1' where id = %L $f$, :'gerente_id'),
    '23514',
    'new row for relation "usuarios" violates check constraint "chk_turno_fixo_so_operador"',
    'turno_fixo é exclusivo de perfil OPERADOR — chk_turno_fixo_so_operador rejeita um GERENTE com turno fixo'
);

-- ---------------------------------------------------------------------
-- C) plantao_voluntarios — primeira escolha aberta, alteração só titular
-- ---------------------------------------------------------------------
select tests.autenticar_como(:'sergio_id');
select throws_ok(
    format($f$ insert into plantao_voluntarios (data_feriado, usuario_id, voluntario) values ('2099-12-25', %L, true) $f$, :'kilson_id'),
    '42501',
    'new row violates row-level security policy for table "plantao_voluntarios"',
    'OPERADOR comum não pode confirmar um plantonista (violação de WITH CHECK)'
);

select tests.autenticar_como(:'gerente_id');
select lives_ok(
    format($f$ insert into plantao_voluntarios (data_feriado, usuario_id, voluntario, confirmado_por, confirmado_em)
                values ('2099-12-25', %L, true, %L, now()) $f$, :'kilson_id', :'gerente_id'),
    'Gerente/delegado consegue confirmar a primeira escolha de plantonista'
);

select tests.autenticar_como(:'sergio_id');
update plantao_voluntarios set usuario_id = :'sergio_id' where data_feriado = '2099-12-25' and voluntario = true;
select is(
    (select usuario_id from plantao_voluntarios where data_feriado = '2099-12-25' and voluntario = true)::text, :'kilson_id',
    'OPERADOR comum não consegue alterar um plantonista já confirmado — RLS filtra a linha, UPDATE afeta 0 registos'
);

select tests.autenticar_como(:'gerente_id');
update plantao_voluntarios set usuario_id = :'sergio_id' where data_feriado = '2099-12-25' and voluntario = true;
select is(
    (select usuario_id from plantao_voluntarios where data_feriado = '2099-12-25' and voluntario = true)::text, :'sergio_id',
    'o Gerente titular consegue alterar um plantonista já confirmado'
);

select tests.autenticar_como(:'gerente_id');
delete from plantao_voluntarios where data_feriado = '2099-12-25' and voluntario = true;
select is(
    (select count(*) from plantao_voluntarios where data_feriado = '2099-12-25' and voluntario = true)::int, 0,
    'o Gerente titular também consegue remover um plantonista já confirmado'
);

select * from finish();
rollback;
