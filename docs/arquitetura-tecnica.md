# Arquitetura técnica: stack, estrutura e sistema de design

**Estado:** levantado a 2026-09-28 diretamente de `package.json`, `vite.config.ts`, `components.json`, `src/index.css`, `src/styles/theme.css`, `tsconfig*.json` e `netlify.toml` — nenhum número aqui é de memória. Ficheiro novo (não existia nas rondas anteriores de documentação); complementa `docs/base-de-dados.md` (o quê existe na base) e `docs/operacao.md` (como publicar) com o quê é preciso para **montar o projeto do zero**: versões exatas, convenções de código e o sistema visual.
**Ler quando:** preparar um ambiente novo; escolher uma biblioteca ou upgrade; perceber porque é que o ecrã tem duas paletes (a maior parte clara, um diálogo escuro); antes de pedir a qualquer inteligência (humana ou não) para recriar este projeto sem acesso ao código.

## 1. Stack (versões exatas de `package.json`)

| Camada | Biblioteca | Versão |
| --- | --- | --- |
| UI | `react`, `react-dom` | ^19.2.7 |
| Routing | `react-router-dom` | ^7.18.2 |
| Build | `vite` | ^8.1.1 |
| Build | `@vitejs/plugin-react` | ^6.0.3 |
| Linguagem | `typescript` | ~6.0.2 |
| Backend | `@supabase/supabase-js` | ^2.111.0 |
| Estilo | `tailwindcss`, `@tailwindcss/vite` | ^4.3.3 |
| Estilo | `shadcn` (CLI) | ^4.16.1 |
| Estilo | `radix-ui`, `class-variance-authority`, `tailwind-merge`, `tw-animate-css` | ^1.6.7 / ^0.7.1 / ^3.6.0 / ^1.4.0 |
| Ícones | `lucide-react` | ^1.28.0 |
| Tipografia | `@fontsource-variable/geist` | ^5.3.0 |
| PDF | `pdfmake`, `@types/pdfmake` | ^0.3.11 / ^0.3.3 |
| Testes (Camada 2) | `vitest`, `@vitest/ui` | ^4.1.11 |
| Testes (Camada 3) | `@playwright/test` | ^1.62.0 |
| Testes (Camada 4) | `tsx` | ^4.23.1 |
| Lint | `oxlint` | ^1.71.0 |

Node **22** (`netlify.toml`, `node_version = "22"`; mesma versão nos três workflows do GitHub). `package-lock.json` na `lockfileVersion` 3 — usar `npm ci`, não `npm install`, para reproduzir exatamente as versões resolvidas.

- **`tsconfig.app.json`**: `target: es2023`, `lib: ["ES2023", "DOM"]`, `moduleResolution: bundler`, `jsx: react-jsx`, `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` ativos (falha o build com variável não usada). Alias `@/*` → `./src/*` (usado em todo o código e pelo shadcn/ui).
- **Scripts** (`package.json`): `npm run dev` (Vite), `build` (`tsc -b && vite build`), `lint` (`oxlint`), `test:regras` / `test:regras:watch` (Vitest, Camada 2), `test:e2e` (Playwright, Camada 3), `test:stress` (`tsx tests/camada4-stress/executar-tudo.ts`, Camada 4).

## 2. Estrutura de pastas

```
src/
  pages/        — uma página por rota (HeadcountPage.tsx, EscalaPage.tsx, ...)
  components/   — componentes partilhados; components/ui/ = shadcn/ui (secção 3)
  components/escala/, components/checklist/  — componentes específicos de uma página
  lib/          — lógica pura, sem ecrã nem Supabase (datas.ts, headcount.ts, alertas.ts, ...)
  data/         — hooks `useX` que ligam a lógica pura aos dados do Supabase
  auth/         — AuthContext, RequireAuth, Login
  layout/       — AppShell (menu), AlertBar
  styles/       — theme.css (tokens de marca, secção 3)
supabase/
  migrations/   — 0001 a 0064, SQL aplicado à mão (docs/operacao.md, secção 4)
  functions/    — as 3 Edge Functions (docs/edge-functions.md)
  tests/        — suite pgTAP, 00 a 30 (docs/testes.md, secção 3)
  config.toml   — só o `project_id` e o `schedule` (não suportado) de `desactivar-saidos`
tests/
  camada2-regras/  — Vitest (inclui docs.test.ts, a auto-verificação estrutural de docs/)
  camada3-e2e/     — Playwright
  camada4-stress/  — scripts Node de concorrência
docs/ + CLAUDE.md  — este conjunto de ficheiros
```

## 3. Sistema de design

