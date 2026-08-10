-- =====================================================================
-- Replica o substituto único já confirmado nas férias existentes
-- (migração 0009) para cada semana civil que a ausência toca, no novo
-- modelo de ferias_semanas (migração 0025) — e remove os 4 campos
-- antigos de ferias, que passam a viver só na tabela nova. Sem isto,
-- código que dependesse de ferias.substituto_id perderia silenciosamente
-- as escolhas já feitas.
--
-- generate_series arranca na Segunda-feira da semana de data_inicio
-- (extract(isodow ...) - 1 dias antes) e avança de 7 em 7 dias até
-- data_fim; o filtro (semana + 4) >= data_inicio descarta a única
-- semana "fantasma" possível — quando data_inicio cai ao fim de
-- semana, a Segunda dessa semana existe mas a Sexta correspondente já
-- é anterior ao início real da ausência.
--
-- Caso especial: a férias id=79 (Caique, 20/08-28/08, substituto
-- Kilson) é precisamente o exemplo real que motivou esta migração — a
-- réplica mecânica poria Kilson nas duas semanas (17/08 e 24/08),
-- preservando o problema reportado. Excluída do backfill genérico e
-- inserida a seguir já com a divisão correta: 17/08 (ponta de 20-21/08,
-- fecha o ciclo em curso) sem substituto, 24/08 (semana seguinte
-- completa) com Kilson.
-- =====================================================================

insert into ferias_semanas (ferias_id, semana_inicio, substituto_id, confirmado_por, confirmado_em)
select
    f.id,
    semana::date,
    f.substituto_id,
    f.confirmado_por,
    f.confirmado_em
from ferias f
cross join lateral generate_series(
    f.data_inicio - ((extract(isodow from f.data_inicio)::int - 1) || ' days')::interval,
    f.data_fim,
    interval '7 days'
) as semana
where f.substituicao_confirmada = true
  and f.id <> 79
  and (semana::date + 4) >= f.data_inicio
on conflict (ferias_id, semana_inicio) do nothing;

insert into ferias_semanas (ferias_id, semana_inicio, substituto_id, confirmado_por, confirmado_em)
select 79, '2026-08-17'::date, null, confirmado_por, confirmado_em from ferias where id = 79
union all
select 79, '2026-08-24'::date, substituto_id, confirmado_por, confirmado_em from ferias where id = 79
on conflict (ferias_id, semana_inicio) do nothing;

alter table ferias drop column if exists substituto_id;
alter table ferias drop column if exists substituicao_confirmada;
alter table ferias drop column if exists confirmado_por;
alter table ferias drop column if exists confirmado_em;
