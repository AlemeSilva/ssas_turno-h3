-- =====================================================================
-- Headcount Ideal — calculadora mensal de dimensionamento de equipa.
--
-- Especificação funcional completa (7 rondas de revisão com o Gerente,
-- dossiê aprovado). Resumo do desenho:
--
-- - headcount_parametros: singleton com os parâmetros da fórmula,
--   editáveis só pelo Gerente titular; lidos por titular+delegado.
-- - headcount_mensal: 1 linha por mês. Enquanto fechado=false é um
--   rascunho editável por titular+delegado (bloqueio otimista via
--   atualizado_em). Depois de fechado=true fica definitivo — sem
--   caminho de reabertura, por decisão explícita do Gerente.
-- - calcular_headcount(): a fórmula de um mês, usada tanto para
--   pré-visualização como internamente por fechar_mes_headcount().
-- - fechar_mes_headcount(): só titular, congela parâmetros+resultado.
-- - garantir_rascunho_headcount_mensal(): cria (idempotente) as linhas
--   de rascunho em falta desde o último mês fechado até ao mês mais
--   recentemente terminado — cobre backlog de vários meses sem cron.
--
-- Nota de desenho: capacidade_plena_horas_pessoa é sempre por-pessoa,
-- nunca "total ÷ headcount" — a capacidade plena é idêntica para toda
-- a gente (não depende de ausências específicas), por isso essa
-- divisão cancelar-se-ia sempre no mesmo valor. Guardá-la diretamente
-- remove o único sítio onde a fórmula dividiria por um headcount que
-- podia ser zero.
-- =====================================================================

-- ---------------------------------------------------------------------
-- headcount_parametros
-- ---------------------------------------------------------------------

create table headcount_parametros (
    id boolean primary key default true,
    constraint chk_headcount_parametros_singleton check (id = true),

    capacidade_base_horas numeric not null default 8,
    taxa_eficiencia numeric not null default 0.85,
    batch_horas_dia numeric not null default 15,
    olho_vivo_minutos_dia numeric not null default 30,
    prep_fim_semana_horas_semana numeric not null default 2,
    tempo_medio_pedido_minutos numeric not null default 40,
    imparidade_calendario_horas numeric not null default 8,
    imparidade_execucao_horas_semana numeric not null default 1,
    imparidade_reportes_minutos_dia numeric not null default 30,
    imparidade_reportes_dias_mes numeric not null default 15,
    banda_tolerancia_pessoas numeric not null default 1,
    janela_tendencia_meses integer not null default 3,

    atualizado_por uuid references usuarios(id),
    atualizado_em timestamptz not null default now()
);

insert into headcount_parametros (id) values (true);

alter table headcount_parametros enable row level security;

create policy headcount_parametros_select on headcount_parametros
    for select using (is_gerente_ou_delegado());

create policy headcount_parametros_update on headcount_parametros
    for update using (is_gerente_titular()) with check (is_gerente_titular());

create or replace function trg_headcount_parametros_auditoria() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $function$
begin
    new.atualizado_por := auth.uid();
    new.atualizado_em := clock_timestamp();
    insert into logs_auditoria (referencia_tipo, id_usuario, acao, descricao_detalhada)
    values ('HEADCOUNT_PARAMETROS', auth.uid(), 'ALTERACAO_PARAMETRO',
            format('Parâmetros de headcount alterados. Antes: %s. Depois: %s.', to_jsonb(old), to_jsonb(new)));
    return new;
end;
$function$;

create trigger trg_headcount_parametros_before_update
before update on headcount_parametros
for each row execute function trg_headcount_parametros_auditoria();

-- ---------------------------------------------------------------------
-- headcount_mensal
-- ---------------------------------------------------------------------