- **Base:** shadcn/ui, estilo `radix-nova`, cor-base `neutral`, CSS gerado em `src/index.css` (`components.json`: `tailwind.css: "src/index.css"`, `cssVariables: true`, `prefix: ""`, `iconLibrary: "lucide"`). Os tokens ficam em OKLCH, tema **claro** por omissão: `--background: oklch(1 0 0)` (branco), `--foreground: oklch(0.145 0 0)` (quase preto), `--radius: 0.625rem`. Não há `.dark` a aplicar-se em lado nenhum do código — confirmado por grep: a classe `dark` (que o `@custom-variant dark` de `src/index.css` prevê) nunca é adicionada a `<html>`/`<body>` por nenhum componente.
- **Componentes shadcn/ui instalados** (`src/components/ui/`, 8 no total): `badge`, `button`, `card`, `dialog`, `input`, `select`, `textarea`, `tooltip`. Não há mais nenhum — um componente novo instala-se com a CLI (`npx shadcn add <nome>`), não se escreve à mão para não perder as atualizações do registo.
- **`src/styles/theme.css`**: tokens de **marca**, não do shadcn — roxo Accenture (`--accenture-purple: #a100ff`) e âmbar Montepio (`--montepio-orange: #f0a41c`), usados pelo `AppShell` (menu) e pelos estados de carregamento/sessão do `RequireAuth`. **O comentário no topo deste ficheiro fala de "dark mode corporativo de alto contraste" — isto é histórico, já não é o aspeto real da app** (lacuna de texto já registada em `docs/interface.md`, secção 5, e `docs/limites-e-lacunas.md`); a app é maioritariamente **clara**. A exceção deliberada é o diálogo "Ver Cálculo" do Headcount (`HeadcountExplicacaoDialog.tsx`), que usa classes Tailwind `zinc-950`/`zinc-50` diretamente para um ecrã escuro de alto contraste, isolado desse componente — não é o tema geral da app.
- **Convenção mista de cor:** muitos componentes usam os tokens semânticos do shadcn (`bg-background`, `text-foreground`, `border-border`) e outros usam classes Tailwind da paleta `zinc-*`/`amber-*`/`red-*`/`emerald-*` diretamente (ex. `AlertBar.tsx`, os badges de estado em `HeadcountPage.tsx`) — as duas convivem, não há migração pendente entre elas.
- **Layout:** só desktop — `#root { min-width: 1180px; overflow-x: auto; }` (`theme.css`); sem tema escuro nem versão telemóvel (já registado, `docs/interface.md`).
- **Tipografia:** Geist Variable (`@fontsource-variable/geist`, carregada via `@import` em `src/index.css`), `--font-sans` do shadcn sobreposto a `'Geist Variable', sans-serif` no bloco `@theme inline`.
- **Ícones:** `lucide-react` em todo o lado onde há ícone.

## 4. Variáveis de ambiente e segredos

| Variável | Onde é usada | Onde vive |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Frontend (`src/lib/supabase.ts`) | Produção: UI da Netlify. Dev: `.env.local` (gitignored, `*.local`). **`.env.production` está commitado no repositório** — só com estes dois valores, que são seguros de expor (a anon key é pública por desenho; a proteção real é RLS, `docs/perfis-e-permissoes.md` PER-01). Nunca estender este padrão a uma chave que não seja a anon. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | As 3 Edge Functions (`Deno.env.get(...)`) | Variáveis de ambiente da própria plataforma Supabase (painel do projeto), nunca no repositório |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions, `deploy-functions.yml` | Secret do repositório GitHub |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (variante sem `VITE_`) | GitHub Actions, `e2e.yml` (desativado por omissão — `workflow_dispatch` só) | Secrets do repositório GitHub |
| Ligação direta Postgres (`.db_conn`) | Consultas pontuais/manutenção, fora da app | Ficheiro local gitignored, nunca commitado (`docs/operacao.md`) |

## 5. Onde estão as outras peças

- **O quê existe na base** (tabelas, colunas, triggers, RLS, funções): `docs/base-de-dados.md`.
- **Como publicar** (Netlify, Edge Functions, créditos de deploy): `docs/operacao.md`.
- **As quatro camadas de teste**: `docs/testes.md`.
- **Recriar o ambiente inteiro do zero** (projeto Supabase novo, extensões, primeiro Gerente): `docs/reconstrucao-do-zero.md`.
- **As regras de negócio e o comportamento de cada ecrã**: o resto de `docs/` — este ficheiro não repete nada disso, só a camada técnica por baixo.

## 6. Limite deliberado deste ficheiro

Isto documenta o **sistema de design** (paleta, tipografia, biblioteca de componentes, convenções) — não transcreve classe a classe cada ecrã. A fonte exata de cada página continua a ser o código em `src/`; reproduzir um ecrã pixel a pixel só a partir de prosa exigiria copiar o código para português, o que não tem valor sobre ler o próprio código. O que este ficheiro garante é que a **escolha de stack, as versões e o sistema visual** não precisam de ser adivinhados.
