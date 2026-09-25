-- =====================================================================
-- trg_valida_ferias() recusava qualquer pedido de férias/licença que se
-- sobrepusesse ao de "outro colega" (regra da 0044: nenhuma sobreposição
-- entre quaisquer dois elementos da equipa) sem olhar para se esse
-- colega ainda está na equipa. Desativar alguém apaga-lhe a escala
-- futura (desactivar-saidos / gerir-utilizadores) mas não lhe toca nas
-- férias já aprovadas — e essas férias continuavam a bloquear pedidos de
-- colegas reais. Caso real, 2026-09-25: as férias aprovadas do Pedro
-- (desligado a 21/08) para 28/09-02/10 e 06-09/10 recusavam qualquer
-- pedido dos colegas para essas datas com "Já existem férias/licença de
-- outro colega sobrepostas a este período", embora o Pedro já não esteja
-- cá.
--
-- Corrige só a verificação contra colegas: um colega inativo deixa de
-- contar. Uma pessoa reativada volta a contar, porque o estado lido é
-- sempre o atual. As restantes verificações ficam exatamente como na
-- 0045 (pedido pendente único, ano corrente, auto-sobreposição, saldo
-- anual) — nenhuma delas se refere a outro colega.
--
-- Consequência conhecida: a regra só corre ao inserir ou atualizar
-- férias. Se alguém for reativado, as férias que já tinha aprovadas
-- voltam a contar, mas nada revalida os pedidos que os colegas tenham
-- feito entretanto para as mesmas datas — podem ficar duas férias
-- sobrepostas (o mesmo que já existe nos pares aprovados antes da 0044).
-- Nenhuma linha de férias é apagada ou alterada por esta migração.
--
-- A RLS de usuarios (usuarios_select_all, using true) permite a qualquer
-- utilizador autenticado ler todos os registos, por isso o join corre
-- igual para operadores e para o Gerente — esta função não é security
-- definer, tal como a anterior.
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
