-- =====================================================================
-- Ativa o Supabase Realtime para as tabelas que o frontend já
-- subscreve via postgres_changes mas que nunca foram adicionadas à
-- publication (só 'planos' estava lá — provavelmente porque nenhuma
-- migration incluiu o ALTER PUBLICATION para as restantes). Sem isto,
-- .channel(...).on('postgres_changes', ...) nunca dispara e as
-- listas só atualizam com F5 — encontrado ao testar a edição direta
-- da escala (grava corretamente, mas a grelha não refletia sem reload).
-- Metadado apenas — não toca em dados. Idempotente via bloco DO.
-- =====================================================================

do $$
declare
    tabela text;
begin
    foreach tabela in array array[
        'escala_semanal', 'ferias', 'trocas_escala',
        'tarefas_plano', 'cadeias_catalogo', 'gir_fl_dependencias',
        'checklist_itens', 'cadeias_diarias'
    ]
    loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and tablename = tabela
        ) then
            execute format('alter publication supabase_realtime add table %I', tabela);
        end if;
    end loop;
end $$;
