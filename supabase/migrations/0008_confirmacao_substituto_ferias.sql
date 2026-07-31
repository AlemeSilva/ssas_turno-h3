-- =====================================================================
-- Confirmação de substituto para férias/licença aprovadas.
--
-- A página Início mostra ao Gerente, para cada ausência aprovada ainda
-- não confirmada, um lembrete para confirmar que a cobertura/
-- substituição foi tratada — mesmo quando o substituto habitual é
-- óbvio (ex: Pedro cobre o H1 do Sérgio por defeito no relatório
-- semanal), a confirmação em si é sempre manual, nunca automática.
--
-- Desenho mínimo por decisão explícita: um botão "Confirmar" que só
-- regista QUE foi tratado e por quem/quando — não escolhe nem grava
-- QUEM é o substituto (isso continua a ser resolvido fora da app).
-- =====================================================================

alter table ferias add column if not exists substituicao_confirmada boolean not null default false;
alter table ferias add column if not exists confirmado_por uuid references usuarios(id);
alter table ferias add column if not exists confirmado_em timestamptz;

comment on column ferias.substituicao_confirmada is 'Marcado manualmente pelo Gerente/delegado na página Início — indica que a cobertura desta ausência já foi tratada. Não implica nem regista quem é o substituto.';

-- plantao_voluntarios existe desde antes desta sessão (tal como
-- feriados_portugal e a view feriados_sem_plantao) mas nunca tinha
-- sido ligada a nada no frontend, logo nunca precisou de Realtime —
-- a página Início do Gerente subscreve-a agora.
do $$ begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'plantao_voluntarios'
    ) then
        alter publication supabase_realtime add table plantao_voluntarios;
    end if;
end $$;
