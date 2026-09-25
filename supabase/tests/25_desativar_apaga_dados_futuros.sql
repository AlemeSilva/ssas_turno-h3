-- =====================================================================
-- Cobertura da migração 0057 — desativar alguém apaga o que a pessoa
-- tinha marcado a partir da data de desativação, e só a partir dela.
-- Decisão do Gerente, 2026-09-25: o histórico anterior é válido e fica,
-- para efeito de controlo.
--
-- Todos os utilizadores criados já aqui, antes de qualquer seed —
-- criar_usuario() não é security definer. Nada de autenticar_como(): a
-- limpeza corre num trigger e este ficheiro é todo com o role de ligação,
-- menos o último caso, que desativa com o role service_role (o das Edge
-- Functions gerir-utilizadores e desactivar-saidos).
-- Datas relativas a "hoje em Lisboa" — a mesma que o trigger usa (o
-- servidor está em UTC, por isso current_date pode ser outro dia perto da
-- meia-noite). Sábados calculados a partir da segunda-feira da semana de
-- hoje, para nunca coincidirem com hoje.
--
-- Os seeds de férias e delegações usam session_replication_role =
-- replica: o INSERT de férias só aceita o ano corrente (o que partia
-- este teste em dezembro) e as validações de sobreposição olhariam para
-- dados reais. Também é assim que se semeia o estado "impossível" de um
-- par antigo de férias sobrepostas (aprovado antes da 0044), para provar
-- que cortar umas férias nunca é recusado por dados antigos.
-- =====================================================================
begin;
select plan(30);

select tests.criar_usuario('Sai 25', 'sai25@teste.pt', 'OPERADOR_H3') as sai_id \gset
select tests.criar_usuario('Colega 25', 'colega25@teste.pt', 'OPERADOR_H3') as colega_id \gset
select tests.criar_usuario('Ausente 25', 'ausente25@teste.pt', 'OPERADOR') as ausente_id \gset
select tests.criar_usuario('Sai Servidor 25', 'saiservidor25@teste.pt', 'OPERADOR_H3') as sai_srv_id \gset

select (now() at time zone 'Europe/Lisbon')::date as hoje \gset
select (date_trunc('week', :'hoje'::date)::date - 9) as sab_passado \gset
select (date_trunc('week', :'hoje'::date)::date + 12) as sab_futuro \gset

-- ---------------------------------------------------------------------
-- Seeds. Quem sai: Sai. Fica: Colega (dados dele nunca podem ser tocados).
-- ---------------------------------------------------------------------
insert into escala_semanal (semana_ref, usuario_id, turno) values
    (:'sab_passado', :'sai_id', 'H4'),
    (:'sab_futuro', :'sai_id', 'H4'),
    (:'sab_futuro', :'colega_id', 'H4'),
    (:'sab_futuro', :'sai_srv_id', 'H4');

set session_replication_role = replica;
insert into ferias (usuario_id, data_inicio, data_fim, tipo, status) values
    (:'sai_id', :'hoje'::date + 10, :'hoje'::date + 14, 'FERIAS', 'APROVADA'),   -- começa depois: apaga
    (:'sai_id', :'hoje'::date - 40, :'hoje'::date - 36, 'FERIAS', 'APROVADA'),   -- já gozadas: ficam
    (:'sai_id', :'hoje'::date + 20, :'hoje'::date + 21, 'FERIAS', 'REJEITADA'),  -- rejeitada, futura: fica
    (:'colega_id', :'hoje'::date - 3, :'hoje'::date - 1, 'FERIAS', 'APROVADA'),  -- par antigo: sobrepõe o troço que fica das do Sai
    (:'colega_id', :'hoje'::date + 30, :'hoje'::date + 31, 'FERIAS', 'APROVADA');
insert into ferias (usuario_id, data_inicio, data_fim, tipo, status)
values (:'sai_id', :'hoje'::date - 2, :'hoje'::date + 3, 'FERIAS', 'APROVADA') returning id as atravessa_id \gset
insert into ferias (usuario_id, data_inicio, data_fim, tipo, status)
values (:'ausente_id', :'hoje'::date + 8, :'hoje'::date + 16, 'FERIAS', 'APROVADA') returning id as ausente_ferias_id \gset

insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim) values
    (:'colega_id', :'sai_id', :'hoje'::date + 30, :'hoje'::date + 34),   -- futura, ele como delegado: apaga
    (:'sai_id', :'colega_id', :'hoje'::date + 40, :'hoje'::date + 44),   -- futura, ele como titular: apaga
    (:'colega_id', :'sai_id', :'hoje'::date - 60, :'hoje'::date - 55);   -- passada: fica
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'colega_id', :'sai_id', :'hoje'::date - 3, :'hoje'::date + 3) returning id as atravessa_deleg_id \gset
insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'colega_id', :'sai_id', :'hoje'::date, :'hoje'::date + 2) returning id as usada_id \gset
-- Uma delegação já usada: referida numa linha de auditoria. Em modo replica
-- o trigger que carimba delegacao_id não corre, por isso o valor fica.
insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada, delegacao_id)
values ('USUARIO', null, null, 'TESTE_USO_DELEGACAO', 'seed do teste 25', :usada_id);
set session_replication_role = default;

insert into ferias_semanas (ferias_id, semana_inicio, substituto_id) values
    (:'ausente_ferias_id', :'hoje'::date - 7, :'sai_id'),        -- passada, com o Sai: fica
    (:'ausente_ferias_id', :'hoje'::date + 7, :'sai_id'),        -- futura, com o Sai: apaga
    (:'ausente_ferias_id', :'hoje'::date + 14, :'colega_id'),    -- futura, com o Colega: fica
    (:'atravessa_id', :'hoje'::date + 7, :'colega_id');          -- para lá do novo fim das férias cortadas: apaga

insert into plantao_voluntarios (data_feriado, usuario_id, voluntario) values
    (:'hoje'::date + 12, :'sai_id', false),
    (:'hoje'::date - 12, :'sai_id', false),
    (:'hoje'::date + 12, :'colega_id', false);

insert into trocas_escala (usuario_proponente, usuario_substituto, semana_ref, status) values
    (:'sai_id', :'colega_id', :'sab_futuro', 'PROPOSTA'),
    (:'colega_id', :'sai_id', :'sab_futuro'::date + 7, 'PROPOSTA'),
    (:'sai_id', :'colega_id', :'sab_passado', 'APROVADA');

-- ---------------------------------------------------------------------
-- A função de limpeza apaga dados de qualquer pessoa: não pode estar
-- aberta a anon nem a authenticated (a Supabase dá EXECUTE aos dois por
-- defeito; revogar só de public não chega).
-- ---------------------------------------------------------------------
select is(has_function_privilege('anon', 'limpar_dados_futuros_de_utilizador(uuid, date)', 'execute'), false,
    'a limpeza não pode ser chamada por um utilizador anónimo');
select is(has_function_privilege('authenticated', 'limpar_dados_futuros_de_utilizador(uuid, date)', 'execute'), false,
    'a limpeza não pode ser chamada por um utilizador autenticado');

-- ---------------------------------------------------------------------
-- Desativar. Tem de passar mesmo com um par antigo de férias sobrepostas
-- (o troço das férias do Sai que fica sobrepõe as do Colega) e com uma
-- delegação já usada — a limpeza nunca pode impedir uma desativação.
-- ---------------------------------------------------------------------
select lives_ok(
    format($f$ update usuarios set ativo = false where id = %L $f$, :'sai_id'),
    'desativar não falha, mesmo com um par antigo de férias sobrepostas e com uma delegação já usada'
);

-- escala
select is((select count(*)::int from escala_semanal where usuario_id = :'sai_id' and semana_ref = :'sab_futuro'::date), 0,
    'escala: a semana futura de quem saiu é apagada');
select is((select count(*)::int from escala_semanal where usuario_id = :'sai_id' and semana_ref = :'sab_passado'::date), 1,
    'escala: a semana anterior à data fica (histórico)');
select is((select count(*)::int from escala_semanal where usuario_id = :'colega_id' and semana_ref = :'sab_futuro'::date), 1,
    'escala: a de um colega que continua nunca é tocada');

-- férias
select is((select count(*)::int from ferias where usuario_id = :'sai_id' and data_inicio = :'hoje'::date + 10), 0,
    'férias: as que começam depois da data são apagadas');
select is((select count(*)::int from ferias where usuario_id = :'sai_id' and data_inicio = :'hoje'::date - 40), 1,
    'férias: as já gozadas ficam (histórico)');
select is((select data_fim from ferias where id = :atravessa_id), :'hoje'::date - 1,
    'férias: as que atravessam a data ficam só até ao dia anterior');
select is((select count(*)::int from ferias where usuario_id = :'sai_id' and status = 'REJEITADA'), 1,
    'férias: uma pedida e rejeitada fica — não ocupa tempo nenhum');
select is((select count(*)::int from ferias where usuario_id = :'colega_id'), 2,
    'férias: as de um colega que continua nunca são tocadas');

-- substituições
select is((select count(*)::int from ferias_semanas where ferias_id = :ausente_ferias_id and substituto_id = :'sai_id' and semana_inicio = :'hoje'::date + 7), 0,
    'substituições: uma semana futura em que ele era o substituto de outra pessoa volta a "por decidir"');