create table headcount_mensal (
    id bigserial primary key,
    mes_referencia date not null,
    constraint uq_headcount_mensal_mes unique (mes_referencia),
    constraint chk_headcount_mensal_primeiro_dia check (extract(day from mes_referencia) = 1),

    -- inputs (rascunho, titular ou delegado)
    volume_pedidos integer,
    dias_recuperacao_cadeia numeric not null default 0,

    -- snapshot dos parâmetros usados no fecho (só os 9 que entram na
    -- fórmula de um mês — banda_tolerancia/janela_tendencia só se usam
    -- na comparação ao vivo, com o valor atual, nunca "congelados")
    capacidade_base_horas numeric,
    taxa_eficiencia numeric,
    batch_horas_dia numeric,
    olho_vivo_minutos_dia numeric,
    prep_fim_semana_horas_semana numeric,
    tempo_medio_pedido_minutos numeric,
    imparidade_calendario_horas numeric,
    imparidade_execucao_horas_semana numeric,
    imparidade_reportes_minutos_dia numeric,
    imparidade_reportes_dias_mes numeric,

    -- resultado, congelado no fecho
    carga_horas numeric,
    capacidade_plena_horas_pessoa numeric,
    capacidade_plena_horas_equipa numeric,
    capacidade_presente_horas_equipa numeric,
    headcount_real_snapshot integer,
    operador_h3_ativo_snapshot integer,

    fechado boolean not null default false,
    fechado_por uuid references usuarios(id),
    fechado_em timestamptz,

    atualizado_por uuid references usuarios(id),
    atualizado_em timestamptz not null default now(),
    criado_em timestamptz not null default now()
);

alter table headcount_mensal enable row level security;

create policy headcount_mensal_select on headcount_mensal
    for select using (is_gerente_ou_delegado());

create policy headcount_mensal_update on headcount_mensal
    for update using (is_gerente_ou_delegado() and fechado = false)
    with check (is_gerente_ou_delegado() and fechado = false);

-- Bloqueio otimista (titular e delegado podem ambos editar o rascunho)
-- — mesmo padrão de tarefas_plano (0031, trg_tarefas_plano_toca_atualizado_em).
create or replace function trg_headcount_mensal_toca_atualizado_em() returns trigger
language plpgsql as $function$
begin
    -- clock_timestamp(), não now(): now() fica congelado ao valor de
    -- início da transação, o que quebraria a comparação otimista.
    new.atualizado_em := clock_timestamp();
    new.atualizado_por := auth.uid();
    return new;
end;
$function$;

create trigger trg_headcount_mensal_atualizado_em
before update on headcount_mensal
for each row execute function trg_headcount_mensal_toca_atualizado_em();

-- Imutabilidade pós-fecho. Sem GUC de bypass (ao contrário de
-- checklist_itens) — não há reabertura, decisão explícita do Gerente.
-- Dispara mesmo com bypass de RLS (service role, SQL editor).
create or replace function trg_headcount_mensal_imutavel() returns trigger
language plpgsql as $function$
begin
    if old.fechado = true then
        raise exception 'Mês de headcount já fechado é definitivo — sem reabertura.';
    end if;
    return new;
end;
$function$;

create trigger trg_headcount_mensal_bloqueia_reabertura
before update on headcount_mensal
for each row execute function trg_headcount_mensal_imutavel();

-- ---------------------------------------------------------------------
-- Funções de cálculo e ciclo de vida
-- ---------------------------------------------------------------------

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

    v_cap_plena_pessoa := v_dias_corridos * v_p.capacidade_base_horas * v_p.taxa_eficiencia;

    select count(*) into v_headcount_real
      from usuarios where ativo and perfil in ('OPERADOR', 'OPERADOR_H3');

    select count(*) into v_operador_h3_ativo
      from usuarios where ativo and perfil = 'OPERADOR_H3';

    -- Capacidade presente: dias corridos menos dias de férias/licença
    -- aprovadas dessa pessoa, recortados às fronteiras do mês. Conta
    -- dias de calendário DISTINTOS (não a soma da duração de cada
    -- linha) para nunca sobre-contar quando férias e licença se
    -- sobrepõem parcialmente na mesma pessoa (a app não tem nenhum
    -- trigger que impeça essa sobreposição consigo própria).
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

create or replace function garantir_rascunho_headcount_mensal()
returns void
language plpgsql security definer set search_path = public, pg_temp as $function$
declare
    v_ultimo_fechado date;
    v_mes_terminado date := (date_trunc('month', current_date) - interval '1 month')::date;
    v_inicio_backfill date;
begin
    if not is_gerente_ou_delegado() then
        raise exception 'Não autorizado.';
    end if;

    select max(mes_referencia) into v_ultimo_fechado from headcount_mensal where fechado;
    v_inicio_backfill := coalesce((v_ultimo_fechado + interval '1 month')::date, v_mes_terminado);

    insert into headcount_mensal (mes_referencia)
    select gs::date
    from generate_series(v_inicio_backfill::timestamp, v_mes_terminado::timestamp, interval '1 month') gs
    on conflict (mes_referencia) do nothing;
end;
$function$;
