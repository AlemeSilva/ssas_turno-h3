-- =====================================================================
-- Desativar alguém apaga o que a pessoa tinha marcado a partir da data
-- de desativação — e só a partir dessa data.
--
-- Até aqui desativar (gerir-utilizadores / desactivar-saidos) só apagava
-- a escala futura. As férias, os plantões de feriado, as delegações, as
-- substituições escolhidas e as trocas por decidir ficavam na base, e
-- cada sítio que os lê tinha de os ignorar um a um — foi assim que o
-- Pedro, desligado a 21/08, continuou a aparecer no relatório semanal e
-- a bloquear pedidos de férias de colegas. Decisão do Gerente,
-- 2026-09-25: apagar tudo isto a partir da data de desativação e manter
-- o histórico anterior, que é válido para efeito de controlo.
--
-- limpar_dados_futuros_de_utilizador(pessoa, data) faz, para essa pessoa
-- e a partir dessa data (inclusive):
--   escala_semanal        apaga as semanas.
--   ferias                apaga as férias/licenças por decidir ou aprovadas
--                         que começam a partir da data; as que atravessam a
--                         data ficam até ao dia anterior. As rejeitadas ficam
--                         (não ocupam tempo nenhum).
--   ferias_semanas        apaga as substituições escolhidas a partir da data,
--                         tanto as das suas férias como as de outros em que
--                         ela era substituto (a semana volta a "por decidir").
--   plantao_voluntarios   apaga os plantões de feriado.
--   delegacoes_aprovacao  como delegado ou como titular: apaga as que começam
--                         a partir da data e corta as que a atravessam. Uma que
--                         já foi usada (referida em logs_auditoria) não se
--                         apaga — a chave de logs_auditoria não o permite — e
--                         fica sem poder: is_gerente_ou_delegado() exige o
--                         delegado ativo.
--   trocas_escala         apaga as trocas por decidir (PROPOSTA).
-- Nada anterior à data é tocado: escala e férias já gozadas, decisões já
-- tomadas, checklist, planos, auditoria. Fica um registo em logs_auditoria
-- com o que foi removido.
--
-- Corre num trigger em usuarios, por isso vale para qualquer desativação
-- (Edge Function, SQL à mão, testes), e na mesma transação: se a limpeza
-- falhar, a desativação também. A data é a de hoje em Lisboa — o servidor
-- corre em UTC.
--
-- Duas guardas nas validações existentes, para a limpeza nunca ser
-- recusada por dados antigos:
--   trg_valida_ferias / trg_valida_delegacao deixam passar um UPDATE que
--   só encurta o período (mesma pessoa, mesmo estado, mesmo início, fim
--   anterior). Encurtar nunca cria uma sobreposição nem gasta saldo, e sem
--   isto cortar umas férias que atravessam a data falhava se a pessoa
--   tivesse um par antigo sobreposto (aprovado antes da 0044) ou um saldo
--   já acima do limite. trg_valida_ferias inclui a alteração da 0055 (um
--   colega inativo não conta para a sobreposição) e trg_valida_delegacao a
--   da 0056.
--
-- Permissões: a função de limpeza apaga dados de qualquer pessoa, por isso
-- só a corre o dono (via trigger) e o service_role. Revogar só de public
-- NÃO chega — a Supabase dá EXECUTE a anon e authenticated por defeito nas
-- funções de public, e é assim que revogar_sessoes_utilizador (0018) está
-- hoje aberta a toda a gente.
-- =====================================================================

create or replace function trg_valida_ferias()
 returns trigger
 language plpgsql
as $function$
declare
    v_saldo int;
begin
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

create or replace function trg_valida_delegacao() returns trigger as $$
begin
    -- Encurtar nunca cria sobreposição (ver o cabeçalho).
    if TG_OP = 'UPDATE' then
        if new.gerente_titular = old.gerente_titular
           and new.substituto = old.substituto
           and new.data_inicio = old.data_inicio
           and new.data_fim < old.data_fim then
            return new;
        end if;
    end if;

    if exists (
        select 1 from delegacoes_aprovacao d
        join usuarios u on u.id = d.substituto
        where d.id <> coalesce(new.id, -1)
          and u.ativo = true
          and daterange(d.data_inicio, d.data_fim, '[]') && daterange(new.data_inicio, new.data_fim, '[]')
    ) then
        raise exception 'Já existe uma delegação de aprovação ativa nesse período.';
    end if;
    return new;
end;
$$ language plpgsql;

