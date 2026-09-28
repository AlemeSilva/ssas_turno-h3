-- =====================================================================
-- Ninguém decide (aprova/rejeita) o seu próprio pedido.
--
-- Achado do stress-test de documentação (2026-09-28): a RLS de `ferias`
-- e de `trocas_escala` só verifica o PAPEL de quem escreve
-- (is_gerente_ou_delegado), nunca se essa pessoa é também a dona do
-- pedido. Um Gerente/delegado que peça a sua própria férias/licença
-- podia aprová-la a si mesmo (UPDATE); um delegado que seja também
-- OPERADOR_H3 podia propor uma troca de H3 e aprová-la a si mesmo. Pior
-- ainda: nenhuma das duas RLS de INSERT restringe `new.status`, por
-- isso o próprio INSERT também conseguia nascer já `APROVADA`,
-- dispensando de vez uma decisão alheia.
-- Confirmado por consulta direta, 2026-09-28: zero pedidos/trocas
-- afetados até hoje (nenhuma linha tem aprovado_por = usuario_id, nem
-- usuario_proponente).
-- =====================================================================

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

    if TG_OP = 'INSERT' and extract(year from new.data_inicio) <> extract(year from current_date) then
        raise exception 'Só é possível pedir férias/licença dentro do ano corrente.';
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

create or replace function trg_valida_troca() returns trigger as $$
begin
    if new.status in ('APROVADA', 'REJEITADA')
       and (TG_OP = 'INSERT' or new.status is distinct from old.status)
       and auth.uid() = new.usuario_proponente
    then
        raise exception 'Não podes decidir (aprovar/rejeitar) a tua própria troca de H3 — pede a outro Gerente ou delegado.';
    end if;

    if not exists (select 1 from usuarios where id = new.usuario_substituto and perfil = 'OPERADOR_H3' and ativo = true) then
        raise exception 'O substituto de uma troca de H3 tem de ter perfil OPERADOR_H3 e estar ativo.';
    end if;
    if not exists (select 1 from usuarios where id = new.usuario_proponente and ativo = true) then
        raise exception 'O proponente de uma troca de H3 tem de estar ativo.';
    end if;
    -- extract(dow): domingo = 0 … sábado = 6. Num INSERT o "old" é nulo,
    -- por isso só a primeira condição conta.
    if extract(dow from new.semana_ref) <> 6 and (
        tg_op = 'INSERT'
        or new.semana_ref is distinct from old.semana_ref
        or (new.status = 'APROVADA' and old.status is distinct from 'APROVADA')
    ) then
        raise exception 'A semana de uma troca de H3 começa ao sábado — escolhe o sábado dessa semana.';
    end if;
    return new;
end;
$$ language plpgsql;
