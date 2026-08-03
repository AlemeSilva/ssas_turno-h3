-- =====================================================================
-- Preenchimento automático da escala do ano seguinte, sem intervenção
-- manual — decisão do Gerente em 2026-08-03: "isto tem de ser
-- definitivo a partir de agora".
--
-- Corre uma vez por ano (agendado via pg_cron mais abaixo, para 1 de
-- Novembro), preenchendo Janeiro a Dezembro do ano seguinte de uma só
-- vez. Regras aplicadas (todas confirmadas explicitamente pelo
-- Gerente em 2026-08-03):
--
--   - H3 roda entre Bruno/Caique/Kilson: menor contagem de H3 nos
--     últimos 3 meses primeiro, respeitando limite_h3_mensal por
--     pessoa (mesma regra de escolherOperadorH3() em
--     supabase/functions/sugerir-escala/algoritmo.ts — reimplementada
--     aqui em SQL porque esta função tem de correr de forma
--     autónoma, sem depender de deploy de Edge Function).
--   - H2 roda só entre Bruno e Caique, nunca o Kilson.
--   - Nas semanas em que o Kilson está de H3: Bruno fica de H2,
--     Caique fica de H4.
--   - Nas restantes semanas (Bruno ou Caique de H3): o outro dos dois
--     fica de H2, o Kilson fica de H4.
--   - H1 e H4 "fixos" (quem não está no trio de rotação H3) mantêm-se
--     com a mesma pessoa o ano inteiro — replica a atribuição mais
--     recente já existente.
--
-- LIMITAÇÃO CONHECIDA, por escolha deliberada: os papéis de Bruno/
-- Caique/Kilson estão fixados por nome, não são genéricos — é assim
-- que o Gerente descreveu a regra (específica a estas 3 pessoas, não
-- "quem quer que seja OPERADOR_H3"). Se o trio ou os seus papéis
-- mudarem antes de uma próxima Novembro, esta função tem de ser
-- atualizada manualmente — falha em vez de adivinhar (ver exception
-- abaixo).
--
-- Idempotente: não faz nada se já existir alguma linha para o ano-
-- alvo, para nunca duplicar/sobrepor um preenchimento já feito.
-- =====================================================================

create or replace function preencher_escala_anual()
returns void
language plpgsql
as $function$
declare
    v_ano int := extract(year from current_date)::int + 1;
    v_inicio_ano date := make_date(v_ano, 1, 1);
    v_fim_ano date := make_date(v_ano, 12, 31);
    v_semana date;
    v_kilson_id uuid;
    v_bruno_id uuid;
    v_caique_id uuid;
    v_candidatos uuid[];
    v_ordenados uuid[];
    v_dentro_limite uuid[];
    v_cand uuid;
    v_h3_escolhido uuid;
    v_limite int;
    v_contagem_mes int;
    v_tres_meses_atras date;
    v_inicio_mes date;
    v_ficam_h1 uuid[];
    v_ficam_h4 uuid[];
    v_id uuid;
    v_total_semanas int := 0;
