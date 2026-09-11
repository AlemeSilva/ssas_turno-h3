-- =====================================================================
-- Capacidade plena por pessoa usava dias CORRIDOS (todos os dias do
-- mês) como se toda a gente trabalhasse os 7 dias da semana — mas ao
-- fim de semana só o H3 está escalado (ver ehFimDeSemana() no
-- frontend), e o resto da equipa (H1/H4) não trabalha nem fins de
-- semana nem feriados. Isto inflacionava a capacidade por pessoa e, por
-- consequência, subestimava o Ideal (carga ÷ capacidade). Achado do
-- Gerente, 2026-09-11, validado com exatidão contra dois meses reais
-- (Agosto: 21 dias úteis × 8h = 168h; Junho: 20 dias úteis × 8h = 160h).
--
-- Nova base: dias_uteis_sem_feriados() — dias úteis (Segunda a Sexta)
-- menos feriados nacionais/Lisboa que caem em dia de semana (um feriado
-- ao fim de semana já está coberto pela exclusão do fim de semana, não
-- se desconta outra vez). Aplica-se a capacidade_plena_horas_pessoa e,
-- com a mesma lógica, à contagem de dias de ausência em
-- capacidade_presente_horas_equipa (um dia de férias ao fim de semana
-- ou feriado não desconta nada — a pessoa não ia trabalhar nesse dia de
-- qualquer forma).
--
-- Nova coluna congelada headcount_mensal.dias_uteis: feriados_portugal
-- pode mudar no futuro (já aconteceu esta sessão, "Finados" →
-- "Todos os Santos", migração 0048) — por isso o valor usado em cada
-- fecho fica gravado, tal como todos os outros parâmetros da fórmula,
-- para o histórico nunca poder derivar de forma diferente se a tabela
-- de feriados mudar mais tarde.
--
-- Retroativo: os 5 meses já fechados (abril-agosto/2026) são corrigidos
-- à parte desta migração (script ad-hoc, não repetível — mesmo padrão
-- já usado nesta base para correções pontuais), preservando
-- carga_horas e headcount_real_snapshot exatamente como estão — só a
-- capacidade muda.
-- =====================================================================

create or replace function dias_uteis_sem_feriados(p_inicio date, p_fim date)
returns integer
language sql
stable
as $function$
    select dias_uteis(p_inicio, p_fim) - coalesce((
        select count(*)::int from feriados_portugal
        where data between p_inicio and p_fim
          and extract(isodow from data) < 6
    ), 0);
$function$;

alter table headcount_mensal add column if not exists dias_uteis integer;
comment on column headcount_mensal.dias_uteis is
    'Dias úteis (Seg-Sex, sem feriados nacionais/Lisboa) do mês, congelados no fecho — base de capacidade_plena_horas_pessoa. Ver dias_uteis_sem_feriados().';

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
    operador_h3_ativo integer,
    dias_uteis integer
)
language plpgsql security definer set search_path = public, pg_temp as $function$
declare
    v_mes_inicio date := date_trunc('month', p_mes_referencia)::date;
    v_mes_fim date := (date_trunc('month', p_mes_referencia) + interval '1 month' - interval '1 day')::date;
    v_dias_corridos numeric := (v_mes_fim - v_mes_inicio + 1);
    v_semanas numeric := (v_mes_fim - v_mes_inicio + 1) / 7.0;
    v_dias_uteis integer := dias_uteis_sem_feriados(v_mes_inicio, v_mes_fim);
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

    v_cap_plena_pessoa := v_dias_uteis * v_p.capacidade_base_horas * v_p.taxa_eficiencia * v_p.taxa_cobertura_ferias;

    select count(*) into v_headcount_real
      from usuarios
     where perfil in ('OPERADOR', 'OPERADOR_H3')
       and criado_em::date <= v_mes_fim
       and (ativo or (data_saida is not null and data_saida >= v_mes_inicio));

    select count(*) into v_operador_h3_ativo
      from usuarios
     where perfil = 'OPERADOR_H3'
       and criado_em::date <= v_mes_fim
       and (ativo or (data_saida is not null and data_saida >= v_mes_inicio));

    -- Capacidade presente: dias ÚTEIS (não corridos) menos dias de
    -- férias/licença aprovadas que caem em dia útil sem feriado — um
    -- dia de ausência ao fim de semana ou em feriado não desconta nada,
    -- porque a pessoa não ia trabalhar nesse dia de qualquer forma.
    -- Conta dias de calendário DISTINTOS (não a soma da duração de cada
    -- linha) para nunca sobre-contar quando férias e licença se
    -- sobrepõem parcialmente na mesma pessoa. Não inclui
    -- taxa_cobertura_ferias: esta já é a ausência REAL do mês, aplicar
    -- a reserva estrutural por cima seria duplo desconto.
    select coalesce(sum(
        greatest(0, v_dias_uteis - coalesce(aus.dias_ausente, 0)) * v_p.capacidade_base_horas * v_p.taxa_eficiencia
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
          and extract(isodow from d.dia) < 6
          and not exists (select 1 from feriados_portugal fp where fp.data = d.dia::date)
    ) aus on true
    where u.perfil in ('OPERADOR', 'OPERADOR_H3')
      and u.criado_em::date <= v_mes_fim
      and (u.ativo or (u.data_saida is not null and u.data_saida >= v_mes_inicio));

    return query select
        v_carga,
        v_cap_plena_pessoa,
        v_cap_plena_pessoa * v_headcount_real,
        v_cap_presente_total,
        v_headcount_real,
        v_operador_h3_ativo,
        v_dias_uteis;
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
        dias_uteis = v_calc.dias_uteis,
        headcount_real_snapshot = v_calc.headcount_real,
        operador_h3_ativo_snapshot = v_calc.operador_h3_ativo,
        fechado = true,
        fechado_por = auth.uid(),
        fechado_em = clock_timestamp()
    where id = v_linha.id;

    insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
    values ('HEADCOUNT_MENSAL', v_linha.id, auth.uid(), 'FECHO_MES',
            format('Mês de headcount %s fechado — carga %s h, capacidade plena %s h/pessoa (%s dias úteis), headcount real %s, Operador H3 ativo %s.',
                   v_mes_inicio, round(v_calc.carga_horas, 1), round(v_calc.capacidade_plena_horas_pessoa, 1), v_calc.dias_uteis,
                   v_calc.headcount_real, v_calc.operador_h3_ativo));
end;
$function$;
