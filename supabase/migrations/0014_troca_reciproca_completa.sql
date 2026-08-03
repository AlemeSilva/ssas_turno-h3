-- =====================================================================
-- trg_aplica_troca_aprovada() só sabia mexer no H3 — dava H3 ao
-- substituto e apagava o H3 do proponente, mas nunca devolvia ao
-- proponente o turno que o substituto já tinha nessa semana (H1/H2/H4,
-- o que fosse). Resultado: a pessoa que saía do H3 ficava sem turno
-- nenhum nessa semana, em vez de herdar o do colega — confirmado na
-- troca Bruno/Caique de setembro 2026.
--
-- Correção: guarda o turno do substituto antes de qualquer alteração,
-- e devolve-o ao proponente depois de o substituto passar a H3 —
-- reciprocidade completa entre as duas pessoas, genérica para
-- qualquer par de operadores H3 e qualquer turno de origem.
-- =====================================================================

create or replace function trg_aplica_troca_aprovada()
returns trigger
language plpgsql
as $function$
declare
    v_turno_substituto turno_tipo;
begin
    if new.status = 'APROVADA' and old.status <> 'APROVADA' then
        select turno into v_turno_substituto
          from escala_semanal
         where semana_ref = new.semana_ref and usuario_id = new.usuario_substituto;

        delete from escala_semanal
         where semana_ref = new.semana_ref
           and usuario_id = new.usuario_proponente
           and turno = 'H3';

        insert into escala_semanal (semana_ref, usuario_id, turno, criado_por)
        values (new.semana_ref, new.usuario_substituto, 'H3', new.aprovado_por)
        on conflict (semana_ref, usuario_id) do update set turno = 'H3';

        if v_turno_substituto is not null and v_turno_substituto <> 'H3' then
            insert into escala_semanal (semana_ref, usuario_id, turno, criado_por)
            values (new.semana_ref, new.usuario_proponente, v_turno_substituto, new.aprovado_por)
            on conflict (semana_ref, usuario_id) do update set turno = excluded.turno;
        end if;
    end if;
    return new;
end;
$function$;
