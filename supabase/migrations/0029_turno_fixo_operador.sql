-- =====================================================================
-- preencher_escala_anual() decidia quem fica "fixo" em H1/H4 olhando
-- para a última linha já gravada em escala_semanal — nunca verificava
-- ativo. Um operador desativado antes do preenchimento de 1 de
-- novembro continuava a ser replicado por todo o ano seguinte (achado
-- ao avaliar a saída do Pedro, 2026-08-12).
--
-- Corrige na raiz: turno_fixo passa a ser um atributo explícito da
-- pessoa (definido ao registar, ver Edge Function gerir-utilizadores),
-- não algo inferido do histórico. preencher_escala_anual() passa a ler
-- turno_fixo + ativo diretamente.
-- =====================================================================

alter table usuarios add column if not exists turno_fixo turno_tipo;

do $$ begin
    alter table usuarios add constraint chk_turno_fixo_valores
        check (turno_fixo is null or turno_fixo in ('H1', 'H4'));
exception when duplicate_object then null;
end $$;

do $$ begin
    alter table usuarios add constraint chk_turno_fixo_so_operador
        check (turno_fixo is null or perfil = 'OPERADOR');
exception when duplicate_object then null;
end $$;

comment on column usuarios.turno_fixo is 'H1 ou H4 — só para perfil OPERADOR (OPERADOR_H3 roda pelo trio H2/H3/H4, GERENTE não é escalado). Definido ao registar; usado por preencher_escala_anual() para compor o ano seguinte.';

-- Backfill: operadores ativos existentes ainda não têm turno_fixo —
-- infere-se da atribuição mais recente já gravada, mesma lógica que a
-- função antiga usava implicitamente, mas como passo único aqui em
-- vez de recalculado todos os anos.
update usuarios u
   set turno_fixo = sub.turno
  from (
    select distinct on (usuario_id) usuario_id, turno
      from escala_semanal
     where turno in ('H1', 'H4')
     order by usuario_id, semana_ref desc
  ) sub
 where u.id = sub.usuario_id
   and u.perfil = 'OPERADOR'
   and u.ativo = true
   and u.turno_fixo is null;

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
        return;
    end if;

    v_candidatos := array[v_bruno_id, v_caique_id, v_kilson_id];

    -- Quem fica fixo em H1/H4: atributo explícito da pessoa (turno_fixo),
    -- filtrado por ativo — já não se infere da última linha gravada.
    select array_agg(id) into v_ficam_h1 from usuarios where perfil = 'OPERADOR' and ativo and turno_fixo = 'H1';
    select array_agg(id) into v_ficam_h4 from usuarios where perfil = 'OPERADOR' and ativo and turno_fixo = 'H4';

    -- O Gerente titular ativo mantém uma linha H4 todas as semanas —
    -- convenção já existente, só para aparecer na grelha do mês; nunca
    -- entra no relatório semanal (ver gerarRelatorioSemanal.ts, que
    -- exclui perfil GERENTE explicitamente). Independente de
    -- turno_fixo, que é exclusivo de OPERADOR.
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
