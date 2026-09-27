# Gestão de Turnos — Accenture / Banco Montepio

Central de controlo, planeamento e execução operacional do Turno H3 (equipa DEOS — operação SAS): escala H1-H4, férias, trocas de H3, Plano e Checklist do fim de semana, relatório semanal, Headcount Ideal. Em produção desde 2026-07-31, em `https://turno-h3.netlify.app`.

**Toda a documentação funcional — regras, interface, limites, decisões do Gerente — vive em [`CLAUDE.md`](CLAUDE.md) e em [`docs/`](docs); este ficheiro só descreve a stack e como pôr o projeto a correr.**

## Stack

- **Frontend:** React + Vite + TypeScript, Tailwind e shadcn/ui.
- **Backend/Dados:** Supabase (Postgres + Auth + Realtime + Edge Functions). Sem servidor dedicado.
- **Deploy:** Netlify (frontend) + Supabase (base de dados e funções) — ver [`docs/operacao.md`](docs/operacao.md).

## Estrutura

```
supabase/
  migrations/   — esquema, aplicado por ordem, à mão (ver docs/operacao.md)
  functions/    — Edge Functions: gerir-utilizadores, sugerir-escala, desactivar-saidos
  tests/        — suite pgTAP (Camada 1 de testes, ver docs/testes.md)
tests/
  camada2-regras/  — Vitest, lógica pura — corre sempre, sem serviços externos
  camada3-e2e/     — Playwright, interface e fluxos
  camada4-stress/  — scripts Node, stress e concorrência
src/
  auth/         — login, contexto de sessão, guarda de rota
  components/   — escala (férias/trocas/delegação), checklist, os dois diálogos do Headcount
  data/         — hooks de acesso a dados (com subscrição Realtime)
  lib/          — datas, headcount, alertas, templates, export, composição de escala
  layout/       — moldura da aplicação, barra de alertas
  pages/        — as páginas: Início, Plano, Checklist, Escala, Relatórios, Histórico, Definições, Utilizadores, Headcount
  types/database.ts — tipos TypeScript alinhados ao esquema (escritos à mão)
docs/           — o "cérebro" da solução: uma regra, uma casa (ver CLAUDE.md)
```

## Pôr a correr localmente

1. `npm install`.
2. Copiar `.env.example` para `.env.local` e preencher `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` do projeto Supabase (produção ou um projeto próprio de desenvolvimento — Project Settings → API no painel Supabase).
3. Para um projeto Supabase **novo**: aplicar as migrações de `supabase/migrations/`, por ordem, no SQL Editor (ou `psql`/CLI); registar as contas em Supabase Auth e a linha correspondente em `usuarios` (perfil `OPERADOR` / `OPERADOR_H3` / `GERENTE`). Contra o projeto de **produção**, isto já está feito — não repetir.
4. `npm run dev`.

Para verificar o ecrã autenticado sem credenciais reais, ver `docs/operacao.md`, secção 6 (Supabase falso, fora do repositório).

## Testes

Quatro camadas — quadro completo, com o estado real e atualizado de cada uma, em [`docs/testes.md`](docs/testes.md) (`tests/README.md` é o mapa original, hoje desatualizado nos números). Resumo:

```bash
npm run test:regras   # Camada 2 — Vitest, corre sempre
npm run lint           # oxlint
npm run build          # tsc -b && vite build
```

As Camadas 1 (pgTAP), 3 (Playwright) e 4 (stress) precisam de acesso a uma base de dados real — ver `docs/testes.md` e `docs/operacao.md` antes de as correr.

## Idioma

Toda a interface, os relatórios e a documentação estão em português europeu (pt-PT).

## Outros documentos na raiz

`CRITERIOS_FUNCIONAIS.md`, `DEPLOY.md`, `ROLLOUT_PLAN.md` e `SECURITY_RECOMMENDATIONS.md` são anteriores ao conjunto `docs/` e estão, total ou parcialmente, ultrapassados — cada um diz no topo o que o substitui.
