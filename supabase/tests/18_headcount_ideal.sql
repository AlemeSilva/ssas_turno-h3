-- Pressupõe a migração 0039_headcount_ideal.sql já aplicada (caminho
-- oficial: supabase test db aplica as migrações antes de correr os
-- testes). Para correr manualmente contra produção sem Docker (ver
-- README), concatenar migração + este ficheiro antes do `begin;`.
begin;
select plan(26);

-- =====================================================================
-- Fase 1 — preparação (ainda como o role de ligação, que faz bypass de
-- RLS por omissão — é aqui que fazemos os INSERT diretos que a app
-- nunca faz, e testamos a imutabilidade em bypass de RLS).
-- =====================================================================

-- Isola de qualquer OPERADOR/OPERADOR_H3 real — as funções de cálculo
-- somam sobre TODOS os ativos, não só os sintéticos desta suite.
update usuarios set ativo = false where perfil in ('OPERADOR', 'OPERADOR_H3') and ativo;

-- Desde a migração 0044, trg_valida_ferias bloqueia sobreposição entre
-- QUALQUER par de colegas (não só OPERADOR_H3) — limpa férias reais de
-- maio/junho de 2026 só dentro desta transação (revertida no fim),
-- para os cenários sintéticos abaixo não colidirem com dados reais.
delete from ferias where data_inicio <= '2026-12-31' and data_fim >= '2026-01-01';

select tests.criar_usuario('Titular HC Teste', 'titular.hc@x.pt', 'GERENTE') as titular_id \gset
select tests.criar_usuario('Operador Simples HC Teste', 'operador.hc@x.pt', 'OPERADOR', false) as operador_id \gset
select tests.criar_usuario('Delegado HC Teste', 'delegado.hc@x.pt', 'OPERADOR_H3') as delegado_id \gset
-- O perfil (OPERADOR, não OPERADOR_H3) não afeta este teste —
-- calcular_headcount conta OPERADOR e OPERADOR_H3 da mesma forma.
select tests.criar_usuario('Sobreposicao HC Teste', 'sobreposicao.hc@x.pt', 'OPERADOR', false) as overlap_id \gset
select tests.criar_usuario('Recorte Mes HC Teste', 'recorte.hc@x.pt', 'OPERADOR', false) as crossmonth_id \gset

insert into delegacoes_aprovacao (gerente_titular, substituto, data_inicio, data_fim)
values (:'titular_id', :'delegado_id', current_date - 1, current_date + 1);

-- Férias + licença sobrepostas na mesma pessoa (junho/2026): a app não
-- tem trigger nenhum que impeça isto consigo própria (a verificação
-- "entre colegas" de trg_valida_ferias exclui sempre f.usuario_id =
-- new.usuario_id). Datas escolhidas para não colidir com crossmonth_id
-- (28/maio a 6/junho) — desde 0044 essa sobreposição, entre pessoas
-- diferentes, já bloquearia.
insert into ferias (usuario_id, data_inicio, data_fim, status, tipo)
values (:'overlap_id', '2026-06-10', '2026-06-19', 'APROVADA', 'FERIAS');
insert into ferias (usuario_id, data_inicio, data_fim, status, tipo)
values (:'overlap_id', '2026-06-14', '2026-06-17', 'APROVADA', 'LICENCA');

-- Férias a cavalo entre dois meses (28/maio a 6/junho de 2026).
insert into ferias (usuario_id, data_inicio, data_fim, status, tipo)
values (:'crossmonth_id', '2026-05-28', '2026-06-06', 'APROVADA', 'FERIAS');

-- Mês já fechado à mão (só para servir de "último mês fechado" ao
-- teste de backfill) e teste de imutabilidade em bypass de RLS —
-- superuser não passa pela RLS, só o trigger é que pode bloquear.
insert into headcount_mensal (mes_referencia, fechado, fechado_por, fechado_em)
values ('2025-01-01', true, :'titular_id', now());

select throws_ok(
    $$ update headcount_mensal set volume_pedidos = 999 where mes_referencia = '2025-01-01' $$,
    'P0001', 'Mês de headcount já fechado é definitivo — sem reabertura.',
    'imutabilidade: mesmo em bypass de RLS (superuser), um mês fechado não pode ser alterado'
);

-- Rascunhos fixos que a app nunca criaria sozinha nestas datas — só a
-- própria função de INSERT direto consegue, por isso feito aqui.
insert into headcount_mensal (mes_referencia, volume_pedidos) values (date_trunc('month', current_date)::date, 50);
insert into headcount_mensal (mes_referencia, volume_pedidos) values ('2025-07-01', 200);
insert into headcount_mensal (mes_referencia) values ('2025-05-01'); -- volume_pedidos fica null de propósito

-- =====================================================================
-- Fase 2 — acesso e RLS
-- =====================================================================

select tests.autenticar_como(:'titular_id');

