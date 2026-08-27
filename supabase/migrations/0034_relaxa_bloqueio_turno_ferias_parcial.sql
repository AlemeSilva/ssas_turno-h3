-- =====================================================================
-- trg_valida_escala_sobre_ferias() bloqueava a gravação de turno para
-- a semana inteira sempre que houvesse QUALQUER sobreposição com
-- férias/licença aprovadas, nem que fosse 1 dia em 7 — impedindo casos
-- legítimos como o do Caique (férias só 02-04/09, dentro da semana de
-- 29/08 a 04/09): o Gerente não conseguia mudar o turno de H4 para H2
-- nos dias em que ele efetivamente trabalha essa semana.
--
-- A grelha (valorDoDia, EscalaPage.tsx) já resolve a apresentação por
-- dia de forma independente do turno gravado — um dia com férias
-- aprovadas mostra sempre "Férias", seja qual for o turno da semana.
-- Por isso a trigger pode ser relaxada para bloquear só quando NÃO
-- resta nenhum dia livre nessa semana (férias cobrem os 7 dias),
-- caso em que de facto não há turno nenhum para atribuir.
--
-- Decisão confirmada, 2026-08-27: continuar a bloquear quando a semana
-- é 100% férias; a regra nova aplica-se por igual aos 3 caminhos que
-- gravam escala_semanal (edição manual, "Sugerir automaticamente →
-- Aplicar", preenchimento automático anual de novembro) — é a mesma
-- trigger partilhada por todos.
-- =====================================================================

create or replace function trg_valida_escala_sobre_ferias() returns trigger as $$
begin
    if not exists (
        select 1
        from generate_series(new.semana_ref, new.semana_ref + 6, interval '1 day') as dia
        where not exists (
            select 1 from ferias f
            where f.usuario_id = new.usuario_id
              and f.status = 'APROVADA'
              and f.data_inicio <= dia::date
              and f.data_fim >= dia::date
        )
    ) then
        raise exception 'Não é possível atribuir turno: operador está de férias/licença aprovadas a semana inteira.';
    end if;
    return new;
end;
$$ language plpgsql;
