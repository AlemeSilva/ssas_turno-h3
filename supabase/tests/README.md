# CAMADA 1 — Base de Dados & Contratos (pgTAP)

Testa os contratos que a base de dados garante por si própria: schema,
triggers de regra de negócio (férias, escala H3, manutenção, checklist
imutável, trocas, delegação, catálogo de cadeias) e políticas de RLS —
tentando escrever diretamente na API como cada perfil tentaria, não só
através da interface.

## Como correr

O ambiente onde a aplicação é construída não tem Docker nem o Supabase
CLI instalados, por isso `supabase test db` (o caminho oficial, descrito
abaixo) nunca correu aqui. Em vez disso, a suite já foi executada com
sucesso diretamente contra a base de produção (61/61 em 2026-08-12),
sempre dentro de `begin; ... rollback;` — nenhum ficheiro depende de
Docker para correr, só de acesso Postgres direto.

Caminho oficial (Postgres local, recomendado para desenvolvimento):

1. Instalar o [Supabase CLI](https://supabase.com/docs/guides/cli) e o Docker Desktop.
2. Na raiz do projeto: `supabase init` (se ainda não existir `supabase/config.toml`).
3. `supabase start` — sobe um Postgres local com pgTAP disponível.
4. `supabase test db` — aplica as migrações e corre todos os ficheiros
   `supabase/tests/*.sql` por ordem alfabética, cada um dentro de uma
   transação revertida no fim (não deixa dados de teste na base).

## Estrutura

- `00_helpers.sql` — `tests.criar_usuario()` e `tests.autenticar_como()`,
  simulam um utilizador autenticado definindo `request.jwt.claims`
  (o mesmo mecanismo que `auth.uid()` lê em produção).
- `01_schema.sql` — existência de tabelas/colunas críticas.
- `02_trigger_turno_h3.sql` — só `OPERADOR_H3` pode ocupar H3.
- `03_trigger_ferias.sql` — sobreposição entre colegas, saldo de 22
  dias úteis, conflito com escala já atribuída.
- `04_calcula_tipo_fim_semana.sql` — regra do último Sábado do mês em
  vários meses/fronteiras, e o override manual do Gerente.
- `05_checklist_imutavel.sql` — trigger bloqueia UPDATE pós-conclusão;
  `destravar_checklist_item` é o único caminho de correção.
- `06_trocas_e_delegacao.sql` — substituto de troca tem de ser
  `OPERADOR_H3`; aprovação aplica-se de imediato à escala; delegação
  sem sobreposição e aditiva (titular mantém o poder).
- `07_rls_permissoes.sql` — o teste mais importante de segurança:
  cada perfil a tentar escrever diretamente via SQL, incluindo a
  reatribuição dinâmica de permissão quando uma troca é aprovada a
  meio da semana.
- `08_gestao_cadeias.sql` — adicionar/desativar cadeias; proteção
  contra apagar uma cadeia com histórico.
- `09_ferias_semanas_turno_fixo_plantao.sql` — substituto de férias por
  semana civil (RLS + unicidade); `turno_fixo` só H1/H4 e só para
  OPERADOR; `plantao_voluntarios` — primeira escolha aberta a
  Gerente/delegado, alterar uma já confirmada exclusiva do titular.