begin
    if exists (select 1 from escala_semanal where extract(year from semana_ref) = v_ano) then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_IGNORADO',
                format('Já existiam dados de escala para %s — preenchimento automático não repetido.', v_ano));
        return;
    end if;

    select id into v_kilson_id from usuarios where nome = 'Kilson' and perfil = 'OPERADOR_H3' and ativo;
    select id into v_bruno_id from usuarios where nome = 'Bruno' and perfil = 'OPERADOR_H3' and ativo;
    select id into v_caique_id from usuarios where nome = 'Caique' and perfil = 'OPERADOR_H3' and ativo;

    if v_kilson_id is null or v_bruno_id is null or v_caique_id is null then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_FALHOU',
                format('Não encontrei Bruno/Caique/Kilson ativos como OPERADOR_H3 ao preencher %s — função precisa de revisão manual.', v_ano));
        raise exception 'preencher_escala_anual: Bruno/Caique/Kilson não encontrados ativos como OPERADOR_H3 — rever a função.';
    end if;

    v_candidatos := array[v_bruno_id, v_caique_id, v_kilson_id];

    select array_agg(usuario_id) into v_ficam_h1
      from escala_semanal
     where turno = 'H1' and usuario_id <> all(v_candidatos)
       and semana_ref = (select max(semana_ref) from escala_semanal where turno = 'H1');

    select array_agg(usuario_id) into v_ficam_h4
      from escala_semanal
     where turno = 'H4' and usuario_id <> all(v_candidatos)
       and semana_ref = (select max(semana_ref) from escala_semanal where turno = 'H4');

    for v_semana in
        select d::date from generate_series(v_inicio_ano, v_fim_ano, interval '1 day') d
        where extract(dow from d) = 6 -- Sábado
    loop
        v_tres_meses_atras := v_semana - interval '3 months';
        v_inicio_mes := date_trunc('month', v_semana)::date;

        select array_agg(id order by cnt asc) into v_ordenados
          from (
              select cand.id, (
                  select count(*) from escala_semanal e
                   where e.turno = 'H3' and e.usuario_id = cand.id
                     and e.semana_ref >= v_tres_meses_atras and e.semana_ref < v_semana
              ) as cnt
              from unnest(v_candidatos) as cand(id)
          ) t;

        v_dentro_limite := array[]::uuid[];
        foreach v_cand in array v_ordenados loop
            select limite_h3_mensal into v_limite from usuarios where id = v_cand;
            select count(*) into v_contagem_mes
              from escala_semanal
             where turno = 'H3' and usuario_id = v_cand
               and semana_ref >= v_inicio_mes and semana_ref < v_semana;
            if v_limite is null or v_contagem_mes < v_limite then
                v_dentro_limite := v_dentro_limite || v_cand;
            end if;
        end loop;

        v_h3_escolhido := coalesce(v_dentro_limite[1], v_ordenados[1]);

        insert into escala_semanal (semana_ref, usuario_id, turno, criado_por)
        values (v_semana, v_h3_escolhido, 'H3', null)
        on conflict (semana_ref, usuario_id) do update set turno = 'H3';

        if v_h3_escolhido = v_kilson_id then
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_bruno_id, 'H2', null) on conflict (semana_ref, usuario_id) do update set turno = 'H2';
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_caique_id, 'H4', null) on conflict (semana_ref, usuario_id) do update set turno = 'H4';
        elsif v_h3_escolhido = v_bruno_id then
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_caique_id, 'H2', null) on conflict (semana_ref, usuario_id) do update set turno = 'H2';
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_kilson_id, 'H4', null) on conflict (semana_ref, usuario_id) do update set turno = 'H4';
        else
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_bruno_id, 'H2', null) on conflict (semana_ref, usuario_id) do update set turno = 'H2';
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_kilson_id, 'H4', null) on conflict (semana_ref, usuario_id) do update set turno = 'H4';
        end if;

        if v_ficam_h1 is not null then
            foreach v_id in array v_ficam_h1 loop
                insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_id, 'H1', null) on conflict (semana_ref, usuario_id) do update set turno = 'H1';
            end loop;
        end if;
        if v_ficam_h4 is not null then
            foreach v_id in array v_ficam_h4 loop
                insert into escala_semanal (semana_ref, usuario_id, turno, criado_por) values (v_semana, v_id, 'H4', null) on conflict (semana_ref, usuario_id) do update set turno = 'H4';
            end loop;
        end if;

        v_total_semanas := v_total_semanas + 1;
    end loop;

    insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
    values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO',
            format('Escala de %s preenchida automaticamente — %s semanas.', v_ano, v_total_semanas));
end;
$function$;

-- Agenda para todos os anos, 1 de Novembro às 03:00 UTC (fora de
-- horas de operação). "Somente no mês de Novembro" — decisão do
-- Gerente em 2026-08-03.
select cron.schedule(
    'preencher-escala-anual',
    '0 3 1 11 *',
    $$select preencher_escala_anual();$$
);
