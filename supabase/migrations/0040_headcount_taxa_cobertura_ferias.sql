-- =====================================================================
-- Headcount Ideal — taxa_cobertura_ferias: reserva estrutural para
-- rotação de férias, distinta de taxa_eficiencia (que é sobre
-- produtividade intradiária, não sobre presença).
--
-- Aplica-se só a capacidade_plena_horas_pessoa (a métrica nominal que
-- por desenho ignora ausências reais e por isso é a única que precisa
-- de reserva estrutural) — nunca a capacidade_presente_horas_equipa,
-- que já desconta a ausência real do mês via dias_ausente. Aplicar às
-- duas seria duplo desconto de férias.
-- =====================================================================

alter table headcount_parametros
    add column taxa_cobertura_ferias numeric not null default 0.90;

alter table headcount_mensal
    add column taxa_cobertura_ferias numeric;

create or replace function calcular_headcount(
    p_mes_referencia date,
    p_volume_pedidos integer,
    p_dias_recuperacao_cadeia numeric
)
returns table (
    carga_horas numeric,
    capacidade_plena_horas_pessoa numeric,
    capacidade_plena_horas_equipa numeric,
    capacidade_presente_horas_equipa numeric,
    headcount_real integer,
    operador_h3_ativo integer
)
language plpgsql security definer set search_path = public, pg_temp as $function$
declare
    v_mes_inicio date := date_trunc('month', p_mes_referencia)::date;
    v_mes_fim date := (date_trunc('month', p_mes_referencia) + interval '1 month' - interval '1 day')::date;
    v_dias_corridos numeric := (v_mes_fim - v_mes_inicio + 1);
    v_semanas numeric := (v_mes_fim - v_mes_inicio + 1) / 7.0;
    v_p headcount_parametros%rowtype;
    v_carga numeric;
    v_cap_plena_pessoa numeric;
    v_headcount_real integer;
    v_operador_h3_ativo integer;
    v_cap_presente_total numeric;
begin
    if not is_gerente_ou_delegado() then
        raise exception 'Não autorizado.';
    end if;

    select * into v_p from headcount_parametros;

    v_carga :=
        coalesce(p_volume_pedidos, 0) * (v_p.tempo_medio_pedido_minutos / 60.0)
        + v_p.batch_horas_dia * v_dias_corridos
        + (v_p.olho_vivo_minutos_dia / 60.0) * v_dias_corridos
        + v_p.prep_fim_semana_horas_semana * v_semanas
        + v_p.imparidade_calendario_horas
        + v_p.imparidade_execucao_horas_semana * v_semanas
        + (v_p.imparidade_reportes_minutos_dia / 60.0) * v_p.imparidade_reportes_dias_mes
        + coalesce(p_dias_recuperacao_cadeia, 0) * 24;

    v_cap_plena_pessoa := v_dias_corridos * v_p.capacidade_base_horas * v_p.taxa_eficiencia * v_p.taxa_cobertura_ferias;

    select count(*) into v_headcount_real
      from usuarios where ativo and perfil in ('OPERADOR', 'OPERADOR_H3');

    select count(*) into v_operador_h3_ativo
      from usuarios where ativo and perfil = 'OPERADOR_H3';

    -- Capacidade presente: dias corridos menos dias de férias/licença
    -- aprovadas dessa pessoa, recortados às fronteiras do mês. Conta
    -- dias de calendário DISTINTOS (não a soma da duração de cada
    -- linha) para nunca sobre-contar quando férias e licença se
    -- sobrepõem parcialmente na mesma pessoa (a app não tem nenhum
    -- trigger que impeça essa sobreposição consigo própria). Não
    -- inclui taxa_cobertura_ferias: esta já é a ausência REAL do mês,
    -- aplicar a reserva estrutural por cima seria duplo desconto.
    select coalesce(sum(
        greatest(0, v_dias_corridos - coalesce(aus.dias_ausente, 0)) * v_p.capacidade_base_horas * v_p.taxa_eficiencia
    ), 0)
    into v_cap_presente_total
    from usuarios u
    left join lateral (
        select count(distinct d.dia) as dias_ausente
        from ferias f
        cross join lateral generate_series(
            greatest(f.data_inicio, v_mes_inicio),
            least(f.data_fim, v_mes_fim),
            interval '1 day'
        ) d(dia)
        where f.usuario_id = u.id
          and f.status = 'APROVADA'
          and f.tipo in ('FERIAS', 'LICENCA')
          and f.data_inicio <= v_mes_fim
          and f.data_fim >= v_mes_inicio
    ) aus on true
    where u.ativo and u.perfil in ('OPERADOR', 'OPERADOR_H3');

    return query select
        v_carga,
        v_cap_plena_pessoa,
        v_cap_plena_pessoa * v_headcount_real,
        v_cap_presente_total,
        v_headcount_real,
        v_operador_h3_ativo;
