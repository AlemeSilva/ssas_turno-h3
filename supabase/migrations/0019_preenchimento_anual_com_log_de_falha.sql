-- =====================================================================
-- preencher_escala_anual() corre sozinha, sem ninguém a ver — se
-- algo correr mal a meio (ex.: trg_valida_escala_sobre_ferias a
-- bloquear uma linha, ou qualquer outro erro imprevisto), a exceção
-- abortava a função sem deixar rasto nenhum em logs_auditoria (só os
-- dois casos já predefinidos — ano já preenchido, trio não
-- encontrado — ficavam registados). Adiciona um apanha-tudo que
-- regista a falha em logs_auditoria (visível no separador Auditoria
-- do Histórico, que o Gerente já consulta) e devolve normalmente em
-- vez de relançar — um RAISE aqui abortaria a transação inteira e
-- desfaria o próprio INSERT do log, tornando-o inútil. A perda é não
-- aparecer como falha em cron.job_run_details, tabela interna que
-- ninguém consulta; o log em logs_auditoria é o que importa.
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
        -- Regista e sai sem levantar exceção: um RAISE aqui seria
        -- apanhado pelo EXCEPTION WHEN OTHERS mais abaixo, que faria
        -- rollback a este INSERT específico e substituía por uma
        -- mensagem genérica — perdia-se exatamente o detalhe que
        -- interessa (quem não foi encontrado).
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_FALHOU',
                format('Não encontrei Bruno/Caique/Kilson ativos como OPERADOR_H3 ao preencher %s — função precisa de revisão manual.', v_ano));
        return;
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
exception
    when others then
        insert into logs_auditoria (referencia_tipo, acao, descricao_detalhada)
        values ('ESCALA_ANUAL', 'PREENCHIMENTO_AUTOMATICO_ERRO',
                format('Falhou a preencher %s na semana %s: %s', v_ano, v_semana, sqlerrm));
end;
$function$;
