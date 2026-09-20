-- =====================================================================
-- trg_valida_troca() só validava o substituto de uma troca de H3
-- (perfil OPERADOR_H3 e ativo) — nunca o proponente. Como o trigger
-- corre em "before insert or update", também dispara na aprovação
-- (UPDATE para status='APROVADA'), mas sem esta verificação nada
-- impedia aprovar uma troca cujo proponente tivesse sido desativado
-- depois de a propor: trg_aplica_troca_aprovada continuaria a devolver-
-- -lhe o turno que o substituto tinha nessa semana.
--
-- Achado da mesma auditoria de 2026-09-20 que corrigiu
-- is_gerente_ou_delegado() e "Ausências da equipa". O lado do
-- substituto já ficava protegido de graça (o trigger corre de novo na
-- aprovação e o SELECT lê o estado atual, não um valor congelado do
-- momento da proposta) — só faltava a mesma verificação do lado do
-- proponente.
-- =====================================================================

create or replace function trg_valida_troca() returns trigger as $$
begin
    if not exists (select 1 from usuarios where id = new.usuario_substituto and perfil = 'OPERADOR_H3' and ativo = true) then
        raise exception 'O substituto de uma troca de H3 tem de ter perfil OPERADOR_H3 e estar ativo.';
    end if;
    if not exists (select 1 from usuarios where id = new.usuario_proponente and ativo = true) then
        raise exception 'O proponente de uma troca de H3 tem de estar ativo.';
    end if;
    return new;
end;
$$ language plpgsql;
