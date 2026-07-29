-- =====================================================================
-- Auxiliares partilhados pela suite pgTAP (CAMADA 1).
-- Corre-se com `supabase test db` (usa pg_prove + pgTAP num Postgres
-- local via Docker) — ver supabase/tests/README.md.
-- =====================================================================

create schema if not exists tests;

-- Cria um utilizador de teste em auth.users + usuarios, devolvendo o id.
-- auth.users é simplificado ao mínimo necessário para RLS funcionar
-- (auth.uid() lê request.jwt.claims, não a tabela auth.users
-- diretamente, mas a FK de usuarios.id exige a linha existir).
create or replace function tests.criar_usuario(
    p_nome text,
    p_email text,
    p_perfil perfil_usuario,
    p_ativo boolean default true,
    p_limite_h3_mensal int default null
) returns uuid as $$
declare
    v_id uuid := gen_random_uuid();
begin
    insert into auth.users (id, email) values (v_id, p_email)
    on conflict (id) do nothing;

    insert into usuarios (id, nome, email, perfil, ativo, limite_h3_mensal)
    values (v_id, p_nome, p_email, p_perfil, p_ativo, p_limite_h3_mensal);

    return v_id;
end;
$$ language plpgsql;

-- Simula sessão autenticada de um dado utilizador para o resto da
-- transação de teste (pgTAP corre cada ficheiro dentro de uma
-- transação que é sempre revertida no fim).
create or replace function tests.autenticar_como(p_id uuid) returns void as $$
begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
end;
$$ language plpgsql;

create or replace function tests.sair() returns void as $$
begin
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'anon', true);
end;
$$ language plpgsql;