end;
$function$;

create or replace function fechar_mes_headcount(p_mes_referencia date)
returns void
language plpgsql security definer set search_path = public, pg_temp as $function$
declare
    v_linha headcount_mensal%rowtype;
    v_mes_inicio date := date_trunc('month', p_mes_referencia)::date;
    v_proximo_mes date := (date_trunc('month', p_mes_referencia) + interval '1 month')::date;
    v_p headcount_parametros%rowtype;
    v_calc record;
begin
    if not is_gerente_titular() then
        raise exception 'Só o Gerente titular pode fechar um mês de headcount.';
    end if;

    -- for update: bloqueia a linha até esta transação terminar — a
    -- proteção real contra duplo clique (a unique constraint só
    -- protege a criação do rascunho, não este UPDATE).
    select * into v_linha from headcount_mensal where mes_referencia = v_mes_inicio for update;

    if not found then
        raise exception 'Não existe rascunho de headcount para %.', v_mes_inicio;
    end if;
    if v_linha.fechado then
        raise exception 'O mês % já está fechado.', v_mes_inicio;
    end if;
    if current_date < v_proximo_mes then
        raise exception 'Só é possível fechar um mês depois de ele ter terminado.';
    end if;
    if v_linha.volume_pedidos is null then
        raise exception 'Preenche o volume de pedidos antes de fechar o mês.';
    end if;

    select * into v_p from headcount_parametros;
    select * into v_calc from calcular_headcount(p_mes_referencia, v_linha.volume_pedidos, v_linha.dias_recuperacao_cadeia);

    update headcount_mensal set
        capacidade_base_horas = v_p.capacidade_base_horas,
        taxa_eficiencia = v_p.taxa_eficiencia,
        taxa_cobertura_ferias = v_p.taxa_cobertura_ferias,
        batch_horas_dia = v_p.batch_horas_dia,
        olho_vivo_minutos_dia = v_p.olho_vivo_minutos_dia,
        prep_fim_semana_horas_semana = v_p.prep_fim_semana_horas_semana,
        tempo_medio_pedido_minutos = v_p.tempo_medio_pedido_minutos,
        imparidade_calendario_horas = v_p.imparidade_calendario_horas,
        imparidade_execucao_horas_semana = v_p.imparidade_execucao_horas_semana,
        imparidade_reportes_minutos_dia = v_p.imparidade_reportes_minutos_dia,
        imparidade_reportes_dias_mes = v_p.imparidade_reportes_dias_mes,
        carga_horas = v_calc.carga_horas,
        capacidade_plena_horas_pessoa = v_calc.capacidade_plena_horas_pessoa,
        capacidade_plena_horas_equipa = v_calc.capacidade_plena_horas_equipa,
        capacidade_presente_horas_equipa = v_calc.capacidade_presente_horas_equipa,
        headcount_real_snapshot = v_calc.headcount_real,
        operador_h3_ativo_snapshot = v_calc.operador_h3_ativo,
        fechado = true,
        fechado_por = auth.uid(),
        fechado_em = clock_timestamp()
    where id = v_linha.id;

    insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
    values ('HEADCOUNT_MENSAL', v_linha.id, auth.uid(), 'FECHO_MES',
            format('Mês de headcount %s fechado — carga %s h, capacidade plena %s h/pessoa, headcount real %s, Operador H3 ativo %s.',
                   v_mes_inicio, round(v_calc.carga_horas, 1), round(v_calc.capacidade_plena_horas_pessoa, 1),
                   v_calc.headcount_real, v_calc.operador_h3_ativo));
end;
$function$;
