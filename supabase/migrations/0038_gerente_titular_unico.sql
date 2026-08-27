-- =====================================================================
-- v_ficam_h4 juntava TODOS os Gerentes ativos, sem desambiguar
-- "titular" — com 2 Gerentes ativos em simultâneo (transição/handover),
-- ambos ficavam com uma linha H4 todas as semanas do ano, quando o
-- comentário do próprio código já dizia "o Gerente titular ativo
-- mantém uma linha H4" (singular).
--
-- Não existe hoje nenhum atributo "titular" em usuarios para
-- desambiguar — usa-se um critério determinístico já disponível:
-- criado_em mais antigo. Reaproveita o mecanismo de aviso do Achado
-- #3 — não é bloqueio, só deixa de escolher por todos ao mesmo tempo
-- sem dizer nada.
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
    v_gerentes_ativos uuid[];
    v_id uuid;
    v_total_semanas int := 0;
    v_semanas_falhadas text[] := array[]::text[];
    v_total_falhas int := 0;
    v_avisos text[] := array[]::text[];
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

    select array_agg(id order by criado_em asc) into v_gerentes_ativos from usuarios where perfil = 'GERENTE' and ativo;

    v_ficam_h4 := coalesce(v_ficam_h4, array[]::uuid[])
        || case when v_gerentes_ativos is not null then array[v_gerentes_ativos[1]] else array[]::uuid[] end;

    if v_ficam_h1 is null or cardinality(v_ficam_h1) = 0 then
        v_avisos := v_avisos || 'nenhum OPERADOR ativo com turno_fixo=H1 — H1 fica sem ninguém o ano inteiro'::text;
    end if;
    if cardinality(v_ficam_h4) = 0 then
        v_avisos := v_avisos || 'nenhum OPERADOR ativo com turno_fixo=H4 nem Gerente ativo — H4 fixo fica sem ninguém o ano inteiro'::text;
    end if;
    if v_elegiveis_h2 is null or cardinality(v_elegiveis_h2) = 0 then
        v_avisos := v_avisos || 'nenhum OPERADOR_H3 elegível para H2 — H2 fica sem ninguém todas as semanas'::text;
    end if;
    if v_gerentes_ativos is not null and cardinality(v_gerentes_ativos) > 1 then
        v_avisos := v_avisos || format('%s Gerentes ativos em simultâneo — só o mais antigo foi atribuído a H4 automaticamente, os outros %s precisam de atribuição manual se for esse o caso',
                                        cardinality(v_gerentes_ativos), cardinality(v_gerentes_ativos) - 1)::text;
    end if;

    for v_semana in
        select d::date from generate_series(v_inicio_ano, v_fim_ano, interval '1 day') d
        where extract(dow from d) = 6 -- Sábado
    loop
        begin
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
        exception
            when others then
                v_semanas_falhadas := v_semanas_falhadas || format('%s: %s', v_semana, sqlerrm);
                v_total_falhas := v_total_falhas + 1;
        end;
    end loop;

    if v_total_falhas > 0 then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_ERRO',
                format('Escala de %s: %s semana(s) preenchida(s), %s falhou/falharam e precisam de preenchimento manual — %s%s',
                       v_ano, v_total_semanas, v_total_falhas, array_to_string(v_semanas_falhadas, '; '),
                       case when cardinality(v_avisos) > 0
                            then format(' | Atenção também: %s.', array_to_string(v_avisos, '; '))
                            else ''
                       end));
    elsif cardinality(v_avisos) > 0 then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_AVISO',
                format('Escala de %s preenchida automaticamente — %s semanas. Atenção: %s.',
                       v_ano, v_total_semanas, array_to_string(v_avisos, '; ')));
    else
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO',
                format('Escala de %s preenchida automaticamente — %s semanas.', v_ano, v_total_semanas));
    end if;
exception
    when others then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_ERRO',
                format('Falhou a preencher %s antes do processamento semana a semana: %s', v_ano, sqlerrm));
end;
$function$;
