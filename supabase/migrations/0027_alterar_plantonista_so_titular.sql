-- =====================================================================
-- plantao_voluntarios nunca registou quem confirmou/alterou (só
-- confirmado_em, quando) — todos os outros fluxos de confirmação desta
-- app guardam isso (ferias_semanas.confirmado_por, checklist_itens.
-- concluido_por, planos.aprovado_por). Adiciona confirmado_por para
-- alinhar.
--
-- A política única plantao_voluntarios_write_gerente (migração 0011,
-- for all) deixava qualquer delegado alterar um plantonista já
-- confirmado, tal como o Gerente titular. Passa a existir separação:
-- a primeira escolha (insert, quando ainda não há ninguém) continua
-- aberta a Gerente/delegado; alterar uma escolha já confirmada
-- (update/delete) passa a ser exclusivo do Gerente titular.
-- =====================================================================

alter table plantao_voluntarios add column if not exists confirmado_por uuid references usuarios(id);

drop policy if exists plantao_voluntarios_write_gerente on plantao_voluntarios;

create policy plantao_voluntarios_insert_gerente on plantao_voluntarios
    for insert to authenticated with check (is_gerente_ou_delegado());

create policy plantao_voluntarios_update_titular on plantao_voluntarios
    for update to authenticated using (is_gerente_titular()) with check (is_gerente_titular());

create policy plantao_voluntarios_delete_titular on plantao_voluntarios
    for delete to authenticated using (is_gerente_titular());
