-- Regra de ano isolada numa função pura para permitir testar a fronteira
-- de dezembro em qualquer mês, sem depender do relógio da base de dados.
create or replace function public.pedido_ferias_ano_permitido(
    p_data_inicio date,
    p_tipo public.tipo_ausencia,
    p_hoje date
) returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
    select extract(year from p_data_inicio)::int = extract(year from p_hoje)::int
        or (
            p_tipo = 'FERIAS'::public.tipo_ausencia
            and extract(month from p_hoje)::int = 12
            and extract(year from p_data_inicio)::int = extract(year from p_hoje)::int + 1
            and extract(month from p_data_inicio)::int = 1
        );
$function$;

revoke all on function public.pedido_ferias_ano_permitido(date, public.tipo_ausencia, date) from public, anon;
grant execute on function public.pedido_ferias_ano_permitido(date, public.tipo_ausencia, date) to authenticated, service_role;

create or replace function trg_valida_ferias()
 returns trigger
 language plpgsql
as $function$
declare
    v_saldo int;
begin
    if new.status in ('APROVADA', 'REJEITADA')
       and (TG_OP = 'INSERT' or new.status is distinct from old.status)
       and auth.uid() = new.usuario_id
    then
        raise exception 'Não podes decidir (aprovar/rejeitar) o teu próprio pedido de férias/licença — pede a outro Gerente ou delegado.';
    end if;

    -- Encurtar nunca cria conflito (ver o cabeçalho): sem sobreposição
    -- nova nem saldo novo, não há nada a validar.
    if TG_OP = 'UPDATE' then
        if new.usuario_id = old.usuario_id
           and new.status = old.status
           and new.tipo = old.tipo
           and new.data_inicio = old.data_inicio
           and new.data_fim < old.data_fim then
            return new;
        end if;
    end if;

    perform pg_advisory_xact_lock(hashtext('ferias_concorrencia'));

    if TG_OP = 'INSERT' and exists (
        select 1 from ferias f
        where f.usuario_id = new.usuario_id
          and f.status = 'PENDENTE'
    ) then
        raise exception 'Já tens um pedido pendente — aguarda que seja decidido antes de submeter outro.';
    end if;

    if TG_OP = 'INSERT'
       and not public.pedido_ferias_ano_permitido(new.data_inicio, new.tipo, current_date) then
        raise exception 'Só é possível pedir férias/licença para o ano corrente; em dezembro, apenas férias com início em janeiro do ano seguinte.';
    end if;

    if new.status <> 'REJEITADA' and exists (
        select 1 from ferias f
        where f.usuario_id = new.usuario_id
          and f.status in ('PENDENTE', 'APROVADA')
          and f.id <> coalesce(new.id, -1)
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já tens um pedido de férias/licença teu sobreposto a este período.';
    end if;

    if new.status <> 'REJEITADA' and exists (
        select 1 from ferias f
        join usuarios u on u.id = f.usuario_id
        where f.usuario_id <> new.usuario_id
          and u.ativo = true
          and f.status in ('PENDENTE', 'APROVADA')
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existem férias/licença de outro colega sobrepostas a este período.';
    end if;

    if new.tipo = 'FERIAS' and new.status <> 'REJEITADA' then
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

