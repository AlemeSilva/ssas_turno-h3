-- =====================================================================
-- preencher_escala_anual() identificava quem roda H3/H2/H4 por NOME
-- exato ("Bruno", "Caique", "Kilson") — se um deles saísse, fosse
-- desativado, ou fosse renomeado antes do cron de 1 de Novembro, a
-- função falhava em silêncio (log FALHOU, sem exceção, sem alerta) e
-- o ano seguinte ficava sem escala nenhuma. Confirmado ao vivo contra
-- produção (Kilson desativado dentro de uma transação revertida → 0
-- linhas geradas para 2027, sem erro visível).
--
-- Decisão do Gerente, 2026-08-27: deixa de depender destes 3 nomes —
-- qualquer conjunto de OPERADOR_H3 ativos, mínimo 3 (para rodar
-- H3/H2/H4 sem impactar turnos), sem limite máximo. H2 continua
-- restrito a um subconjunto (hoje só Bruno/Caique, nunca Kilson), mas
-- passa a ser um atributo explícito por pessoa — elegivel_h2 — em vez
-- de nomes hardcoded no código, mesmo padrão já usado para turno_fixo
-- (migração 0029).
-- =====================================================================

alter table usuarios add column if not exists elegivel_h2 boolean not null default false;

do $$ begin
    alter table usuarios add constraint chk_elegivel_h2_so_operador_h3
        check (not elegivel_h2 or perfil = 'OPERADOR_H3');
exception when duplicate_object then null;
end $$;

comment on column usuarios.elegivel_h2 is 'Só OPERADOR_H3 — define quem pode ocupar H2 na rotação anual (ver preencher_escala_anual()). Backfill desta migração preserva o comportamento anterior: Bruno/Caique elegíveis, Kilson não.';

update usuarios set elegivel_h2 = true where nome in ('Bruno', 'Caique') and perfil = 'OPERADOR_H3';

create or replace function preencher_escala_anual()
returns void
language plpgsql
as $function$
declare
    v_ano int := extract(year from current_date)::int + 1;
    v_inicio_ano date := make_date(v_ano, 1, 1);
    v_fim_ano date := make_date(v_ano, 12, 31);
    v_semana date;
    v_candidatos uuid[];
    v_elegiveis_h2 uuid[];
    v_ordenados uuid[];
    v_ordenados_h2 uuid[];
    v_dentro_limite uuid[];
    v_cand uuid;
    v_h3_escolhido uuid;
    v_h2_escolhido uuid;
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

    select array_agg(id) into v_candidatos from usuarios where perfil = 'OPERADOR_H3' and ativo;
    select array_agg(id) into v_elegiveis_h2 from usuarios where perfil = 'OPERADOR_H3' and ativo and elegivel_h2;

    if v_candidatos is null or array_length(v_candidatos, 1) < 3 then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_FALHOU',
                format('Só %s OPERADOR_H3 ativo(s) ao preencher %s — mínimo de 3 para rodar H3/H2/H4. Preenchimento não avançou.',
                       coalesce(array_length(v_candidatos, 1), 0), v_ano));
        return;
    end if;

    select array_agg(id) into v_ficam_h1 from usuarios where perfil = 'OPERADOR' and ativo and turno_fixo = 'H1';
    select array_agg(id) into v_ficam_h4 from usuarios where perfil = 'OPERADOR' and ativo and turno_fixo = 'H4';

    v_ficam_h4 := coalesce(v_ficam_h4, array[]::uuid[])
        || coalesce((select array_agg(id) from usuarios where perfil = 'GERENTE' and ativo), array[]::uuid[]);

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

        -- H2: mesma equidade do H3 (menor contagem de H2 nos últimos 3
        -- meses), restrita a quem é elegivel_h2 e não ficou de H3 esta
        -- semana. Pode não sobrar ninguém (0 ou 1 elegíveis) — fica
        -- sem H2 essa semana em vez de adivinhar.
        select array_agg(id order by cnt asc) into v_ordenados_h2
          from (
              select cand.id, (
                  select count(*) from escala_semanal e
                   where e.turno = 'H2' and e.usuario_id = cand.id
                     and e.semana_ref >= v_tres_meses_atras and e.semana_ref < v_semana
              ) as cnt
              from unnest(v_elegiveis_h2) as cand(id)
              where cand.id <> v_h3_escolhido
          ) t;
        v_h2_escolhido := v_ordenados_h2[1];

        if v_h2_escolhido is not null then
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por)
            values (v_semana, v_h2_escolhido, 'H2', null)
            on conflict (semana_ref, usuario_id) do update set turno = 'H2';
        end if;

        -- H4: todo o resto do trio (nem H3 nem H2 esta semana).
        foreach v_cand in array v_candidatos loop
            if v_cand <> v_h3_escolhido and v_cand is distinct from v_h2_escolhido then
                insert into escala_semanal (semana_ref, usuario_id, turno, criado_por)
                values (v_semana, v_cand, 'H4', null)
                on conflict (semana_ref, usuario_id) do update set turno = 'H4';
            end if;
        end loop;

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
exception
    when others then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_ERRO',
                format('Falhou a preencher %s na semana %s: %s', v_ano, v_semana, sqlerrm));
end;
$function$;
