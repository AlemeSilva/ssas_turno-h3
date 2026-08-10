-- =====================================================================
-- Um delegado (is_gerente_ou_delegado() == true durante o período da
-- delegação) conseguia criar um novo utilizador com perfil GERENTE, ou
-- promover-se a si próprio via UPDATE direto à tabela — as políticas
-- usuarios_insert_gerente/usuarios_update_gerente só verificavam
-- is_gerente_ou_delegado(), nunca perfil = 'GERENTE' como já acontece
-- corretamente em delegacoes_write_titular (migração 0002). Uma vez
-- GERENTE, essa conta teria ehGerenteTitular=true e poderia repor
-- password ou desativar o Gerente titular real — escalada de
-- privilégio completa a partir de uma delegação temporária.
--
-- is_gerente_titular() espelha exatamente a subquery já usada em
-- delegacoes_write_titular, agora com nome próprio para as políticas
-- abaixo ficarem legíveis. A Edge Function gerir-utilizadores recebeu
-- a mesma verificação em separado (chamador.perfil === 'GERENTE'), já
-- que corre em TypeScript/Deno e não chama esta função diretamente.
-- =====================================================================

create or replace function is_gerente_titular() returns boolean as $$
    select exists (select 1 from usuarios where id = auth.uid() and perfil = 'GERENTE' and ativo = true);
$$ language sql stable security definer;

drop policy if exists usuarios_insert_gerente on usuarios;
create policy usuarios_insert_gerente on usuarios
    for insert to authenticated with check (
        is_gerente_ou_delegado() and (perfil <> 'GERENTE' or is_gerente_titular())
    );

drop policy if exists usuarios_update_gerente on usuarios;
create policy usuarios_update_gerente on usuarios
    for update to authenticated
    using (is_gerente_ou_delegado())
    with check (
        is_gerente_ou_delegado() and (perfil <> 'GERENTE' or is_gerente_titular())
    );
