-- =====================================================================
-- feriados_portugal e plantao_voluntarios têm RLS ativo mas nunca
-- tiveram nenhuma policy. RLS ativo + zero policies = acesso negado
-- por omissão para qualquer papel sujeito a RLS, independentemente
-- dos GRANTs de tabela — só um dono/superuser (ou BYPASSRLS) passa.
--
-- Isto ficou escondido até agora porque a única leitura destas tabelas
-- era feita através da view feriados_sem_plantao, que corre com o
-- privilégio do dono (postgres) e por isso ignora RLS. O acesso
-- direto às tabelas — que a Início/Escala passaram a fazer nesta
-- sessão — ficava bloqueado sem isto: SELECT devolvia sempre 0 linhas
-- e o INSERT de confirmarPlantonista falhava sempre com "new row
-- violates row-level security policy".
--
-- Policies alinhadas com o padrão já usado em escala_semanal: leitura
-- aberta a qualquer autenticado, escrita restrita a Gerente/delegado
-- via is_gerente_ou_delegado() (mesma função usada em escala_semanal
-- e ferias_update).
-- =====================================================================

create policy feriados_portugal_select_all on feriados_portugal
  for select to authenticated using (true);

create policy plantao_voluntarios_select_all on plantao_voluntarios
  for select to authenticated using (true);

create policy plantao_voluntarios_write_gerente on plantao_voluntarios
  for all to authenticated
  using (is_gerente_ou_delegado())
  with check (is_gerente_ou_delegado());
