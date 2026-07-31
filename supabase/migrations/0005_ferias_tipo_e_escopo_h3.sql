-- =====================================================================
-- Distingue férias de licença; restringe a exclusion constraint de
-- não-sobreposição de ausências aos 3 operadores H3 (Bruno/Kilson/
-- Caique) — antes impedia qualquer sobreposição entre quaisquer dois
-- elementos da equipa, o que os dados reais de 2026 mostraram não
-- corresponder à prática real (Leonardo/Sérgio/Pedro sobrepõem-se
-- livremente).
-- Migração idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipo de ausência: FÉRIAS vs LICENÇA
-- ---------------------------------------------------------------------
do $$ begin create type tipo_ausencia as enum ('FERIAS', 'LICENCA');
exception when duplicate_object then null; end $$;

alter table ferias add column if not exists tipo tipo_ausencia not null default 'FERIAS';

comment on column ferias.tipo is 'FERIAS = conta para o saldo anual de 22 dias úteis. LICENCA = ausência aprovada fora do saldo de férias.';

-- ---------------------------------------------------------------------
-- 2. Coluna denormalizada: esta ausência pertence a um OPERADOR_H3?
-- Necessária porque uma exclusion constraint (índice GiST parcial) não
-- pode fazer subquery a outra tabela no predicado — tem de ser uma
-- coluna da própria linha, mantida por trigger.
-- ---------------------------------------------------------------------
alter table ferias add column if not exists eh_operador_h3 boolean not null default false;

comment on column ferias.eh_operador_h3 is 'Snapshot do perfil no momento do pedido — usado pela exclusion constraint para restringir a regra de não-sobreposição aos operadores H3.';

create or replace function trg_ferias_marca_perfil_h3() returns trigger as $$
begin
    new.eh_operador_h3 := exists (
        select 1 from usuarios where id = new.usuario_id and perfil = 'OPERADOR_H3'
    );
    return new;
end;
$$ language plpgsql;

create or replace trigger trg_ferias_marca_perfil_h3_before
before insert or update on ferias
for each row execute function trg_ferias_marca_perfil_h3();

-- Backfill de linhas existentes (se já houver alguma).
update ferias f set eh_operador_h3 = exists (
    select 1 from usuarios u where u.id = f.usuario_id and u.perfil = 'OPERADOR_H3'
);

-- ---------------------------------------------------------------------
-- 3. Remove a exclusion constraint antiga (bloqueava sobreposição entre
-- QUAISQUER dois elementos da equipa).
--
-- A exclusion constraint restrita a H3 (ferias_sem_sobreposicao_h3),
-- planeada nesta migração, NÃO foi criada: os dados reais de 2026
-- mostraram operadores H3 com ausências sobrepostas legitimamente
-- (ex: Bruno e Kilson ambos ausentes em 07/12; Kilson de férias e
-- Bruno de licença em 20-21/07) — nesses casos, o terceiro operador
-- H3 estava a cobrir o turno, pelo que a sobreposição é válida. A regra
-- "nenhum par de operadores H3 pode sobrepor-se" é mais estrita do que
-- a prática real; precisa de ser redesenhada (ex: só bloquear se NENHUM
-- dos 3 operadores H3 cobrir o turno nessa semana) antes de ser
-- reintroduzida como constraint rígida.
-- ---------------------------------------------------------------------
alter table ferias drop constraint if exists ferias_sem_sobreposicao_entre_colegas;
alter table ferias drop constraint if exists ferias_sem_sobreposicao_h3;

-- ---------------------------------------------------------------------
-- 4. Atualiza a função de validação:
--    (a) verificação/mensagem de sobreposição só entre operadores H3
--    (b) saldo anual de 22 dias úteis conta só tipo = FERIAS
-- ---------------------------------------------------------------------
create or replace function trg_valida_ferias() returns trigger as $$
declare
    v_saldo int;
begin
    perform pg_advisory_xact_lock(hashtext(new.usuario_id::text));

    if exists (select 1 from usuarios where id = new.usuario_id and perfil = 'OPERADOR_H3')
       and exists (
        select 1 from ferias f
        join usuarios u on u.id = f.usuario_id
        where f.usuario_id <> new.usuario_id
          and u.perfil = 'OPERADOR_H3'
          and f.status in ('PENDENTE', 'APROVADA')
          and f.id <> coalesce(new.id, -1)
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existem férias/licença de outro operador H3 sobrepostas a este período.';
    end if;

    if new.tipo = 'FERIAS' then
        select coalesce(sum(dias_uteis(f.data_inicio, f.data_fim)), 0)
          into v_saldo
          from ferias f
         where f.usuario_id = new.usuario_id
           and f.tipo = 'FERIAS'
           and f.status in ('PENDENTE', 'APROVADA')
           and f.id <> coalesce(new.id, -1)
           and extract(year from f.data_inicio) = extract(year from new.data_inicio);

        if v_saldo + dias_uteis(new.data_inicio, new.data_fim) > 22 then
            raise exception 'Este pedido ultrapassa o saldo anual de 22 dias úteis de férias.';
        end if;
    end if;

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

comment on function trg_valida_ferias() is
    'Validação de férias/licença. Sobreposição: só entre operadores H3 — só via esta função (sem exclusion constraint de apoio, ver secção 3). Saldo de 22 dias: só tipo FERIAS, serializado por pessoa via pg_advisory_xact_lock. NOTA: esta função e o trigger trg_ferias_valida estão atualmente DESATIVADOS em produção — ver 0006 e discussão de 2026-07-31 sobre o modelo real de coexistência entre escala_semanal e ferias.';