select lives_ok(
    $$ select * from calcular_headcount(date_trunc('month', current_date - interval '2 months')::date, 100, 0) $$,
    'titular consegue chamar calcular_headcount (pré-visualização)'
);
select is(
    (select count(*)::int from headcount_parametros), 1,
    'titular vê a linha singleton de headcount_parametros'
);

select tests.autenticar_como(:'delegado_id');
select lives_ok(
    $$ select * from calcular_headcount(date_trunc('month', current_date - interval '2 months')::date, 100, 0) $$,
    'delegado consegue chamar calcular_headcount (pré-visualização)'
);

select tests.autenticar_como(:'operador_id');
select throws_ok(
    $$ select * from calcular_headcount(date_trunc('month', current_date - interval '2 months')::date, 100, 0) $$,
    'P0001', 'Não autorizado.',
    'operador simples (nem titular nem delegado) não consegue chamar calcular_headcount'
);
select is(
    (select count(*)::int from headcount_parametros), 0,
    'operador simples não vê nenhuma linha de headcount_parametros (RLS select)'
);
select throws_ok(
    $$ select garantir_rascunho_headcount_mensal() $$,
    'P0001', 'Não autorizado.',
    'operador simples não consegue chamar garantir_rascunho_headcount_mensal'
);

-- =====================================================================
-- Fase 3 — parâmetros: titular edita e fica em auditoria; delegado não
-- =====================================================================

-- Antes/depois, não um total absoluto — em produção já pode haver
-- entradas de auditoria reais de utilização anterior a este teste.
select count(*)::int as auditoria_antes
  from logs_auditoria where referencia_tipo = 'HEADCOUNT_PARAMETROS' and acao = 'ALTERACAO_PARAMETRO' \gset

select tests.autenticar_como(:'titular_id');
update headcount_parametros set tempo_medio_pedido_minutos = 45 where id = true;
select is(
    (select count(*)::int from logs_auditoria where referencia_tipo = 'HEADCOUNT_PARAMETROS' and acao = 'ALTERACAO_PARAMETRO'),
    :auditoria_antes + 1,
    'alteração de parâmetro pelo titular gera uma nova entrada em logs_auditoria'
);

select tests.autenticar_como(:'delegado_id');
update headcount_parametros set tempo_medio_pedido_minutos = 999 where id = true;

select tests.autenticar_como(:'titular_id');
select is(
    (select tempo_medio_pedido_minutos from headcount_parametros), 45::numeric,
    'delegado não consegue alterar parâmetros — RLS bloqueia, valor continua o que o titular definiu'
);

select tests.autenticar_como(:'delegado_id');
select throws_ok(
    format($f$ select fechar_mes_headcount(%L::date) $f$, '2025-07-01'::date),
    'P0001', 'Só o Gerente titular pode fechar um mês de headcount.',
    'delegado não consegue fechar um mês'
);

-- =====================================================================
-- Fase 4 — fórmula: sobreposição férias+licença (união, não soma)
-- =====================================================================

select tests.autenticar_como(:'titular_id');
-- delegado_id continuava ativo (perfil OPERADOR_H3, sem férias) desde
-- a Fase 2 — tem de sair antes destes cálculos isolados, senão soma a
-- capacidade dele por cima da da pessoa em teste.
update usuarios set ativo = false where id = :'delegado_id';
update usuarios set ativo = true where id = :'overlap_id';

select capacidade_presente_horas_equipa as cap_overlap
from calcular_headcount('2026-06-01', 0, 0) \gset
select is(
    :'cap_overlap'::numeric, 136::numeric,
    'sobreposição férias+licença conta 10 dias ausentes por união (30-10=20 dias × 8h × 0,85 = 136h), não 14 por soma ingénua'
);

-- =====================================================================
-- Fase 5 — fórmula: recorte de férias às fronteiras do mês
-- =====================================================================

update usuarios set ativo = false where id = :'overlap_id';
update usuarios set ativo = true where id = :'crossmonth_id';

select capacidade_presente_horas_equipa as cap_ago, capacidade_plena_horas_pessoa as plena_1
from calcular_headcount('2026-05-01', 0, 0) \gset
select capacidade_presente_horas_equipa as cap_set, capacidade_plena_horas_pessoa as plena_set_1
from calcular_headcount('2026-06-01', 0, 0) \gset

select is(:'cap_ago'::numeric, 183.6::numeric, 'férias a cavalo em 2 meses só desconta os 4 dias de maio em maio (31-4=27 × 8h × 0,85)');
select is(:'cap_set'::numeric, 163.2::numeric, 'férias a cavalo em 2 meses só desconta os 6 dias de junho em junho (30-6=24 × 8h × 0,85)');

