-- Férias próprias do Gerente: registo direto, sem aprovação de terceiros.
-- O pedido do Gerente continua sujeito aos conflitos com pedidos
-- pendentes, às férias próprias já registadas e às regras de antecedência.
-- Pode sobrepor-se a férias já aprovadas de colegas e não tem limite anual.
create or replace function public.trg_valida_ferias()
 returns trigger
 language plpgsql
as $function$
declare
    v_saldo int;
    v_eh_gerente boolean := false;
    v_aprovacao_automatica boolean := false;
begin
    select exists (
        select 1 from public.usuarios u
        where u.id = new.usuario_id
          and u.id = auth.uid()
          and u.perfil = 'GERENTE'
          and u.ativo = true
    ) into v_eh_gerente;

    -- Apenas o titular ativo, a registar as próprias férias pela forma
    -- habitual do formulário, recebe aprovação imediata. Não se regista
    -- um aprovador externo; outros perfis não podem contornar a regra que
    -- impede aprovar as próprias ausências.
    if TG_OP = 'INSERT'
       and new.status = 'PENDENTE'
       and new.tipo = 'FERIAS'
       and v_eh_gerente
       and auth.uid() = new.usuario_id then
        v_aprovacao_automatica := true;
        new.status := 'APROVADA';
        new.aprovado_por := null;
        new.data_aprovacao := clock_timestamp();
    end if;

    if new.status in ('APROVADA', 'REJEITADA')
       and (TG_OP = 'INSERT' or new.status is distinct from old.status)
       and auth.uid() = new.usuario_id
       and not v_aprovacao_automatica
    then
        raise exception 'Não podes decidir (aprovar/rejeitar) o teu próprio pedido de férias/licença — pede a outro Gerente ou delegado.';
    end if;

    -- Encurtar nunca cria conflito: sem sobreposição nova nem saldo
    -- novo, não há nada a validar.
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
        select 1 from public.ferias f
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
        select 1 from public.ferias f
        where f.usuario_id = new.usuario_id
          and f.status in ('PENDENTE', 'APROVADA')
          and f.id <> coalesce(new.id, -1)
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já tens um pedido de férias/licença teu sobreposto a este período.';
    end if;

    if new.status <> 'REJEITADA' and exists (
        select 1 from public.ferias f
        join public.usuarios u on u.id = f.usuario_id
        where f.usuario_id <> new.usuario_id
          and u.ativo = true
          and f.status in ('PENDENTE', 'APROVADA')
          and not (
              v_eh_gerente
              and new.tipo = 'FERIAS'
              and f.tipo = 'FERIAS'
              and f.status = 'APROVADA'
          )
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existem férias/licença de outro colega sobrepostas a este período.';
    end if;

    if new.tipo = 'FERIAS' and new.status <> 'REJEITADA' and not v_eh_gerente then
        select coalesce(sum(dias_uteis(f.data_inicio, f.data_fim)), 0)
          into v_saldo
          from public.ferias f
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
