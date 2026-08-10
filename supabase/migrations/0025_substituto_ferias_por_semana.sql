-- =====================================================================
-- Substituto de férias/licença passa a ser escolhido por semana civil
-- (Segunda a Sexta), não mais um único valor para o período inteiro —
-- uma ausência que atravesse mais do que uma semana pode precisar de
-- gente diferente (ou ninguém) em cada uma. Caso real que motivou
-- isto: férias de Quinta 20/08 a Sexta 28/08 — só a semana de 24/08
-- (completa) precisa de substituto (Kilson); a ponta de 20-21/08, que
-- fecha a semana em curso, não precisa de nenhum.
--
-- Uma linha em ferias_semanas só existe quando o Gerente já decidiu
-- aquela semana — a ausência de linha significa "por decidir". Mesmo
-- "Nenhum" é uma decisão explícita: substituto_id fica nulo mas
-- confirmado_em fica preenchido, para distinguir de "ainda por
-- decidir" (nenhuma linha).
-- =====================================================================

create table if not exists ferias_semanas (
    id bigserial primary key,
    ferias_id bigint not null references ferias(id) on delete cascade,
    semana_inicio date not null,
    substituto_id uuid references usuarios(id),
    confirmado_por uuid references usuarios(id),
    confirmado_em timestamptz,
    constraint uq_ferias_semanas unique (ferias_id, semana_inicio)
);

create index if not exists idx_ferias_semanas_ferias on ferias_semanas (ferias_id);

alter table ferias_semanas enable row level security;

drop policy if exists ferias_semanas_select_all on ferias_semanas;
create policy ferias_semanas_select_all on ferias_semanas
    for select to authenticated using (true);

drop policy if exists ferias_semanas_write_gerente on ferias_semanas;
create policy ferias_semanas_write_gerente on ferias_semanas
    for all to authenticated using (is_gerente_ou_delegado()) with check (is_gerente_ou_delegado());

do $$ begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'ferias_semanas'
    ) then
        alter publication supabase_realtime add table ferias_semanas;
    end if;
end $$;
