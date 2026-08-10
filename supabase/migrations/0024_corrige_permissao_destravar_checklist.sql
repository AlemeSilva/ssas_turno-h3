-- =====================================================================
-- destravar_checklist_item() é security definer mas não tinha nenhuma
-- verificação de permissão no corpo — a UI só mostra o botão
-- "Destravar" a ehGerenteOuDelegado (ItemChecklistLinha.tsx), mas
-- qualquer conta autenticada podia chamar a função diretamente via
-- supabase.rpc(...) e reabrir qualquer item já concluído, anulando a
-- garantia de imutabilidade do carimbo que checklist-imutabilidade.spec.ts
-- foi escrito para validar. Mesma classe de falha da migração 0023:
-- fronteira só na interface, não no servidor.
-- =====================================================================

create or replace function destravar_checklist_item(p_id bigint, p_motivo text) returns void as $$
begin
    if not is_gerente_ou_delegado() then
        raise exception 'Sem permissão — reservado ao Gerente/delegado.';
    end if;

    perform set_config('app.permitir_destravar', 'true', true);

    update checklist_itens
       set concluido = false,
           concluido_por = null,
           data_hora_conclusao = null,
           destravado_por = auth.uid(),
           destravado_em = now(),
           destravado_motivo = p_motivo
     where id = p_id;

    insert into logs_auditoria (referencia_tipo, referencia_id, id_usuario, acao, descricao_detalhada)
    values ('CHECKLIST_ITEM', p_id, auth.uid(), 'OVERRIDE_CHECKLIST', p_motivo);

    perform set_config('app.permitir_destravar', 'false', true);
end;
$$ language plpgsql security definer;
