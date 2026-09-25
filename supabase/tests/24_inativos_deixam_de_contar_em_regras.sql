-- =====================================================================
-- Cobertura da migração 0056 — quatro regras da base de dados que ainda
-- contavam quem já saiu da equipa (ativo = false):
--   A) sobreposição de delegações (trg_valida_delegacao)
--   B) operador_do_ciclo() — de onde vem o direito de editar o plano
--   C) escala_diaria_gerente_all — escrita na escala por perfil GERENTE
--      sem exigir ativo
--   D) "máximo 1 H3 por semana" (trg_valida_um_h3_por_semana) — um H3
--      que sai a meio da semana continuava a ocupar o lugar e a base
--      recusava escalar o substituto
--
-- Desde a 0057, desativar alguém apaga o que ele tinha marcado a partir
-- de hoje. Por isso os "fantasmas" que estas regras protegem são:
--   - a linha da SEMANA EM CURSO (sábado já passado): a limpeza só apaga
--     semanas a partir de hoje — é exatamente o H3 que sai a meio da
--     semana. Semeada aqui com um sábado de 2020, sem dados reais;
--   - dados que a limpeza nunca viu (anteriores à 0057, ou criados já
--     depois de a pessoa estar desativada) — a delegação da secção A é
--     inserida DEPOIS de desativar o delegado, para simular isso.
--
-- Todos os utilizadores criados já aqui, antes de qualquer
-- tests.autenticar_como() — criar_usuario() não é security definer.
-- Criar um Gerente ATIVO desativa o titular real dentro desta transação
-- (ver 00_helpers.sql), por isso o "Gerente Antigo" é criado já inativo.
-- =====================================================================
begin;
select plan(9);

select tests.criar_usuario('Titular 24', 'titular24@teste.pt', 'GERENTE') as titular_id \gset
select tests.criar_usuario('Gerente Antigo 24', 'gerantigo24@teste.pt', 'GERENTE', false) as gerantigo_id \gset
select tests.criar_usuario('Delegado Saiu 24', 'delsaiu24@teste.pt', 'OPERADOR') as delsaiu_id \gset
select tests.criar_usuario('Delegado Ativo 24', 'delativo24@teste.pt', 'OPERADOR') as delativo_id \gset
select tests.criar_usuario('Outro 24', 'outro24@teste.pt', 'OPERADOR') as outro_id \gset
select tests.criar_usuario('H3 24', 'h324@teste.pt', 'OPERADOR_H3') as h3_id \gset
select tests.criar_usuario('H3 Saiu 24', 'h3saiu24@teste.pt', 'OPERADOR_H3') as h3velho_id \gset
select tests.criar_usuario('H3 Novo 24', 'h3novo24@teste.pt', 'OPERADOR_H3') as h3novo_id \gset
select tests.criar_usuario('H3 Outro 24', 'h3outro24@teste.pt', 'OPERADOR_H3') as h3outro_id \gset

-- ---------------------------------------------------------------------
-- A) delegações. A verificação de sobreposição em trg_valida_delegacao()
-- não é restrita ao mesmo gerente_titular — limpa (só nesta transação,
-- revertida no fim) qualquer delegação real que já cubra esta janela.
-- O delegado é desativado ANTES de a delegação existir (ver o cabeçalho).
-- ---------------------------------------------------------------------
delete from delegacoes_aprovacao where data_inicio <= current_date + 100 and data_fim >= current_date + 50;

update usuarios set ativo = false where id = :'delsaiu_id';
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'titular_id', :'delsaiu_id', current_date + 60, current_date + 65);

select lives_ok(
    format($f$ insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
       values (%L, %L, current_date + 62, current_date + 63) $f$, :'titular_id', :'delativo_id'),
    'uma delegação a quem já saiu da equipa deixa de ocupar a janela — é possível criar uma nova para o mesmo período'
);

select throws_ok(
    format($f$ insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
       values (%L, %L, current_date + 63, current_date + 64) $f$, :'titular_id', :'outro_id'),
    'P0001',
    'Já existe uma delegação de aprovação ativa nesse período.',
    'não-regressão: uma delegação a alguém ativo continua a bloquear janelas sobrepostas'
);

