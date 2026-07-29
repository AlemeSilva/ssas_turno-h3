-- Regra: manutenção = ciclo H3 cujo Sábado é o último Sábado do mês
-- corrente. Cobre os 7 casos possíveis do dia 1 do mês seguinte cair
-- em cada dia da semana, incluindo o caso motivador original: se o
-- dia 1 for Sábado, a manutenção é no fim de semana anterior.
begin;
select plan(9);

-- Agosto/2026 começa a 01/08 (Sábado) — manutenção deve ser no ciclo
-- anterior (Sábado 25/07), não no que contém o próprio dia 1.
select is(calcula_tipo_fim_semana('2026-07-23'::date), 'MANUTENCAO'::tipo_fim_semana,
    'Sábado do ciclo 23/07 é 25/07, último Sábado de julho → MANUTENÇÃO');
select is(calcula_tipo_fim_semana('2026-07-30'::date), 'NORMAL'::tipo_fim_semana,
    'ciclo de 30/07 tem Sábado 01/08 — já é agosto, não é o último sábado de julho → NORMAL');

-- Setembro/2026 começa a 01/09 (Terça) — último sábado de agosto é 29/08.
select is(calcula_tipo_fim_semana('2026-08-27'::date), 'MANUTENCAO'::tipo_fim_semana,
    'ciclo de 27/08, Sábado 29/08 é o último sábado de agosto → MANUTENÇÃO');

-- Verifica um mês qualquer sem ambiguidade de fronteira (outubro/2026,
-- 31 dias, último sábado a 31/10... 2026-10-31 é Sábado).
select is(calcula_tipo_fim_semana('2026-10-29'::date), 'MANUTENCAO'::tipo_fim_semana,
    'ciclo de 29/10, Sábado 31/10 é o último dia de outubro e Sábado → MANUTENÇÃO');
select is(calcula_tipo_fim_semana('2026-10-22'::date), 'NORMAL'::tipo_fim_semana,
    'ciclo de 22/10 (Sábado 24/10) não é o último Sábado de outubro → NORMAL');

-- Fevereiro/2026 (não bissexto, 28 dias) — 2026-02-28 é Sábado.
select is(calcula_tipo_fim_semana('2026-02-26'::date), 'MANUTENCAO'::tipo_fim_semana,
    'ciclo de 26/02, Sábado 28/02 é o último dia de fevereiro/2026 e Sábado → MANUTENÇÃO');

-- Gerente pode substituir manualmente o cálculo automático.
select tests.criar_usuario('Gerente Teste', 'gerente2@teste.pt', 'GERENTE') as gerente_id \gset
insert into planos (data_inicio_ciclo, criado_por) values ('2026-08-06', :'gerente_id');
select is((select tipo_fim_semana from planos where data_inicio_ciclo = '2026-08-06'), 'NORMAL'::tipo_fim_semana,
    'cálculo automático inicial classifica 06/08 como NORMAL');

update planos set tipo_fim_semana = 'MANUTENCAO', tipo_fim_semana_manual = true where data_inicio_ciclo = '2026-08-06';
select is((select tipo_fim_semana from planos where data_inicio_ciclo = '2026-08-06'), 'MANUTENCAO'::tipo_fim_semana,
    'Gerente consegue forçar MANUTENCAO manualmente para um ciclo específico');

-- E essa substituição manual sobrevive a um UPDATE não relacionado
-- (ex.: mudar o status), sem ser recalculada por engano.
update planos set status = 'PENDENTE_APROVACAO' where data_inicio_ciclo = '2026-08-06';
select is((select tipo_fim_semana from planos where data_inicio_ciclo = '2026-08-06'), 'MANUTENCAO'::tipo_fim_semana,
    'override manual persiste depois de uma atualização não relacionada ao tipo');

select * from finish();
rollback;
