# Reconstrução do zero

**Estado:** compilado a 2026-09-28 a partir do conteúdo real de `supabase/migrations/`, `.github/workflows/*.yml`, `netlify.toml` e `supabase/config.toml` — passo a passo verificado contra estes ficheiros, não de memória. Ficheiro novo, complementa `docs/arquitetura-tecnica.md` (o quê) com **como montar um ambiente novo, do zero, até estar em produção**.
**Ler quando:** for mesmo preciso recriar o ambiente inteiro (um projeto Supabase novo, um site Netlify novo) — nunca para o trabalho do dia a dia, que usa o projeto já existente (`docs/operacao.md`). Este ficheiro não substitui nenhum dos outros 28 — é o único que junta os passos operacionais numa ordem executável.

## 1. Pré-requisitos

Conta Supabase (plano com `pg_cron` disponível), conta Netlify, conta e repositório GitHub, Node 22, `npm`, acesso a uma ligação Postgres direta ao projeto novo (para aplicar as migrações — não há `supabase db push`, `docs/operacao.md` secção 4).

## 2. Criar o projeto Supabase e ativar as extensões

1. Criar um projeto novo no painel Supabase; anotar o `project_ref` e a connection string (Postgres).
2. **Ativar, no painel (Database → Extensions), as extensões que nenhuma migração cria**: `pg_cron` (crítico — a migração 0015 já chama `cron.schedule`, por isso tem de estar ativa **antes** de aplicar as migrações), `pg_net`, `supabase_vault`, `uuid-ossp`, `pg_stat_statements`. `pgcrypto` e `btree_gist` não precisam deste passo — são criadas pelas próprias migrações 0001 e 0004 (`create extension if not exists`).
3. `auth.users` e o schema `auth` já existem num projeto novo — são geridos pela plataforma Supabase, nenhuma migração deste repositório os cria.

## 3. Aplicar o esquema (as 64 migrações)

Ligar à base do projeto novo e aplicar, **por ordem, cada ficheiro de `supabase/migrations/0001` a `0064` como instrução autónoma** (não embrulhar num `begin`/`commit` à volta de várias de uma vez — `docs/operacao.md`, OP-04). Isto é o esquema completo: as duas tabelas, a vista e as 3 políticas RLS que historicamente não tinham migração própria foram fechadas pela migração `0064` (backfill idempotente, stress-test de documentação de 2026-09-28) — já não há nenhum objeto que só exista "por fora" do histórico.

Cada tabela, coluna, trigger, função e política está descrita (o quê e porquê) em `docs/base-de-dados.md`; este ficheiro não repete esse inventário.

## 4. Confirmar o cron

As migrações 0015 e 0020 já registam os dois jobs (`select cron.schedule(...)`) — não é preciso um passo manual à parte, só confirmar que `pg_cron` estava ativo antes de as aplicar (passo 2). Ver `docs/preenchimento-anual-de-novembro.md`, secção 7, para o que cada job faz e quando corre.

## 5. Publicar as três Edge Functions

Com a CLI do Supabase autenticada (`SUPABASE_ACCESS_TOKEN`):

```
supabase functions deploy sugerir-escala --project-ref <project_ref>
supabase functions deploy desactivar-saidos --project-ref <project_ref>
supabase functions deploy gerir-utilizadores --project-ref <project_ref>
```

Mesmos comandos que `.github/workflows/deploy-functions.yml` corre automaticamente a cada push a `main` que toque `supabase/functions/**` ou `supabase/config.toml`. **`supabase/config.toml` declara um `schedule` para `desactivar-saidos` que a CLI do Supabase não suporta como chave de configuração** — lacuna conhecida (EDG-06, `docs/edge-functions.md`/`docs/limites-e-lacunas.md`): num ambiente novo, esta função continua sem agendamento nenhum até alguém a correr à mão ou construir um agendamento por fora (ex.: um job `pg_cron` a chamar `net.http_post` contra o endpoint da função).

## 6. Criar o primeiro Gerente

**Não há caminho pela aplicação para isto.** A Edge Function `gerir-utilizadores` (que cria contas) exige que quem a chama já seja Gerente ou delegado (`is_gerente_ou_delegado`) — num projeto novo, sem nenhum utilizador, essa condição nunca se cumpre. O bootstrap é manual, fora da app:

1. Criar o utilizador em Auth (painel Supabase → Authentication → Add user, ou a API admin) — anotar o `id` gerado.
2. Inserir a linha correspondente em `usuarios` por SQL direto, com `perfil = 'GERENTE'` e `ativo = true`, usando o mesmo `id`.
3. A partir daqui, esta conta já consegue entrar na aplicação e usar `gerir-utilizadores` normalmente para criar o resto da equipa.

## 7. Semear feriados e o catálogo de cadeias

- **`feriados_portugal`** não tem ecrã de escrita (só a função anual ou SQL, `docs/base-de-dados.md`). `preencher_feriados_anual()` só gera o **ano seguinte** ao corrente — para ter feriados já no ano corrente de um ambiente novo, ou se insere à mão por SQL, ou corre-se a função manualmente uma vez a mais (ver a função em `supabase/migrations/0048_corrige_nome_todos_os_santos.sql`, a versão em vigor).
- **`cadeias_catalogo`** (as 20 cadeias reais) não tem seed automático — cria-se uma a uma pelo ecrã Definições, ou por SQL direto para ir mais rápido. Lista e categorias: `docs/definicoes.md`.

## 8. Publicar o ecrã (Netlify)

Site novo ligado ao repositório GitHub, branch `main` como produção — `netlify.toml` já define o comando de build (`npm run build`), a pasta a publicar (`dist`) e o Node (22). Configurar `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` na UI da Netlify (produção) — nunca só no repositório, exceto os dois valores já commitados em `.env.production`, seguros por serem a anon key pública (`docs/arquitetura-tecnica.md`, secção 4).

## 9. GitHub Actions

Três workflows (`.github/workflows/`), nenhum obrigatório para a app funcionar, mas parte do fluxo real:

| Workflow | Dispara em | Secrets necessários |
| --- | --- | --- |
| `deploy-functions.yml` | push a `main` que toque `supabase/functions/**` ou `supabase/config.toml` | `SUPABASE_ACCESS_TOKEN` |
| `security-audit.yml` | push a `main` que toque `package.json`/`package-lock.json` | nenhum (só `npm audit --production`) |
| `e2e.yml` | só manual (`workflow_dispatch`) — desativado em push por correr contra a produção real | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |

## 10. Verificação final

`npm ci && npm run build && npm run lint && npm run test:regras` (Camada 2, não precisa de ligação à base). A suite pgTAP (Camada 1) e a Playwright (Camada 3) exigem dados reais/sementes — ver `docs/testes.md`.

## 11. Limite deliberado deste ficheiro

Isto reconstrói a **base de dados, a infraestrutura e os serviços** — não o código do ecrã em si. O código de `src/` continua a ser necessário (ou reescrito a partir das regras em `docs/*.md` e do sistema de design em `docs/arquitetura-tecnica.md`); este ficheiro não é um instalador, é o mapa da ordem em que as peças encaixam.