select is((select count(*)::int from ferias_semanas where ferias_id = :ausente_ferias_id and substituto_id = :'sai_id' and semana_inicio = :'hoje'::date - 7), 1,
    'substituições: uma semana anterior à data fica (histórico)');
select is((select count(*)::int from ferias_semanas where ferias_id = :ausente_ferias_id and substituto_id = :'colega_id'), 1,
    'substituições: as escolhidas com um colega que continua nunca são tocadas');
select is((select count(*)::int from ferias_semanas where ferias_id = :atravessa_id), 0,
    'substituições: as semanas das férias cortadas que ficaram para lá do novo fim são apagadas');

-- plantões
select is((select count(*)::int from plantao_voluntarios where usuario_id = :'sai_id' and data_feriado = :'hoje'::date + 12), 0,
    'plantões: o de um feriado futuro é apagado');
select is((select count(*)::int from plantao_voluntarios where usuario_id = :'sai_id' and data_feriado = :'hoje'::date - 12), 1,
    'plantões: o de um feriado que já passou fica (histórico)');
select is((select count(*)::int from plantao_voluntarios where usuario_id = :'colega_id'), 1,
    'plantões: os de um colega que continua nunca são tocados');

-- delegações
select is((select count(*)::int from delegacoes_aprovacao where substituto = :'sai_id' and data_inicio = :'hoje'::date + 30), 0,
    'delegações: uma futura em que ele era o delegado é apagada');
select is((select count(*)::int from delegacoes_aprovacao where gerente_titular = :'sai_id' and data_inicio = :'hoje'::date + 40), 0,
    'delegações: uma futura em que ele era o titular é apagada');
select is((select data_fim from delegacoes_aprovacao where id = :atravessa_deleg_id), :'hoje'::date - 1,
    'delegações: a que atravessa a data fica só até ao dia anterior');
select is((select count(*)::int from delegacoes_aprovacao where substituto = :'sai_id' and data_inicio = :'hoje'::date - 60), 1,
    'delegações: uma já terminada fica (histórico)');
select is((select count(*)::int from delegacoes_aprovacao where id = :usada_id), 1,
    'delegações: uma já usada (referida na auditoria) não se apaga — a chave da auditoria não o permite');

-- trocas
select is((select count(*)::int from trocas_escala where status = 'PROPOSTA' and (usuario_proponente = :'sai_id' or usuario_substituto = :'sai_id')), 0,
    'trocas: as por decidir em que ele participava são apagadas');
select is((select count(*)::int from trocas_escala where status = 'APROVADA' and usuario_proponente = :'sai_id'), 1,
    'trocas: uma já decidida fica (histórico)');

-- auditoria
select is((select count(*)::int from logs_auditoria where acao = 'LIMPEZA_DADOS_FUTUROS' and descricao_detalhada like '%Sai 25%'), 1,
    'auditoria: fica um registo do que foi removido');

-- Já inativo: mexer outra vez não repete a limpeza nem duplica o registo.
update usuarios set ativo = false where id = :'sai_id';
select is((select count(*)::int from logs_auditoria where acao = 'LIMPEZA_DADOS_FUTUROS' and descricao_detalhada like '%Sai 25%'), 1,
    'a limpeza corre só na passagem de ativo para inativo, não em cada gravação');

-- Reativar não repõe o que foi apagado.
update usuarios set ativo = true where id = :'sai_id';
select is((select count(*)::int from ferias where usuario_id = :'sai_id' and data_inicio >= :'hoje'::date and status <> 'REJEITADA'), 0,
    'reativar não repõe o que foi apagado');

-- O caminho das Edge Functions: a desativação (manual, em gerir-utilizadores,
-- e por data_saida, em desactivar-saidos) faz-se com o role service_role, não
-- com o de ligação. O trigger e a função de limpeza são security definer, por
-- isso tem de resultar o mesmo — é isto que permite às funções não apagarem a
-- escala por conta própria (o que antes faziam, a partir do dia UTC).
set local role service_role;
update usuarios set ativo = false where id = :'sai_srv_id';
reset role;
select is((select count(*)::int from escala_semanal where usuario_id = :'sai_srv_id' and semana_ref = :'sab_futuro'::date), 0,
    'como service_role (o caminho das Edge Functions), desativar também apaga a escala futura');
select is((select count(*)::int from logs_auditoria where acao = 'LIMPEZA_DADOS_FUTUROS' and descricao_detalhada like '%Sai Servidor 25%'), 1,
    'e deixa o registo de auditoria da limpeza');

select * from finish();
rollback;
