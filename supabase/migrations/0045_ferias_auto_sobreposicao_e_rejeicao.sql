-- =====================================================================
-- Peer-review dedicado ao tema de sobreposição de férias (pedido do
-- Gerente, 2026-09-07), duas lacunas na trg_valida_ferias() da 0044:
--
-- 1) A verificação de sobreposição só comparava contra OUTRAS pessoas
--    (f.usuario_id <> new.usuario_id) — nunca contra os próprios
--    pedidos do autor. Não existe forma de editar as datas de um
--    pedido já existente (só cancelar), por isso a forma natural de
--    alguém esticar férias já aprovadas é submeter um NOVO pedido com
--    datas sobrepostas às suas próprias — isso passava sem aviso. Sem
--    impacto em produção até hoje (verificado: zero pares ativos deste
--    tipo), mas inflacionaria em dobro o saldo anual mostrado ao
--    próprio e ao Gerente (useResumoUsuario/useResumoGerente somam
--    dias_uteis por registo, sem deduplicar sobreposição) e tornaria
--    ambígua a escolha de substituto (EscalaPage/gerarRelatorioSemanal
--    escolhem o primeiro registo que bater com o dia, via .find()).
--    Passa a haver duas verificações separadas — self e colega — com
--    mensagens distintas, para o erro continuar a ser claro sobre qual
--    é o pedido em conflito.
--
-- 2) As verificações de sobreposição e de saldo não olhavam para
--    new.status — corriam também ao REJEITAR um pedido, quando uma
--    rejeição não devia poder ser bloqueada por nenhuma das duas (uma
--    rejeição larga a reivindicação sobre o período, não a reafirma).
--    Não é hoje alcançável por nenhum caminho da aplicação (o trinco
--    de "só um pendente de cada vez" + o bloqueio já no INSERT + o
--    lock advisory global + a ausência de UI para editar datas juntos
--    garantem que o conjunto "outros registos relevantes" nunca muda
--    entre o INSERT de um pedido e a sua própria decisão) — mas é uma
--    armadilha à espreita se um dia existir "repor para pendente" ou
--    "editar datas". Corrigido por blindagem.
-- =====================================================================

create or replace function trg_valida_ferias()
 returns trigger
 language plpgsql
as $function$
declare
    v_saldo int;
begin
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
        where f.usuario_id <> new.usuario_id
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
