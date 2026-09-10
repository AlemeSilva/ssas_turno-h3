-- =====================================================================
-- calcular_headcount() só olhava para usuarios.ativo — o estado ATUAL,
-- nunca "esteve presente durante o mês X". Fechar um mês depois de
-- alguém sair a meio dele omitia-o inteiramente do headcount_real,
-- operador_h3_ativo e capacidade_presente_horas_equipa desse mês,
-- mesmo tendo trabalhado a maior parte dele. Simétrico para quem entra
-- a meio de um mês ainda por fechar.
--
-- Achado ao fechar retroativamente abril-agosto/2026: o Pedro
-- (OPERADOR, criado_em 31/07, data_saida 21/08) ficou de fora do
-- headcount de julho e agosto por inteiro, apesar de ter trabalhado 1
-- dia de julho e 21 de agosto. Decisão do Gerente: não corrigir esses
-- 2 meses já fechados (histórico mantém-se), mas corrigir a fórmula
-- para os próximos fechos — nomeadamente o novo operador que vai
-- substituir o Pedro no turno H4.
--
-- criado_em é fiável para isto desde que a app existe (timestamp real
-- de cada registo individual pela Edge Function gerir-utilizadores) —
-- só os 7 utilizadores da carga inicial partilham um valor idêntico
-- (seed único de arranque), e todos continuam ativos hoje, por isso
-- nunca caem no ramo data_saida. Como abril-agosto já estão fechados e
-- imutáveis, esta mudança só se aplica a partir do próximo fecho
-- (setembro em diante) — não há risco de reabrir esse histórico.
--
-- Teste de sobreposição: conta quem tem criado_em até ao fim do mês E
-- (está ativo OU tem data_saida dentro ou depois do mês a calcular).
-- Nunca só "ativo" sozinho — isso incluiria alguém no mês errado
-- (ex.: data_saida em dezembro sendo trivialmente >= início de
-- qualquer mês anterior do ano, se usado sem o limite de criado_em).
-- =====================================================================

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

    -- Presente em pelo menos 1 dia do mês [v_mes_inicio, v_mes_fim] —
    -- não só ativo agora. Ver nota de migração acima.
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
    where u.perfil in ('OPERADOR', 'OPERADOR_H3')
      and u.criado_em::date <= v_mes_fim
      and (u.ativo or (u.data_saida is not null and u.data_saida >= v_mes_inicio));

    return query select
        v_carga,
        v_cap_plena_pessoa,
        v_cap_plena_pessoa * v_headcount_real,
        v_cap_presente_total,
        v_headcount_real,
        v_operador_h3_ativo;
end;
$function$;
