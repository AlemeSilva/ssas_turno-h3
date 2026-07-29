-- =====================================================================
-- Turno H3 — Central de Controlo, Planeamento e Execução Operacional
-- Accenture / Banco Montepio — Schema inicial (Postgres / Supabase)
-- =====================================================================
-- Migração idempotente: pode ser re-executada sem erros.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
-- PostgreSQL não suporta CREATE TYPE IF NOT EXISTS — usa-se DO block.
-- ---------------------------------------------------------------------
do $$ begin create type perfil_usuario as enum ('OPERADOR', 'OPERADOR_H3', 'GERENTE');
exception when duplicate_object then null; end $$;

do $$ begin create type turno_tipo as enum ('H1', 'H2', 'H3', 'H4');
exception when duplicate_object then null; end $$;

do $$ begin create type tipo_fim_semana as enum ('NORMAL', 'MANUTENCAO');
exception when duplicate_object then null; end $$;

do $$ begin create type status_plano as enum ('RASCUNHO', 'PENDENTE_APROVACAO', 'APROVADO', 'EM_EXECUCAO', 'CONCLUIDO');
exception when duplicate_object then null; end $$;

do $$ begin create type status_ferias as enum ('PENDENTE', 'APROVADA', 'REJEITADA');
exception when duplicate_object then null; end $$;

do $$ begin create type status_troca as enum ('PROPOSTA', 'APROVADA', 'REJEITADA');
exception when duplicate_object then null; end $$;

do $$ begin create type categoria_cadeia as enum ('NORMAL', 'ASTERISCO', 'DUPLO_ASTERISCO');
exception when duplicate_object then null; end $$;

do $$ begin create type status_cadeia as enum ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO_AUTOMATICO', 'CONCLUIDO_MANUAL', 'ATRASADO');
exception when duplicate_object then null; end $$;

do $$ begin create type status_tarefa as enum ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO');
exception when duplicate_object then null; end $$;

do $$ begin create type origem_tarefa as enum ('TEMPLATE', 'MANUTENCAO', 'EXCECIONAL');
exception when duplicate_object then null; end $$;

do $$ begin create type secao_checklist as enum ('PREPARACAO', 'REUNIAO', 'BATCH_SEX_SAB', 'BATCH_SAB_DOM', 'BATCH_DOM_SEG');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. USUÁRIOS
-- ---------------------------------------------------------------------
create table if not exists usuarios (
    id uuid primary key references auth.users(id) on delete restrict,
    nome text not null,
    email text unique not null,
    perfil perfil_usuario not null,
    empresa text not null default 'Accenture',
    ativo boolean not null default true,
    data_saida date,
    limite_h3_mensal int,
    criado_em timestamptz not null default now(),
    constraint chk_data_saida check (data_saida is null or ativo = false or data_saida >= current_date)
);

comment on column usuarios.limite_h3_mensal is 'Máximo de fins de semana H3 por mês civil (âncora = mês do Sábado do ciclo). NULL = sem trava.';

-- ---------------------------------------------------------------------
-- 3. CATÁLOGO DAS 18 CADEIAS DIÁRIAS
-- ---------------------------------------------------------------------
create table if not exists cadeias_catalogo (
    nome_cadeia text primary key,
    categoria categoria_cadeia not null default 'NORMAL',
    ordem smallint not null
);

insert into cadeias_catalogo (nome_cadeia, categoria, ordem) values
    ('SD',               'NORMAL',          1),
    ('SD_FL',            'ASTERISCO',       2),
    ('SD_EXT',           'NORMAL',          3),
    ('SD_SAS',           'NORMAL',          4),
    ('MKT',              'NORMAL',          5),
    ('ODS_SAS',          'NORMAL',          6),
    ('ODS_GP',           'NORMAL',          7),
    ('DDS',              'NORMAL',          8),
    ('SB_DDS',           'NORMAL',          9),
    ('GIR_FL',           'NORMAL',         10),
    ('MDA',              'NORMAL',         11),
    ('EP_DDS',           'DUPLO_ASTERISCO',12),
    ('NDOD',             'NORMAL',         13),
    ('MARKET ABUSE',     'DUPLO_ASTERISCO',14),
    ('MII DIARIO',       'NORMAL',         15),
    ('EP_MDA',           'NORMAL',         16),
    ('IMPARIDADE DIARIA','NORMAL',         17),
    ('CRC',              'NORMAL',         18)
