-- =====================================================================
-- Correção do calendário de feriados móveis de 2026 em feriados_portugal.
--
-- Páscoa 2026 = 5 de abril (algoritmo de Gauss/Meeus, verificado contra
-- 2025 = 20 de abril como âncora conhecida). As linhas existentes de
-- "Carnaval" e "Sexta-feira Santa" tinham sido calculadas a partir de
-- uma Páscoa errada, e faltava a linha do "Domingo de Páscoa" (feriado
-- nacional obrigatório, distinto da Sexta-feira Santa).
-- =====================================================================

update feriados_portugal set data = '2026-02-17' where ano = 2026 and nome = 'Carnaval';
update feriados_portugal set data = '2026-04-03' where ano = 2026 and nome = 'Sexta-feira Santa';

insert into feriados_portugal (data, nome, tipo, ano)
select '2026-04-05', 'Domingo de Páscoa', 'NACIONAL', 2026
where not exists (
  select 1 from feriados_portugal where ano = 2026 and nome = 'Domingo de Páscoa'
);