create or replace function limpar_dados_futuros_de_utilizador(p_usuario_id uuid, p_desde date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_nome text;
    v_escala int;
    v_ferias_apagadas int;
    v_ferias_cortadas int;
    v_substituicoes int;
    v_plantoes int;
    v_deleg_apagadas int;
    v_deleg_cortadas int;
    v_trocas int;
    v_total int;
begin
    select nome into v_nome from usuarios where id = p_usuario_id;

    delete from escala_semanal
     where usuario_id = p_usuario_id and semana_ref >= p_desde;
    get diagnostics v_escala = row_count;

    -- As que começam a partir da data desaparecem (as decisões de
    -- substituto por semana vão atrás, em cascata); as que a atravessam
    -- ficam até ao dia anterior.
    delete from ferias
     where usuario_id = p_usuario_id
       and status in ('PENDENTE', 'APROVADA')
       and data_inicio >= p_desde;
    get diagnostics v_ferias_apagadas = row_count;

    update ferias set data_fim = p_desde - 1
     where usuario_id = p_usuario_id
       and status in ('PENDENTE', 'APROVADA')
       and data_inicio < p_desde
       and data_fim >= p_desde;
    get diagnostics v_ferias_cortadas = row_count;

    -- Semanas de substituição para lá do novo fim das férias cortadas...
    delete from ferias_semanas fs
     using ferias f
     where fs.ferias_id = f.id
       and f.usuario_id = p_usuario_id
       and fs.semana_inicio >= p_desde;

    -- ...e as semanas em que era ela o substituto de outra pessoa.
    delete from ferias_semanas
     where substituto_id = p_usuario_id and semana_inicio >= p_desde;
    get diagnostics v_substituicoes = row_count;

    delete from plantao_voluntarios
     where usuario_id = p_usuario_id and data_feriado >= p_desde;
    get diagnostics v_plantoes = row_count;

    -- Uma delegação já usada (referida em logs_auditoria) não se apaga.
    delete from delegacoes_aprovacao d
     where (d.substituto = p_usuario_id or d.gerente_titular = p_usuario_id)
       and d.data_inicio >= p_desde
       and not exists (select 1 from logs_auditoria l where l.delegacao_id = d.id);
    get diagnostics v_deleg_apagadas = row_count;

    update delegacoes_aprovacao set data_fim = p_desde - 1
     where (substituto = p_usuario_id or gerente_titular = p_usuario_id)
       and data_inicio < p_desde
       and data_fim >= p_desde;
    get diagnostics v_deleg_cortadas = row_count;

    delete from trocas_escala
     where status = 'PROPOSTA'
       and (usuario_proponente = p_usuario_id or usuario_substituto = p_usuario_id)
       and semana_ref >= p_desde;
    get diagnostics v_trocas = row_count;

    v_total := v_escala + v_ferias_apagadas + v_ferias_cortadas + v_substituicoes
             + v_plantoes + v_deleg_apagadas + v_deleg_cortadas + v_trocas;

    if v_total > 0 then
        insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
        values ('USUARIO', null, auth.uid(), 'LIMPEZA_DADOS_FUTUROS',
                format('Ao desativar %s removeu-se o que estava marcado a partir de %s: %s semana(s) de escala, %s férias/licenças apagadas e %s cortadas, %s substituição(ões), %s plantão(ões), %s delegação(ões) apagadas e %s cortadas, %s troca(s) por decidir. O histórico anterior a esta data foi mantido.',
                       coalesce(v_nome, p_usuario_id::text), p_desde, v_escala, v_ferias_apagadas, v_ferias_cortadas,
                       v_substituicoes, v_plantoes, v_deleg_apagadas, v_deleg_cortadas, v_trocas));
    end if;

    return jsonb_build_object(
        'escala', v_escala,
        'ferias_apagadas', v_ferias_apagadas,
        'ferias_cortadas', v_ferias_cortadas,
        'substituicoes', v_substituicoes,
        'plantoes', v_plantoes,
        'delegacoes_apagadas', v_deleg_apagadas,
        'delegacoes_cortadas', v_deleg_cortadas,
        'trocas', v_trocas
    );
end;
$function$;

create or replace function trg_limpa_dados_futuros_ao_desativar() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    perform limpar_dados_futuros_de_utilizador(new.id, (now() at time zone 'Europe/Lisbon')::date);
    return null;
end;
$function$;

drop trigger if exists trg_usuarios_desativado_limpa_futuro on usuarios;
create trigger trg_usuarios_desativado_limpa_futuro
    after update of ativo on usuarios
    for each row
    when (old.ativo is true and new.ativo is false)
    execute function trg_limpa_dados_futuros_ao_desativar();

revoke all on function limpar_dados_futuros_de_utilizador(uuid, date) from public, anon, authenticated;
grant execute on function limpar_dados_futuros_de_utilizador(uuid, date) to service_role;
revoke all on function trg_limpa_dados_futuros_ao_desativar() from public, anon, authenticated;
