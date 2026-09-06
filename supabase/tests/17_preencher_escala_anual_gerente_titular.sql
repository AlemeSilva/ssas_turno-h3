begin;
select plan(4);

-- Isto corre contra uma base com dados reais — limpa temporariamente,
-- só dentro desta transação (revertida no fim), qualquer escala já
-- gravada para 2027 que possa colidir com os casos abaixo.
delete from escala_semanal where extract(year from semana_ref) = 2027;

-- CASO A: caminho feliz (1 Gerente ativo, estado real de hoje) —
-- não-regressão: 312 linhas, sem aviso.
savepoint antes_caso_a;

select lives_ok(
    $$ select preencher_escala_anual() $$,
    'caminho feliz continua sem rebentar depois de escolher o Gerente titular'
);
select is(
    (select count(*)::int from escala_semanal where extract(year from semana_ref) = 2027),
    312,
    'com 1 só Gerente ativo, continua a gerar as mesmas 312 linhas'
);
select is(
    (select acao from logs_auditoria where referencia_tipo = 'ESCALA_ANUAL' order by id desc limit 1),
    'PREENCHIMENTO_AUTOMATICO',
    'com 1 só Gerente ativo, o log fica limpo — sem aviso'
);

rollback to savepoint antes_caso_a;

-- CASO B: 2 Gerentes ativos em simultâneo deixou de ser um estado
-- alcançável — a migração 0042 (dossiê de segurança) impede a própria
-- criação/ativação de um segundo titular na origem, por isso o cenário
-- de desambiguação por criado_em que este caso testava (só o mais
-- antigo recebe H4) já não é construível. preencher_escala_anual()
-- mantém essa lógica de desempate (código defensivo inofensivo, nunca
-- mais alcançado na prática) — este caso passa a validar a proibição
-- em si, não o desempate.
--
-- Não usa tests.criar_usuario aqui de propósito: desde 0043, esse
-- helper desativa automaticamente o titular existente antes de ativar
-- um novo Gerente sintético (correção necessária para não colidir em
-- ~13 outros ficheiros que só querem UM ator com poderes de Gerente,
-- sem querer saber se coexiste com o real) — isso resolveria o conflito
-- em vez de o exercer. Insere diretamente para provar o índice único
-- em si, sem passar pela conveniência do helper.
savepoint antes_caso_b;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111117', 'gerente.sintetico17@teste.pt')
on conflict (id) do nothing;
select throws_ok(
    $$ insert into usuarios (id, nome, email, perfil, ativo)
       values ('11111111-1111-1111-1111-111111111117', 'Gerente Sintético', 'gerente.sintetico17@teste.pt', 'GERENTE', true) $$,
    '23505',
    'duplicate key value violates unique constraint "ux_usuarios_gerente_titular_unico"',
    'já não é possível ativar um segundo Gerente titular em simultâneo (0042)'
);

rollback to savepoint antes_caso_b;

select * from finish();
rollback;
