-- =====================================================================
-- Corrige duas condições de corrida (check-then-act) no trigger de
-- férias, que só se manifestam sob concorrência genuína — nunca
-- apareceriam num teste sequencial, só num teste de stress real
-- (CAMADA 4). Sem isto, dois pedidos verdadeiramente simultâneos
-- podiam os dois passar a validação antes de qualquer um confirmar.
-- =====================================================================

create extension if not exists btree_gist;

-- (1) Sobreposição entre colegas: em vez de confiar só na SELECT do
-- trigger (que dois pedidos concorrentes podem ambos ver "livre" antes
-- de qualquer um comitar), o próprio Postgres passa a impedir
-- fisicamente duas linhas com datas sobrepostas em estado
-- PENDENTE/APROVADA de coexistirem — imune a condições de corrida,
-- tal como uma constraint UNIQUE é imune a dois INSERTs simultâneos
-- do mesmo valor.
alter table ferias add constraint ferias_sem_sobreposicao_entre_colegas
    exclude using gist (daterange(data_inicio, data_fim, '[]') with &&)
    where (status in ('PENDENTE', 'APROVADA'));

-- (2) Saldo de 22 dias úteis: é uma regra agregada por pessoa (soma de
-- várias linhas), que uma exclusion constraint não expressa. A defesa
-- aqui é serializar pedidos concorrentes da MESMA pessoa com um lock
-- consultivo por utilizador — pedidos de pessoas diferentes continuam
-- a não se bloquear mutuamente.
create or replace function trg_valida_ferias() returns trigger as $$
declare
    v_saldo int;
begin
    perform pg_advisory_xact_lock(hashtext(new.usuario_id::text));

    -- (a) sobreposição entre colegas diferentes — mantido para dar um
    -- erro com mensagem amigável no caso comum (não-concorrente); a
    -- exclusion constraint acima é o backstop para o caso concorrente.
    if exists (
        select 1 from ferias f
        where f.usuario_id <> new.usuario_id
          and f.status in ('PENDENTE', 'APROVADA')
          and f.id <> coalesce(new.id, -1)
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existem férias pedidas/aprovadas de outro colega sobrepostas a este período.';
    end if;

    -- (b) saldo anual de 22 dias úteis — agora serializado pelo lock acima
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

comment on function trg_valida_ferias() is
    'Validação de férias. A sobreposição entre colegas tem dupla defesa: esta verificação (mensagem amigável) + exclusion constraint ferias_sem_sobreposicao_entre_colegas (backstop imune a condições de corrida). O saldo de 22 dias é serializado por pessoa via pg_advisory_xact_lock.';