update usuarios set ativo = true where id = :'delsaiu_id';
select throws_ok(
    format($f$ insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
       values (%L, %L, current_date + 61, current_date + 61) $f$, :'titular_id', :'outro_id'),
    'P0001',
    'Já existe uma delegação de aprovação ativa nesse período.',
    'um delegado reativado volta a contar — o estado lido é sempre o atual'
);

-- ---------------------------------------------------------------------
-- B) operador do ciclo. Um sábado de 2020 — passado, sem nenhuma linha
-- real de escala e fora do alcance da limpeza da 0057 (só apaga a partir
-- de hoje): é a linha da semana em curso de um H3 que saiu a meio.
-- operador_do_ciclo() recebe a Quinta de início do ciclo (semana_ref - 2).
-- ---------------------------------------------------------------------
select make_date(2020, 3, 7) as sabado \gset
insert into escala_semanal (semana_ref, usuario_id, turno) values (:'sabado', :'h3_id', 'H3');

select is(
    operador_do_ciclo(:'sabado'::date - 2),
    :'h3_id'::uuid,
    'não-regressão: um H3 ativo continua a ser o operador do ciclo'
);

update usuarios set ativo = false where id = :'h3_id';
select is(
    operador_do_ciclo(:'sabado'::date - 2),
    null::uuid,
    'um H3 desativado deixa de ser o operador do ciclo — e com ele o direito de editar o plano e a checklist'
);

-- ---------------------------------------------------------------------
-- D) preparação — "máximo 1 H3 por semana" com um H3 que sai a meio da
-- semana: a linha da semana em curso não é apagada pela desativação (só
-- as de hoje em diante). Outra semana de 2020, para não interferir com a
-- secção B. Feito aqui, ainda como role de ligação, porque desativar
-- exige update a usuarios e a RLS só o deixa ao Gerente.
-- ---------------------------------------------------------------------
select (:'sabado'::date + 28) as sabado_d \gset
insert into escala_semanal (semana_ref, usuario_id, turno) values (:'sabado_d', :'h3velho_id', 'H3');
update usuarios set ativo = false where id = :'h3velho_id';

-- ---------------------------------------------------------------------
-- C) escrita na escala por um Gerente desativado. escala_write_gerente
-- (is_gerente_ou_delegado()) já exigia ativo; a política antiga
-- escala_diaria_gerente_all só olhava para o perfil.
-- ---------------------------------------------------------------------
select tests.autenticar_como(:'gerantigo_id');
select throws_ok(
    format($f$ insert into escala_semanal (semana_ref, usuario_id, turno) values (%L::date + 7, %L, 'H1') $f$, :'sabado', :'outro_id'),
    '42501',
    'new row violates row-level security policy for table "escala_semanal"',
    'um Gerente desativado deixa de poder gravar a escala, mesmo com um token ainda válido'
);

-- Semana diferente da anterior, para as duas asserções serem
-- independentes: se a de cima falhasse (a linha do Gerente desativado
-- ficaria gravada), esta não falhava por chave duplicada, só por si.
select tests.autenticar_como(:'titular_id');
select lives_ok(
    format($f$ insert into escala_semanal (semana_ref, usuario_id, turno) values (%L::date + 14, %L, 'H1') $f$, :'sabado', :'outro_id'),
    'não-regressão: o Gerente ativo continua a poder gravar a escala'
);

-- ---------------------------------------------------------------------
-- D) asserções, ainda como Gerente ativo. Quem passa a ser H3 tem de ser
-- OPERADOR_H3 ativo — o h3novo é. Com esse já escalado, um segundo H3
-- ativo na mesma semana continua a ser recusado.
-- ---------------------------------------------------------------------
select lives_ok(
    format($f$ insert into escala_semanal (semana_ref, usuario_id, turno) values (%L, %L, 'H3') $f$, :'sabado_d', :'h3novo_id'),
    'um H3 que saiu a meio da semana deixa de ocupar o lugar: o Gerente consegue escalar outro OPERADOR_H3 ativo para essa semana'
);

select throws_ok(
    format($f$ insert into escala_semanal (semana_ref, usuario_id, turno) values (%L, %L, 'H3') $f$, :'sabado_d', :'h3outro_id'),
    'P0001',
    format('Já existe um H3 registado para a semana de %s. Máximo 1 H3 por semana.', :'sabado_d'),
    'não-regressão: com um H3 ativo já escalado nessa semana, um segundo H3 continua a ser recusado'
);

select * from finish();
rollback;
