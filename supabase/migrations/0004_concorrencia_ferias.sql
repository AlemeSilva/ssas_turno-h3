-- =====================================================================
-- Corrige condições de corrida no trigger de férias.
-- Migração idempotente.
-- =====================================================================

create extension if not exists btree_gist;

-- Exclusion constraint para sobreposição entre colegas — imune a
-- condições de corrida. Usa DO block para ser idempotente.
do $$ begin
    alter table ferias add constraint ferias_sem_sobreposicao_entre_colegas
        exclude using gist (daterange(data_inicio, data_fim, '[]') with &&)
        where (status in ('PENDENTE', 'APROVADA'));
exception when duplicate_object then null;
end $$;

-- Substitui a função original — serializa saldo por pessoa com lock
-- consultivo e mantém mensagem amigável para o caso comum.
create or replace function trg_valida_ferias() returns trigger as $$
declare
    v_saldo int;
begin
    perform pg_advisory_xact_lock(hashtext(new.usuario_id::text));

    if exists (
        select 1 from ferias f
        where f.usuario_id <> new.usuario_id
          and f.status in ('PENDENTE', 'APROVADA')
          and f.id <> coalesce(new.id, -1)
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existem férias pedidas/aprovadas de outro colega sobrepostas a este período.';
    end if;

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
    'Validação de férias. Sobreposição entre colegas: dupla defesa (mensagem amigável + exclusion constraint). Saldo de 22 dias: serializado por pessoa via pg_advisory_xact_lock.';
