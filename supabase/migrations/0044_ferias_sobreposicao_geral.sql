-- =====================================================================
-- Requisito original do projeto, reafirmado pelo Gerente em 2026-09-06:
-- nenhuma sobreposição de férias/licença entre quaisquer dois elementos
-- da equipa — não só entre Operadores H3. Duas correções na mesma
-- função, porque as duas afetam a mesma verificação:
--
-- 1) Alcance geral: a versão anterior (migração 0017) só bloqueava
--    sobreposição quando AMBAS as pessoas eram OPERADOR_H3 — uma conta
--    comum (OPERADOR) podia sobrepor-se livremente com qualquer
--    colega, H3 ou não (confirmado em produção: há hoje pares reais
--    sobrepostos entre OPERADOR e OPERADOR_H3, ex. Sérgio/Caique a
--    2026-01-02, Kilson/Leonardo a 2026-07-13 — dados históricos,
--    aprovados sob a regra antiga, não afetados retroativamente por
--    este trigger). Passa a comparar contra QUALQUER colega, sem
--    filtrar por perfil.
--
-- 2) Falha de temporização: o advisory lock trancava só pela pessoa
--    que está a submeter (hashtext(new.usuario_id::text)) — duas
--    pessoas DIFERENTES a submeter pedidos sobrepostos em transações
--    verdadeiramente simultâneas tomavam fechaduras diferentes, e
--    nenhuma bloqueava a outra; as duas podiam verificar "há alguém
--    sobreposto?" antes de qualquer uma commitar, e as duas passavam.
--    Passa a usar uma única chave fixa e global — todo INSERT/UPDATE
--    em ferias serializa contra qualquer outro, não só contra o mesmo
--    usuario_id. O volume desta tabela (poucos pedidos por dia, no
--    máximo) torna o custo de serialização irrelevante; não há ganho
--    real em vs. uma chave mais granular, só mais risco de a acertar mal.
--    Este ponto não é verificável por um teste pgTAP de uma só conexão
--    (concorrência real precisa de duas transações em paralelo) — a
--    garantia aqui é por inspeção: a mesma chave de lock em todas as
--    invocações implica secção crítica verdadeiramente serializada.
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

    if exists (
        select 1 from ferias f
        where f.usuario_id <> new.usuario_id
          and f.status in ('PENDENTE', 'APROVADA')
          and f.id <> coalesce(new.id, -1)
          and daterange(f.data_inicio, f.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existem férias/licença de outro colega sobrepostas a este período.';
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
