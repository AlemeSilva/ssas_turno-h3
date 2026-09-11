-- =====================================================================
-- O Headcount Ideal só olhava para horas de carga ÷ capacidade por
-- pessoa — uma conta puramente fungível, sem noção de turno. Achado do
-- Gerente, 2026-09-11: com os parâmetros reais, isso dava "ideal =
-- 3,3" contra uma equipa real de 5, classificando como sobre-
-- dimensionado — mas 3,3 pessoas não chegam para cobrir H1+H2+H3 em
-- simultâneo (1 pessoa cada, sempre), nem para a garantia contratual:
-- a equipa opera 24x7 e o contrato exige que o nº de pessoas
-- necessárias em H1+H2+H3 ao mesmo tempo nunca ultrapasse 50% do total
-- da equipa — ou seja, o total tem de ser sempre pelo menos o dobro
-- desse mínimo concorrente, para sustentar rotação de férias e
-- ausências sem furar a cobertura.
--
-- Dois parâmetros novos, editáveis como todos os outros:
--   minimo_turnos_criticos — pessoas em simultâneo nos turnos
--     obrigatórios (hoje H1+H2+H3 = 1+1+1 = 3; H4 não conta, absorve
--     quem sobra nas transições, não é um posto próprio).
--   garantia_contratual_fracao — a fração contratual (hoje 50%).
--
-- mínimo_estrutural = minimo_turnos_criticos / garantia_contratual_fracao
-- ideal_final = max(ideal_por_horas, mínimo_estrutural)
--
-- Aplicado em src/lib/headcount.ts (aplicarMinimoEstrutural) e
-- src/lib/cenarios-headcount.ts (Estudo de Cenários, para não ficar
-- dessincronizado do critério real). "Ideal" e "classificação" nunca
-- são gravados em headcount_mensal — são sempre recalculados ao vivo a
-- partir das colunas congeladas — por isso esta correção já se aplica
-- retroativamente a todos os meses fechados sem reabrir nenhuma linha
-- nem tocar em trg_headcount_mensal_bloqueia_reabertura.
-- =====================================================================

alter table headcount_parametros
    add column if not exists minimo_turnos_criticos integer not null default 3,
    add column if not exists garantia_contratual_fracao numeric not null default 0.50;

do $$ begin
    alter table headcount_parametros add constraint chk_minimo_turnos_criticos check (minimo_turnos_criticos >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
    alter table headcount_parametros add constraint chk_garantia_contratual_fracao check (garantia_contratual_fracao > 0 and garantia_contratual_fracao <= 1);
exception when duplicate_object then null;
end $$;

comment on column headcount_parametros.minimo_turnos_criticos is 'Pessoas em simultâneo exigidas nos turnos obrigatórios (H1+H2+H3). H4 não conta — absorve quem sobra, não é um posto próprio.';
comment on column headcount_parametros.garantia_contratual_fracao is 'Fração contratual: o mínimo concorrente (minimo_turnos_criticos) nunca pode exceder esta fração do total da equipa. Define o piso estrutural do Headcount Ideal, independente da carga de trabalho.';
