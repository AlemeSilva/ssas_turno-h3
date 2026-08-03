-- =====================================================================
-- Duas regras novas para submissão de pedidos de férias/licença
-- (decisão do Gerente, 2026-08-03) — só se aplicam à SUBMISSÃO
-- (INSERT); nunca bloqueiam a decisão do Gerente sobre um pedido já
-- existente (UPDATE), mesmo que essa decisão aconteça já no ano
-- seguinte ao do pedido.
--
--   1. Só é possível pedir férias/licença dentro do ano corrente —
--      não é possível pedir para o ano seguinte enquanto este não
--      começar (nem, por simetria, para um ano já passado).
--   2. Só um pedido PENDENTE de cada vez por utilizador (férias e
--      licença em conjunto) — uma decisão (aprovada OU rejeitada)
--      liberta para o próximo pedido.
-- =====================================================================

create or replace function trg_valida_ferias()
 returns trigger
 language plpgsql
as $function$
declare
    v_saldo int;
begin
    perform pg_advisory_xact_lock(hashtext(new.usuario_id::text));

    if TG_OP = 'INSERT' and exists (
        select 1 from ferias f
        where f.usuario_id = new.usuario_id
          and f.status = 'PENDENTE'
    ) then
        raise exception 'Já tens um pedido pendente — aguarda que seja decidido antes de submeter outro.';
    end if;

    if TG_OP = 'INSERT' and extract(year from new.data_inicio) <> extract(year from current_date) then
        raise exception 'Só é possível pedir férias/licença dentro do ano corrente.';
    end if;

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
$function$;
