-- =====================================================================
-- operador_do_ciclo() nunca funcionou. Recebe a quinta-feira de
-- referência do ciclo (planos.data_inicio_ciclo) mas comparava-a
-- diretamente com escala_semanal.semana_ref, que só guarda sábados
-- (confirmado: as 371 linhas existentes são todas sábado — mesma
-- descoberta feita ao corrigir RelatoriosPage.tsx nesta sessão).
-- Testado diretamente: operador_do_ciclo('2026-07-30') [quinta real do
-- único plano já criado] devolvia null; com o sábado equivalente
-- ('2026-08-01') devolvia o operador correto.
--
-- Consequência prática: a política planos_insert já dizia
-- "is_gerente_ou_delegado() OR is_operador_do_ciclo(data_inicio_ciclo)"
-- desde que a tabela existe, mas o segundo lado nunca era verdadeiro
-- para ninguém — só o Gerente/delegado alguma vez conseguiu criar um
-- plano. Esta correção destrava a regra já desenhada, sem alterar
-- nenhuma política — só a função.
-- =====================================================================

create or replace function operador_do_ciclo(p_data_inicio_ciclo date)
returns uuid
language sql
stable
as $function$
    select usuario_id from escala_semanal
     where semana_ref = p_data_inicio_ciclo + 2 and turno = 'H3'
     limit 1;
$function$;
