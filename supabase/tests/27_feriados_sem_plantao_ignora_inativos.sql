-- =====================================================================
-- Cobertura da migração 0060 — a vista feriados_sem_plantao contava, como
-- plantonista confirmado e como H3 da semana, gente que já saiu da equipa.
--
-- Os "fantasmas" são semeados DEPOIS de desativar a pessoa (a limpeza da
-- 0057 só corre na desativação): é o estado de dados anteriores a ela.
-- Semanas/feriados num sábado de dezembro do ano corrente (a vista só
-- olha para o ano corrente; tem_h3 compara semana_ref, sempre sábado, com
-- a data do feriado). Limpa-se, só nesta transação, o que já exista nessas
-- datas — dados reais de escala, plantão e feriados. As linhas de escala
-- semeiam-se com session_replication_role = replica porque um H3 fantasma
-- (inativo) nunca passaria as validações de escala.
-- =====================================================================
begin;
select plan(7);

select tests.criar_usuario('Vol Ativo 27', 'volativo27@teste.pt', 'OPERADOR_H3') as ativo_id \gset
select tests.criar_usuario('Vol Saiu 27', 'volsaiu27@teste.pt', 'OPERADOR_H3') as saiu_id \gset
update usuarios set ativo = false where id = :'saiu_id';

select extract(year from current_date)::int as ano \gset
-- dia_saiu: feriado com o plantonista que saiu; dia_ativo: feriado com um
-- plantonista ativo; dia_h3: feriado sem plantonista, com um H3 ativo.
select (date_trunc('week', make_date(:ano, 12, 15))::date + 5) as dia_saiu \gset
select (:'dia_saiu'::date - 7) as dia_ativo \gset
select (:'dia_saiu'::date - 14) as dia_h3 \gset

delete from plantao_voluntarios where data_feriado in (:'dia_saiu', :'dia_ativo', :'dia_h3');
delete from escala_semanal where semana_ref in (:'dia_saiu', :'dia_ativo', :'dia_h3');
delete from feriados_portugal where data in (:'dia_saiu', :'dia_ativo', :'dia_h3');
insert into feriados_portugal (data, nome, tipo, ano) values
    (:'dia_saiu', 'Feriado teste 27 A', 'NACIONAL', :ano),
    (:'dia_ativo', 'Feriado teste 27 B', 'NACIONAL', :ano),
    (:'dia_h3', 'Feriado teste 27 C', 'NACIONAL', :ano);

select is((select count(*)::int from feriados_sem_plantao where data = :'dia_saiu'), 1,
    'sem ninguém confirmado, o feriado aparece como sem plantão');

insert into plantao_voluntarios (data_feriado, usuario_id, voluntario) values
    (:'dia_saiu', :'saiu_id', true),
    (:'dia_ativo', :'ativo_id', true);
set session_replication_role = replica;
insert into escala_semanal (semana_ref, usuario_id, turno) values
    (:'dia_saiu', :'saiu_id', 'H3'),
    (:'dia_h3', :'ativo_id', 'H3');
set session_replication_role = default;

select is((select count(*)::int from feriados_sem_plantao where data = :'dia_saiu'), 1,
    'um feriado cujo único plantonista confirmado já saiu continua a aparecer como sem plantão');
select is((select voluntarios_confirmados::int from feriados_sem_plantao where data = :'dia_saiu'), 0,
    'e o voluntário que saiu não conta como confirmado');
select is((select count(*)::int from feriados_sem_plantao where data = :'dia_ativo'), 0,
    'com um plantonista ativo confirmado, o feriado deixa de aparecer');
select is((select tem_h3::int from feriados_sem_plantao where data = :'dia_saiu'), 0,
    'um H3 que saiu não conta como H3 dessa semana');
select is((select h3_usuario_id from feriados_sem_plantao where data = :'dia_saiu'), null::uuid,
    'e não é apontado como o H3 da semana');
select is((select tem_h3::int || ':' || (h3_usuario_id = :'ativo_id')::text from feriados_sem_plantao where data = :'dia_h3'), '1:true',
    'não-regressão: um H3 ativo continua a contar e a ser apontado');

select * from finish();
rollback;
