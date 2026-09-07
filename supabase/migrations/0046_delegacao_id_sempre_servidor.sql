-- =====================================================================
-- Achado do stress-test de 2026-09-07: trg_logs_auditoria_marca_delegacao
-- só preenchia delegacao_id quando o cliente o deixava null — um valor
-- fornecido explicitamente pelo próprio cliente passava sem qualquer
-- verificação, permitindo a alguém sem delegação nenhuma atribuir o seu
-- próprio log de auto-serviço (troca de password, alerta) a uma
-- delegação real de outra pessoa. Não dá acesso nem eleva privilégio —
-- delegacao_id não é lido por nenhuma política/trigger para decidir
-- autorização — mas falseava a atribuição de delegação nesse campo do
-- registo de auditoria.
--
-- Mesmo padrão já usado em planos.data_aprovacao (migração 0041):
-- delegacao_id passa a ser sempre calculado no servidor,
-- incondicionalmente — nunca aceite o que o cliente enviar. Nenhum dos
-- 2 pontos de escrita direta existentes (AlterarSenhaDialog.tsx,
-- PainelAlertas.tsx) alguma vez preenchia este campo, por isso não há
-- comportamento legítimo a perder.
-- =====================================================================

create or replace function trg_logs_auditoria_marca_delegacao()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
    new.delegacao_id := delegacao_ativa_id();
    return new;
end;
$function$;
