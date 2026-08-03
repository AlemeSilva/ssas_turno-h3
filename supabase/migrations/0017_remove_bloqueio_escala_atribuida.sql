-- =====================================================================
-- Remove a validação "já existe escala atribuída a esta pessoa num
-- período sobreposto" — escrita antes de existir o mecanismo de
-- substituto (ferias.substituto_id, desta sessão). Com o preenchimento
-- automático anual (migração 0015) a gravar o ano inteiro de uma só
-- vez em Novembro, e os pedidos de férias só podendo ser feitos
-- dentro do próprio ano (migração 0016), esta regra bloquearia
-- sempre qualquer pedido normal a partir do primeiro preenchimento
-- automático — a escala já estaria sempre atribuída antes de o
-- período de pedidos abrir.
--
-- O mecanismo de substituto resolve isto de forma muito melhor:
-- aprovar a ausência e só depois escolher quem cobre, em vez de
-- impedir o pedido à partida. Decisão confirmada pelo Gerente,
-- 2026-08-03.
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

    return new;
end;
$function$;