on conflict (nome_cadeia) do nothing;

create table if not exists gir_fl_dependencias (
    nome_cadeia text primary key references cadeias_catalogo(nome_cadeia)
);

insert into gir_fl_dependencias (nome_cadeia) values
    ('SD'), ('SD_FL'), ('SD_EXT'), ('SD_SAS'), ('ODS_SAS'), ('ODS_GP'), ('DDS')
on conflict (nome_cadeia) do nothing;

-- ---------------------------------------------------------------------
-- 4. ESCALA SEMANAL (H1 / H2 / H3 / H4)
-- ---------------------------------------------------------------------
create table if not exists escala_semanal (
    id bigserial primary key,
    semana_ref date not null,
    usuario_id uuid not null references usuarios(id),
    turno turno_tipo not null,
    criado_por uuid references usuarios(id),
    atualizado_em timestamptz not null default now(),
    unique (semana_ref, usuario_id)
);

create index if not exists idx_escala_semanal_semana on escala_semanal (semana_ref);
create index if not exists idx_escala_semanal_usuario on escala_semanal (usuario_id);

create or replace function trg_valida_turno_h3() returns trigger as $$
begin
    if new.turno = 'H3' then
        if not exists (
            select 1 from usuarios
            where id = new.usuario_id and perfil = 'OPERADOR_H3' and ativo = true
        ) then
            raise exception 'Só utilizadores com perfil OPERADOR_H3 (ativos) podem ser escalados para H3.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_escala_semanal_valida_h3
before insert or update on escala_semanal
for each row execute function trg_valida_turno_h3();

-- ---------------------------------------------------------------------
-- 5. FÉRIAS / AUSÊNCIAS
-- ---------------------------------------------------------------------
create table if not exists ferias (
    id bigserial primary key,
    usuario_id uuid not null references usuarios(id),
    data_inicio date not null,
    data_fim date not null,
    status status_ferias not null default 'PENDENTE',
    aprovado_por uuid references usuarios(id),
    data_aprovacao timestamptz,
    criado_em timestamptz not null default now(),
    constraint chk_ferias_datas check (data_fim >= data_inicio)
);

create index if not exists idx_ferias_usuario on ferias (usuario_id);
create index if not exists idx_ferias_periodo on ferias (data_inicio, data_fim);

create or replace function dias_uteis(p_inicio date, p_fim date) returns int as $$
    select count(*)::int
    from generate_series(p_inicio, p_fim, interval '1 day') d
    where extract(isodow from d) < 6;
$$ language sql immutable;

create or replace function trg_valida_ferias() returns trigger as $$
declare
    v_saldo int;
