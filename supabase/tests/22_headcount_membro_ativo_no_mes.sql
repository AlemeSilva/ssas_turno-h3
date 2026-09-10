-- =====================================================================
-- Migração 0047: calcular_headcount() passa a contar quem esteve
-- presente em pelo menos 1 dia do mês a calcular (criado_em até ao fim
-- do mês E, se já saiu, data_saida dentro ou depois do mês), não só
-- quem está ativo agora. Achado ao fechar retroativamente
-- abril-agosto/2026 com a saída do Pedro a meio de agosto.
--
-- Todos os tests.criar_usuario() têm de correr antes de qualquer
-- autenticar_como() (não é security definer) — por isso os 4
-- utilizadores sintéticos coexistem desde o início, cada um com uma
-- janela de presença [criado_em, data_saida] fixa e deliberadamente
-- espaçada por mês, para que cada asserção isole um facto específico
-- mesmo com todos já criados. V (sempre ativo) serve de "fundo"
-- constante (+1 em qualquer mês) — a mesma pessoa em todas as
-- asserções, sem regressão do caso comum.
--
--   V: sempre ativo desde 2020                    (fundo constante)
--   Z: presente só em jan/2025 (entra e sai dentro do mesmo mês)
--   Y: presente fev-abr/2025 (entra dia 1 fev, sai a meio de abril)
--   W: presente só em mar/2025, OPERADOR_H3 (entra e sai dentro do mês)
--   X: entra a meio de maio/2025, fica ativo (sem data_saida)
-- =====================================================================
begin;
select plan(8);

select tests.criar_usuario('Ger Headcount22', 'ger-headcount22@teste.pt', 'GERENTE') as ger_id \gset
select tests.criar_usuario('V Sempre Ativo22', 'v-sempre-ativo22@teste.pt', 'OPERADOR') as v_id \gset
select tests.criar_usuario('Z Jan Inteiro22', 'z-jan-inteiro22@teste.pt', 'OPERADOR', false) as z_id \gset
select tests.criar_usuario('Y Fev A Abril22', 'y-fev-a-abril22@teste.pt', 'OPERADOR', false) as y_id \gset
select tests.criar_usuario('W H3 So Marco22', 'w-h3-so-marco22@teste.pt', 'OPERADOR_H3', false) as w_id \gset
select tests.criar_usuario('X Entra Maio22', 'x-entra-maio22@teste.pt', 'OPERADOR', true) as x_id \gset

-- Janelas de presença — ainda como role de ligação, antes de
-- autenticar, sem precisar de passar por RLS (é só preparação).
update usuarios set criado_em = '2020-01-01T00:00:00Z' where id = :'v_id';
update usuarios set criado_em = '2025-01-10T00:00:00Z', data_saida = '2025-01-25' where id = :'z_id';
update usuarios set criado_em = '2025-02-01T00:00:00Z', data_saida = '2025-04-10' where id = :'y_id';
update usuarios set criado_em = '2025-03-10T00:00:00Z', data_saida = '2025-03-25' where id = :'w_id';
update usuarios set criado_em = '2025-05-20T00:00:00Z' where id = :'x_id';

select tests.autenticar_como(:'ger_id');

-- 1) Antes de todos (incluindo V) — folha limpa mesmo com os 5
-- sintéticos já criados na transação.
select is(
    (select headcount_real from calcular_headcount('2019-06-01', 0, 0)), 0,
    'mês anterior à entrada de qualquer sintético (incluindo V) tem headcount_real = 0'
);

-- 2) Z entra e sai dentro do mesmo mês (jan/2025) — conta nesse mês
-- mesmo tendo lá estado só 15 dias.
select is(
    (select headcount_real from calcular_headcount('2025-01-01', 0, 0)), 2,
    'Z (entrou e saiu dentro de janeiro) conta em janeiro — só V+Z, ninguém mais nasceu ainda'
);

-- 3) Fevereiro: Z já não conta (saiu a 25/01, antes de fevereiro
-- começar) — o padrão exato do Pedro. Y entra dia 1 e já conta.
select is(
    (select headcount_real from calcular_headcount('2025-02-01', 0, 0)), 2,
    'Z já não conta em fevereiro (saiu antes do mês começar) — Y (entrou dia 1) substitui-o no total, V+Y'
);

-- 4) Março: W entra a meio do mês e já conta, somando-se a Y (ainda
-- presente, só sai em abril).
select is(
    (select headcount_real from calcular_headcount('2025-03-01', 0, 0)), 3,
    'W (entrou a meio de março) conta em março, somado a V+Y ainda presentes — headcount_real sobe para 3'
);

-- 5) A mesma regra aplica-se a operador_h3_ativo — W é OPERADOR_H3.
select is(
    (select operador_h3_ativo from calcular_headcount('2025-03-01', 0, 0)), 1,
    'W conta em operador_h3_ativo em março, não só na contagem combinada'
);

-- 6) Abril: W já não conta (saiu a 25/03, antes de abril começar) —
-- mesmo padrão do Pedro, agora sobre um OPERADOR_H3. Y ainda conta
-- (só sai a meio de abril).
select is(
    (select headcount_real from calcular_headcount('2025-04-01', 0, 0)), 2,
    'W já não conta em abril (saiu antes do mês começar) — V+Y'
);

-- 7) operador_h3_ativo cai para 0 em abril, especificamente por causa
-- da exclusão do W — confirma que a regra de fronteira se aplica a
-- este campo isoladamente, não só ao total combinado.
select is(
    (select operador_h3_ativo from calcular_headcount('2025-04-01', 0, 0)), 0,
    'operador_h3_ativo cai para 0 em abril — W já não conta, e não há mais nenhum H3 sintético'
);

-- 8) Maio: Y já não conta (saiu a 10/04, antes de maio começar); X
-- entra a meio do mês e já conta. V continua sempre presente — caso
-- comum sem regressão em todas as asserções acima.
select is(
    (select headcount_real from calcular_headcount('2025-05-01', 0, 0)), 2,
    'Y já não conta em maio (saiu antes do mês começar) e X (entrou a meio do mês) já conta — V+X'
);

select * from finish();
rollback;