-- capacidade plena por pessoa não pode depender de quantas pessoas há
update usuarios set ativo = true where id = :'overlap_id'; -- agora 2 pessoas ativas em junho
select capacidade_plena_horas_pessoa as plena_set_2
from calcular_headcount('2026-06-01', 0, 0) \gset
select is(
    :'plena_set_2'::numeric, :'plena_set_1'::numeric,
    'capacidade plena por pessoa é igual com 1 ou 2 pessoas ativas — nunca depende do headcount'
);

-- =====================================================================
-- Fase 6 — fórmula: taxa_cobertura_ferias (reserva estrutural)
-- =====================================================================

-- O fator só entra em capacidade_plena_horas_pessoa (nominal). Nunca
-- em capacidade_presente_horas_equipa — essa já desconta a ausência
-- REAL do mês via dias_ausente; aplicar as duas seria duplo desconto.
select capacidade_plena_horas_pessoa as plena_defeito, capacidade_presente_horas_equipa as presente_defeito
from calcular_headcount('2026-06-01', 0, 0) \gset

update headcount_parametros set taxa_cobertura_ferias = 0.5 where id = true;

select capacidade_plena_horas_pessoa as plena_alterado, capacidade_presente_horas_equipa as presente_alterado
from calcular_headcount('2026-06-01', 0, 0) \gset

select is(
    :'plena_alterado'::numeric, 102::numeric,
    'capacidade_plena_horas_pessoa aplica taxa_cobertura_ferias (30 dias × 8h × 0,85 × 0,5 = 102h)'
);
select isnt(
    :'plena_alterado'::numeric, :'plena_defeito'::numeric,
    'alterar taxa_cobertura_ferias muda a capacidade plena'
);
select is(
    :'presente_alterado'::numeric, :'presente_defeito'::numeric,
    'capacidade_presente_horas_equipa não é afetada por taxa_cobertura_ferias — evita duplo desconto de férias'
);

update headcount_parametros set taxa_cobertura_ferias = 0.9 where id = true;

-- =====================================================================
-- Fase 7 — equipa vazia
-- =====================================================================

update usuarios set ativo = false where id in (:'overlap_id', :'crossmonth_id', :'delegado_id');
select headcount_real as hr_vazio, capacidade_presente_horas_equipa as cap_vazio
from calcular_headcount('2026-06-01', 0, 0) \gset
select is(:'hr_vazio'::int, 0, 'equipa sem ninguém ativo: headcount_real = 0, sem erro');
select is(:'cap_vazio'::numeric, 0::numeric, 'equipa sem ninguém ativo: capacidade_presente_horas_equipa = 0, sem erro');

-- =====================================================================
-- Fase 8 — guardas e ciclo de vida do fecho
-- =====================================================================

select throws_ok(
    $$ select fechar_mes_headcount('2020-01-01'::date) $$,
    'P0001', 'Não existe rascunho de headcount para 2020-01-01.',
    'fechar_mes_headcount falha se não existe nenhum rascunho para o mês'
);

select throws_ok(
    format($f$ select fechar_mes_headcount(%L::date) $f$, date_trunc('month', current_date)::date),
    'P0001', 'Só é possível fechar um mês depois de ele ter terminado.',
    'fechar_mes_headcount falha se o mês ainda não terminou'
);

select throws_ok(
    format($f$ select fechar_mes_headcount(%L::date) $f$, '2025-05-01'::date),
    'P0001', 'Preenche o volume de pedidos antes de fechar o mês.',
    'fechar_mes_headcount falha se volume_pedidos ainda está por preencher'
);

select lives_ok(
    $$ select fechar_mes_headcount('2025-07-01'::date) $$,
    'fechar_mes_headcount tem sucesso com o mês terminado e volume preenchido'
);

select throws_ok(
    $$ select fechar_mes_headcount('2025-07-01'::date) $$,
    'P0001', 'O mês 2025-07-01 já está fechado.',
    'fechar_mes_headcount falha ao tentar fechar um mês já fechado'
);

update headcount_mensal set volume_pedidos = 999 where mes_referencia = '2025-07-01';
select is(
    (select volume_pedidos from headcount_mensal where mes_referencia = '2025-07-01'), 200,
    'depois de fechado, uma tentativa normal de UPDATE (mesmo pelo titular) não altera nada — RLS já filtra a linha'
);

-- =====================================================================
-- Fase 9 — backfill de rascunhos em atraso
-- =====================================================================

-- Nesta altura o mês fechado mais recente já não é o 2025-01 semeado
-- na Fase 1 — a Fase 8 fechou 2025-07 de verdade a meio do caminho,
-- que é posterior. O backfill conta a partir do fechado mais recente,
-- por isso o teste tem de verificar a partir de 2025-08, não 2025-02.
select garantir_rascunho_headcount_mensal();
select is(
    (select count(*)::int from headcount_mensal where mes_referencia in ('2025-08-01', '2025-09-01') and not fechado),
    2,
    'garantir_rascunho_headcount_mensal cria as linhas em falta desde o último mês fechado (2025-07, fechado na Fase 7), não só a mais recente'
);

select * from finish();
rollback;