begin
    -- (a) sobreposição entre colegas diferentes
    if exists (
        select 1 from ferias f
        where f.usuario_id <> new.usuario_id
          and f.status in ('PENDENTE', 'APROVADA')
          and f.id <> coalesce(new.id, -1)
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existem férias pedidas/aprovadas de outro colega sobrepostas a este período.';
    end if;

    -- (b) saldo anual de 22 dias úteis
    select coalesce(sum(dias_uteis(f.data_inicio, f.data_fim)), 0)
      into v_saldo
      from ferias f
     where f.usuario_id = new.usuario_id
       and f.status in ('PENDENTE', 'APROVADA')
       and f.id <> coalesce(new.id, -1)
       and extract(year from f.data_inicio) = extract(year from new.data_inicio);

    if v_saldo + dias_uteis(new.data_inicio, new.data_fim) > 22 then
        raise exception 'Este pedido ultrapassa o saldo anual de 22 dias úteis de férias.';
    end if;

    -- (c) bloqueia se já há turno escalado nesse período
    if exists (
        select 1 from escala_semanal e
        where e.usuario_id = new.usuario_id
          and daterange(e.semana_ref, e.semana_ref + 6, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existe escala atribuída a esta pessoa num período sobreposto a este pedido de férias.';
    end if;

    return new;
end;
$$ language plpgsql;

create or replace trigger trg_ferias_valida
before insert or update on ferias
for each row execute function trg_valida_ferias();

-- ---------------------------------------------------------------------
-- 6. TROCAS PEER-TO-PEER (só H3)
-- ---------------------------------------------------------------------
create table if not exists trocas_escala (
    id bigserial primary key,
    usuario_proponente uuid not null references usuarios(id),
    usuario_substituto uuid not null references usuarios(id),
    semana_ref date not null,
    status status_troca not null default 'PROPOSTA',
    aprovado_por uuid references usuarios(id),
    data_aprovacao timestamptz,
    justificativa text,
    criado_em timestamptz not null default now()
);

create index if not exists idx_trocas_semana on trocas_escala (semana_ref);

create or replace function trg_valida_troca() returns trigger as $$
begin
    if not exists (select 1 from usuarios where id = new.usuario_substituto and perfil = 'OPERADOR_H3' and ativo = true) then
        raise exception 'O substituto de uma troca de H3 tem de ter perfil OPERADOR_H3 e estar ativo.';
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_trocas_valida
before insert or update on trocas_escala
for each row execute function trg_valida_troca();

create or replace function trg_aplica_troca_aprovada() returns trigger as $$
begin
    if new.status = 'APROVADA' and old.status <> 'APROVADA' then
        insert into escala_semanal (semana_ref, usuario_id, turno, criado_por)
        values (new.semana_ref, new.usuario_substituto, 'H3', new.aprovado_por)
        on conflict (semana_ref, usuario_id) do update set turno = 'H3';

        delete from escala_semanal
         where semana_ref = new.semana_ref
           and usuario_id = new.usuario_proponente
           and turno = 'H3';
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_trocas_aplica
after update on trocas_escala
for each row execute function trg_aplica_troca_aprovada();

-- ---------------------------------------------------------------------
-- 7. DELEGAÇÃO DE APROVAÇÃO
-- ---------------------------------------------------------------------
create table if not exists delegacoes_aprovacao (
    id bigserial primary key,
    gerente_titular uuid not null references usuarios(id),
    substituto uuid not null references usuarios(id),
    data_inicio date not null,
    data_fim date not null,
    criado_em timestamptz not null default now(),
    constraint chk_delegacao_datas check (data_fim >= data_inicio)
);

create or replace function trg_valida_delegacao() returns trigger as $$
begin
    if exists (
        select 1 from delegacoes_aprovacao d
        where d.id <> coalesce(new.id, -1)
          and daterange(d.data_inicio, d.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existe uma delegação de aprovação ativa nesse período.';
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_delegacao_valida
before insert or update on delegacoes_aprovacao
for each row execute function trg_valida_delegacao();

-- ---------------------------------------------------------------------
-- 8. PLANO DE FIM DE SEMANA
-- ---------------------------------------------------------------------
create table if not exists planos (
    id bigserial primary key,
    data_inicio_ciclo date not null unique,
    tipo_fim_semana tipo_fim_semana not null,
    tipo_fim_semana_manual boolean not null default false,
    status status_plano not null default 'RASCUNHO',
    observacoes_gerais text,
    criado_por uuid references usuarios(id),
    aprovado_por uuid references usuarios(id),
    data_criacao timestamptz not null default now(),
    data_aprovacao timestamptz
);

create or replace function calcula_tipo_fim_semana(p_data_inicio_ciclo date) returns tipo_fim_semana as $$
declare
    v_sabado date;
    v_ultimo_sabado_do_mes date;
begin
    v_sabado := (p_data_inicio_ciclo + interval '2 days')::date;
    v_ultimo_sabado_do_mes := (date_trunc('month', v_sabado) + interval '1 month - 1 day')::date;
    while extract(isodow from v_ultimo_sabado_do_mes) <> 6 loop
        v_ultimo_sabado_do_mes := (v_ultimo_sabado_do_mes - interval '1 day')::date;
    end loop;
    if v_sabado = v_ultimo_sabado_do_mes then
        return 'MANUTENCAO';
    end if;
    return 'NORMAL';
end;
$$ language plpgsql immutable;

create or replace function trg_planos_default_tipo() returns trigger as $$
begin
    if new.tipo_fim_semana_manual is distinct from true and (tg_op = 'INSERT' or new.tipo_fim_semana is null) then
        new.tipo_fim_semana := calcula_tipo_fim_semana(new.data_inicio_ciclo);
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_planos_tipo
before insert or update on planos
for each row execute function trg_planos_default_tipo();

create or replace function operador_do_ciclo(p_data_inicio_ciclo date) returns uuid as $$
    select usuario_id from escala_semanal
     where semana_ref = p_data_inicio_ciclo and turno = 'H3'
     limit 1;
$$ language sql stable;

-- ---------------------------------------------------------------------
-- 9. TAREFAS DO PLANO
-- ---------------------------------------------------------------------
create table if not exists tarefas_plano (
    id bigserial primary key,
    id_plano bigint not null references planos(id) on delete cascade,
    data_execucao date not null,
    descricao_tarefa text not null,
    equipa_responsavel text not null,
    hora_arranque time,
    dt_previsao date,
    hr_previsao_termino time,
    hr_limite time,
    observacao text,
    status status_tarefa not null default 'PENDENTE',
    origem origem_tarefa not null default 'EXCECIONAL',
    executado_por uuid references usuarios(id),
    dt_hr_conclusao_real timestamptz
);

create index if not exists idx_tarefas_plano on tarefas_plano (id_plano);

-- ---------------------------------------------------------------------
-- 10. CHECKLIST
-- ---------------------------------------------------------------------
create table if not exists checklist_itens (
    id bigserial primary key,
    id_plano bigint not null references planos(id) on delete cascade,
    secao secao_checklist not null,
    item_descricao text not null,
    concluido boolean not null default false,
    concluido_por uuid references usuarios(id),
    data_hora_conclusao timestamptz,
    comentario_especifico text,
    destravado_por uuid references usuarios(id),
    destravado_em timestamptz,
    destravado_motivo text
);

create index if not exists idx_checklist_plano on checklist_itens (id_plano);

create or replace function trg_checklist_imutavel() returns trigger as $$
begin
    if old.concluido = true and current_setting('app.permitir_destravar', true) is distinct from 'true' then
        if new.concluido is distinct from old.concluido
           or new.concluido_por is distinct from old.concluido_por
           or new.data_hora_conclusao is distinct from old.data_hora_conclusao then
            raise exception 'Item de checklist concluído é imutável. Use a função destravar_checklist_item para correções, com justificativa.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_checklist_itens_imutavel
before update on checklist_itens
for each row execute function trg_checklist_imutavel();

create or replace function destravar_checklist_item(p_id bigint, p_motivo text) returns void as $$
begin
    perform set_config('app.permitir_destravar', 'true', true);

    update checklist_itens
       set concluido = false,
           concluido_por = null,
           data_hora_conclusao = null,
           destravado_por = auth.uid(),
           destravado_em = now(),
           destravado_motivo = p_motivo
     where id = p_id;

    insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
    values ('CHECKLIST_ITEM', p_id, auth.uid(), 'OVERRIDE_CHECKLIST', p_motivo);

    perform set_config('app.permitir_destravar', 'false', true);
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- 11. CADEIAS DIÁRIAS
-- ---------------------------------------------------------------------
create table if not exists cadeias_diarias (
    id bigserial primary key,
    id_plano bigint not null references planos(id) on delete cascade,
    secao secao_checklist not null,
    data date not null,
    nome_cadeia text not null references cadeias_catalogo(nome_cadeia),
    status status_cadeia not null default 'PENDENTE',
    concluido_por uuid references usuarios(id),
    data_hora_conclusao timestamptz,
    observacao text,
    unique (id_plano, secao, nome_cadeia)
);

create index if not exists idx_cadeias_plano on cadeias_diarias (id_plano);

-- ---------------------------------------------------------------------
-- 12. LOGS DE AUDITORIA
-- ---------------------------------------------------------------------
create table if not exists logs_auditoria (
    id bigserial primary key,
    referencia_tipo text not null,
    referencia_id bigint,
    id_usuario uuid references usuarios(id),
    acao text not null,
    descricao_detalhada text,
    delegacao_id bigint references delegacoes_aprovacao(id),
    data_hora timestamptz not null default now()
);

create index if not exists idx_logs_referencia on logs_auditoria (referencia_tipo, referencia_id);
create index if not exists idx_logs_usuario on logs_auditoria (id_usuario);
create index if not exists idx_logs_data on logs_auditoria (data_hora);

-- =====================================================================
-- Fim do schema base. Políticas de RLS em 0002_rls.sql.
-- =====================================================================
