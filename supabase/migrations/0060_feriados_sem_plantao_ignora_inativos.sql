-- =====================================================================
-- A vista feriados_sem_plantao contava, como plantonista confirmado e
-- como H3 da semana, gente que já saiu da equipa: um feriado cujo único
-- plantonista confirmado tinha sido desativado deixava de aparecer como
-- "sem plantão", e tem_h3 / h3_usuario_id apontavam para um H3 que já
-- não está cá. Desde a 0057 desativar apaga as linhas futuras, por isso
-- isto só acontecia com dados anteriores a ela — mas a vista ficava
-- errada para eles. Agora só conta quem está ativo.
--
-- Nada na app lê esta vista hoje; corrige-se para não ficar uma armadilha
-- para quem a vier a usar.
--
-- A vista tem security_invoker=true. "create or replace view" SUBSTITUI
-- as opções da vista pelas que forem indicadas (sem WITH ficava sem
-- nenhuma, e a vista passava a correr com os privilégios do dono em vez
-- dos de quem a consulta) — por isso a opção é repetida aqui.
-- =====================================================================

create or replace view feriados_sem_plantao
with (security_invoker = true) as
select f.data,
       f.nome,
       f.tipo,
       (select count(*)
          from escala_semanal e
          join usuarios u on u.id = e.usuario_id
         where e.semana_ref = f.data and e.turno = 'H3' and u.ativo) as tem_h3,
       (select e.usuario_id
          from escala_semanal e
          join usuarios u on u.id = e.usuario_id
         where e.semana_ref = f.data and e.turno = 'H3' and u.ativo
         limit 1) as h3_usuario_id,
       (select count(*)
          from plantao_voluntarios p
          join usuarios u on u.id = p.usuario_id
         where p.data_feriado = f.data and p.voluntario = true and u.ativo) as voluntarios_confirmados,
       array_agg(distinct pv.usuario_id) filter (where pv.voluntario = true) as voluntarios_ids
  from feriados_portugal f
  left join (select p.*
               from plantao_voluntarios p
               join usuarios u on u.id = p.usuario_id and u.ativo) pv
         on f.data = pv.data_feriado
 where extract(year from f.data) = extract(year from current_date)
 group by f.data, f.nome, f.tipo
having count(pv.usuario_id) filter (where pv.voluntario = true) = 0;
