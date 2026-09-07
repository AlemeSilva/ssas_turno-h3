-- =====================================================================
-- Cobertura da migração 0045 — duas lacunas encontradas no peer-review
-- de sobreposição de férias (2026-09-07):
--   A) auto-sobreposição (mesmo utilizador) passa a ser bloqueada.
--   B) rejeitar um pedido nunca é bloqueado por sobreposição/saldo,
--      mesmo quando o estado à volta é um que já não devia ser
--      possível criar hoje (histórico anterior à 0044, ou uma futura
--      UI de "editar datas"/"repor pendente") — testado desativando a
--      trigger para semear esse estado "impossível" de propósito.
--
-- Decidir (aprovar/rejeitar) é sempre feito autenticado como Gerente —
-- ferias_update não tem WITH CHECK explícito, por isso herda o USING
-- também para a linha NOVA: um operador comum a mudar o próprio status
-- para fora de PENDENTE falha a sua própria cláusula (a linha nova já
-- não é usuario_id=auth.uid() and status='PENDENTE'), só
-- is_gerente_ou_delegado() cobre isso — tal como a UI real, que só
-- mostra Aprovar/Rejeitar a Gerente/delegado (PainelFerias.tsx).
-- =====================================================================
begin;
select plan(5);

-- Todos os utilizadores de teste criados já aqui, antes de qualquer
-- tests.autenticar_como() — criar_usuario() não é security definer,
-- por isso precisa do role de ligação (INSERT em auth.users), que
-- deixa de estar disponível assim que o role muda para "authenticated".
select tests.criar_usuario('Alfa Vinteum', 'alfa21@teste.pt', 'OPERADOR') as alfa_id \gset
select tests.criar_usuario('Beta Vinteum', 'beta21@teste.pt', 'OPERADOR') as beta_id \gset
select tests.criar_usuario('Gerente Vinteum', 'gerente21@teste.pt', 'GERENTE') as gerente_id \gset
select tests.criar_usuario('Gama Vinteum', 'gama21@teste.pt', 'OPERADOR') as gama_id \gset
select tests.criar_usuario('Delta Vinteum', 'delta21@teste.pt', 'OPERADOR') as delta_id \gset

-- ---------------------------------------------------------------------
-- A) auto-sobreposição
-- ---------------------------------------------------------------------
select tests.autenticar_como(:'alfa_id');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'alfa_id', '2026-03-02', '2026-03-06', 'APROVADA');

select throws_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, '2026-03-05', '2026-03-10') $f$, :'alfa_id'),
    'P0001',
    'Já tens um pedido de férias/licença teu sobreposto a este período.',
    'um novo pedido que sobrepõe um período JÁ APROVADO do mesmo utilizador é bloqueado (esticar férias aprovadas via novo pedido)'
);

select lives_ok(
    format($f$ insert into ferias (usuario_id, data_inicio, data_fim) values (%L, '2026-04-08', '2026-04-10') $f$, :'alfa_id'),
    'um pedido novo, verdadeiramente não sobreposto ao já aprovado do mesmo utilizador, continua a funcionar (não-regressão)'
);

-- ---------------------------------------------------------------------
-- B) rejeitar nunca é bloqueado, mesmo com sobreposição/saldo
--    "impossível" à volta — semeado com session_replication_role a
--    saltar todas as triggers (não exige ser dono da tabela, ao
--    contrário de ALTER TABLE ... DISABLE TRIGGER). Não alcançável por
--    submissão normal desde a 0044/0045 — é precisamente por isso que
--    tem de ser semeado à força para ser testado.
-- ---------------------------------------------------------------------
-- tests.autenticar_como() já trocou o role de sessão para
-- "authenticated" (set_config('role', ..., true)) — sem privilégio
-- para mudar session_replication_role. reset role volta ao role de
-- ligação (privilegiado) antes de a tentar mudar.
reset role;
set session_replication_role = replica;

-- B1) dois utilizadores diferentes com períodos sobrepostos, um deles
-- ainda PENDENTE.
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'beta_id', '2026-05-11', '2026-05-15', 'APROVADA');
insert into ferias (usuario_id, data_inicio, data_fim, status)
values (:'alfa_id', '2026-05-13', '2026-05-14', 'PENDENTE') returning id as pendente_sobreposto_id \gset

-- B2) saldo já muito acima do limite anual só com um registo de fundo
-- (6 meses, muito acima de 22 dias úteis por qualquer conta), sem
-- sequer contar o pedido PENDENTE que vai ser rejeitado a seguir.
insert into ferias (usuario_id, data_inicio, data_fim, tipo, status) values (:'beta_id', '2026-01-01', '2026-06-30', 'FERIAS', 'APROVADA');
insert into ferias (usuario_id, data_inicio, data_fim, tipo, status)
values (:'beta_id', '2026-07-06', '2026-07-07', 'FERIAS', 'PENDENTE') returning id as saldo_estourado_id \gset

set session_replication_role = default;

select tests.autenticar_como(:'gerente_id');
select lives_ok(
    format($f$ update ferias set status = 'REJEITADA' where id = %L $f$, :'pendente_sobreposto_id'),
    'rejeitar um pedido não é bloqueado por sobreposição, mesmo quando o período em causa está (excecionalmente) sobreposto a outro ativo'
);
select lives_ok(
    format($f$ update ferias set status = 'REJEITADA' where id = %L $f$, :'saldo_estourado_id'),
    'rejeitar um pedido não é bloqueado pelo limite de 22 dias, mesmo quando o saldo em torno dele já o excede'
);

-- Não-regressão: aprovar continua sujeito às duas verificações (só a
-- rejeição é isenta) — usa um novo par limpo, sem o estado semeado
-- acima.
select tests.autenticar_como(:'gama_id');
insert into ferias (usuario_id, data_inicio, data_fim, status) values (:'gama_id', '2026-10-12', '2026-10-16', 'APROVADA');
reset role;
set session_replication_role = replica;
insert into ferias (usuario_id, data_inicio, data_fim, status)
values (:'delta_id', '2026-10-14', '2026-10-15', 'PENDENTE') returning id as pendente_para_aprovar_id \gset
set session_replication_role = default;

select tests.autenticar_como(:'gerente_id');
select throws_ok(
    format($f$ update ferias set status = 'APROVADA' where id = %L $f$, :'pendente_para_aprovar_id'),
    'P0001',
    'Já existem férias/licença de outro colega sobrepostas a este período.',
    'aprovar (ao contrário de rejeitar) continua sujeito à verificação de sobreposição, mesmo num estado semeado excecionalmente'
);

select * from finish();
rollback;
