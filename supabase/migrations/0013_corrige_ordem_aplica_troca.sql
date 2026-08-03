-- =====================================================================
-- trg_aplica_troca_aprovada() inseria o H3 do substituto ANTES de
-- apagar o do proponente — no instante da inserção os dois ainda
-- constavam como H3 da mesma semana, e trg_valida_um_h3_por_semana
-- bloqueava sempre com "Máximo 1 H3 por semana". Nenhuma troca alguma
-- vez foi aprovada com sucesso por causa desta ordem (confirmado ao
-- reproduzir numa transação revertida, 2026-08-03).
--
-- Correção: apagar primeiro, inserir depois — nunca há dois H3 em
-- simultâneo para a mesma semana.
-- =====================================================================

create or replace function trg_aplica_troca_aprovada()
returns trigger
language plpgsql
as $function$
begin
    if new.status = 'APROVADA' and old.status <> 'APROVADA' then
        delete from escala_semanal
         where semana_ref = new.semana_ref
           and usuario_id = new.usuario_proponente
           and turno = 'H3';

        insert into escala_semanal (semana_ref, usuario_id, turno, criado_por)
        values (new.semana_ref, new.usuario_substituto, 'H3', new.aprovado_por)
        on conflict (semana_ref, usuario_id) do update set turno = 'H3';
    end if;
    return new;
end;
$function$;
