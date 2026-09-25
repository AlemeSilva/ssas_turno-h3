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
    -- Só pode haver um Gerente titular ativo de cada vez (migração 0042,
    -- dossiê de segurança — ux_usuarios_gerente_titular_unico). A
    -- maioria dos ficheiros que cria um Gerente sintético só quer um
    -- ator com poderes de Gerente para o seu próprio cenário — não lhes
    -- interessa nem dependem de coexistir com o Gerente real (o único
    -- caso que testa essa interação a sério,
    -- 19_gerente_titular_unico.sql, gere a ativação/desativação
    -- explicitamente, sem depender deste comportamento). Desativar o
    -- titular real aqui é seguro: corre sempre dentro da transação
    -- revertida no fim de cada ficheiro de teste.
    if p_perfil = 'GERENTE' and p_ativo then
        update usuarios set ativo = false where perfil = 'GERENTE' and ativo = true;
    end if;

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

-- Datas dos testes calculadas a partir de hoje, nunca escritas à mão.
-- trg_valida_ferias só aceita INSERT de férias com data_inicio no ano
-- em curso, e preencher_escala_anual() gera sempre o ano SEGUINTE — por
-- isso um '2026-08-10' ou um "2027" literal fazia a suite falhar a 1 de
-- janeiro. O dia da semana de uma mesma data muda de ano para ano; os
-- testes que dependem dele (semana_ref é sempre Sábado, o saldo de
-- férias conta dias úteis) ancoram-se em sabado()/segunda() em vez de
-- num dia do mês fixo.
create or replace function tests.dia(p_mes int, p_dia int) returns date as $$
    select make_date(extract(year from current_date)::int, p_mes, p_dia);
$$ language sql stable;

-- Primeiro sábado em ou depois de p_mes/p_dia, no ano corrente.
create or replace function tests.sabado(p_mes int, p_dia int) returns date as $$
    select tests.dia(p_mes, p_dia) + ((6 - extract(dow from tests.dia(p_mes, p_dia))::int + 7) % 7);
$$ language sql stable;

-- Primeira segunda-feira em ou depois de p_mes/p_dia, no ano corrente.
create or replace function tests.segunda(p_mes int, p_dia int) returns date as $$
    select tests.dia(p_mes, p_dia) + ((1 - extract(dow from tests.dia(p_mes, p_dia))::int + 7) % 7);
$$ language sql stable;

-- O ano que preencher_escala_anual() gera, os seus sábados (52 ou 53,
-- conforme o ano — as semanas são os sábados de 1 de janeiro a 31 de
-- dezembro) e o primeiro deles.
create or replace function tests.ano_seguinte() returns int as $$
    select extract(year from current_date)::int + 1;
$$ language sql stable;

create or replace function tests.semanas_ano_seguinte() returns int as $$
    select count(*)::int
      from generate_series(make_date(tests.ano_seguinte(), 1, 1)::timestamp, make_date(tests.ano_seguinte(), 12, 31)::timestamp, interval '1 day') d
     where extract(dow from d) = 6;
$$ language sql stable;

create or replace function tests.primeiro_sabado_ano_seguinte() returns date as $$
    select d::date
      from generate_series(make_date(tests.ano_seguinte(), 1, 1)::timestamp, make_date(tests.ano_seguinte(), 1, 7)::timestamp, interval '1 day') d
     where extract(dow from d) = 6;
$$ language sql stable;

-- Sem isto, a PRIMEIRA chamada a tests.autenticar_como() funciona
-- (ainda a correr como o role de ligação, tipicamente superuser), mas
-- QUALQUER chamada seguinte a uma função tests.* falha com "permission
-- denied for schema tests" — a troca de role para authenticated já
-- não tem USAGE no schema tests, por isso nunca se consegue mudar de
-- utilizador simulado uma segunda vez. Só descoberto ao correr mesmo
-- os testes (nunca tinham corrido antes nesta sessão).
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;
alter default privileges in schema tests grant execute on functions to authenticated, anon;
