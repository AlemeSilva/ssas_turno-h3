# Arquitetura técnica: stack, estrutura e sistema de design

**Estado:** stack levantada a 2026-09-28 e sistema visual confirmado/atualizado a 2026-09-29 diretamente de `package.json`, `vite.config.ts`, `components.json`, `src/index.css`, `src/styles/theme.css`, `src/layout/AppShell.tsx`, `tsconfig*.json` e `netlify.toml`. Complementa `docs/base-de-dados.md` (o quê existe na base) e `docs/operacao.md` (como publicar) com o quê é preciso para **montar o projeto do zero**: versões exatas, convenções de código e o sistema de design.
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

### 3.1 Base técnica e objetivo visual

- **Base:** shadcn/ui, estilo `radix-nova`, cor-base `neutral`, CSS em `src/index.css` (`components.json`: `tailwind.css: "src/index.css"`, `cssVariables: true`, `prefix: ""`, `iconLibrary: "lucide"`). O tema de produto é **claro**; não há tema escuro geral nem versão para telemóvel. A única exceção escura deliberada é o diálogo "Ver Cálculo" do Headcount (`HeadcountExplicacaoDialog.tsx`), que mantém alto contraste próprio.
- **Direção aprovada pelo Gerente:** profissional, sóbria, reservada e adequada a uso prolongado por operadores; manter densidade útil de dados em monitores desktop e contraste alto em textos pequenos. A imagem fornecida foi referência de identidade cromática e de marcas, não deve ser reproduzida como fundo nem copiada literalmente.
- **Componentes shadcn/ui instalados** (`src/components/ui/`, 8 no total): `badge`, `button`, `card`, `dialog`, `input`, `select`, `textarea`, `tooltip`. Um componente novo instala-se com a CLI (`npx shadcn add <nome>`), não se escreve à mão para não perder as atualizações do registo.

### 3.2 Tokens visuais finais

Os tokens de marca e apresentação pertencem a `src/styles/theme.css`; os tokens semânticos shadcn em `src/index.css` apontam para as mesmas superfícies e estados. Os tons fortes de marca ficam na moldura e nos apontamentos, enquanto o trabalho tabular se mantém neutro.

| Token / referência | Valor | Uso visual |
| --- | --- | --- |
| Accenture purple | `#A100FF` | Chevron Accenture e fim roxo da faixa institucional; uso pontual |
| Accenture purple text | `#44177A` | Palavra Accenture no suporte claro do rodapé |
| Montepio amber | `#F0A41C` | Símbolo Montepio e linhas/detalhes de secção |
| Plum base | `#321B3B` | Fundo principal da barra lateral e início do masthead de Início |
| Plum accent | `#54266A` | Acento de texto, estado em andamento e superfícies roxas claras |
| Amber text | `#704900` | Texto legível sobre acentos/fundos âmbar claros |
| Fundo de aplicação | `#F5F6F8` | Área geral de trabalho |
| Superfície | `#FFFFFF` | Cartões, tabelas e placa clara Accenture |
| Borda discreta | `#E1E5EB` | Separação de cartões e grelhas |
| Texto principal/secundário | `#202631` / `#465160` | Hierarquia textual sobre superfície clara |

Estados operacionais usam pares de texto/fundo legíveis: verde `#176B43`/`#EAF5EE`, âmbar `#704900`/`#FFF4D6`, vermelho `#A61B1B`/`#FFF0F0`, neutro `#536071`/`#EEF1F4` e em andamento `#54266A`/`#F4EFF7`. Estes estados continuam a comunicar o estado funcional e não devem ser alterados só para combinar com a marca.

### 3.3 Moldura, marcas e hierarquia

- **Barra lateral** (`src/layout/AppShell.tsx`): largura fixa de 248 px, fundo ameixa em gradiente discreto; separa os menus OPERAÇÃO e GESTÃO. O item ativo usa régua âmbar e fundo translúcido. "Gestão de Turnos" fica como texto no topo, sem símbolo duplicado junto ao título.
- **Logos no rodapé:** sob "SERVIÇO DE OPERAÇÃO · SAS", os símbolos Accenture e Banco Montepio ficam lado a lado em suportes com relevo/sombra muito suaves. São SVG inline no próprio `AppShell.tsx`, inspirados na imagem de referência; não há ficheiros bitmap nem pedido de imagem remota. Ao alterar a moldura, manter os logos no rodapé e não voltar a acrescentar o símbolo combinado ao lado do nome do produto sem decisão do Gerente.
- **Cabeçalho e faixa de marca:** a barra superior é clara, com assinatura textual "ACCENTURE × BANCO MONTEPIO" e uma faixa superior muito fina que transita de âmbar para roxo, passando por um tom intermédio suave.
- **Área de trabalho:** cinzento-claro com gradientes radiais âmbar/roxo de baixa opacidade. Não usar a fotografia da parede da referência como fundo. Cartões brancos, sombras curtas e bordas neutras preservam leitura e densidade.
- **Cabeçalhos de página:** rótulo contextual em versais pequenas, título principal e descrição curta; uma régua vertical âmbar estabelece a hierarquia sem competir com o conteúdo. A página Início pode usar o masthead ameixa como exceção de maior presença de marca.
- **Grelhas e dados:** cabeçalhos em cinzento/lilás muito claro, separadores suaves e coluna de pessoa fixa onde aplicável. Os turnos são distinguíveis por chips de cores próprias; manter texto/ícone e legenda para não depender só da cor.
- **Relevo:** limitado aos suportes dos logos e a sombras leves de cartões; evitar sombras profundas, vidro, animações ou efeitos que aumentem ruído visual.

### 3.4 Tipografia, desktop e custo de recursos

- **Tipografia:** Geist Variable (`@fontsource-variable/geist`, importada em `src/index.css` e incluída no bundle), `--font-sans` do shadcn sobreposto a `'Geist Variable', sans-serif`. Usar pesos e tamanhos para hierarquia; não reduzir informação operacional para criar impacto decorativo.
- **Layout:** exclusivamente desktop — `#root { min-width: 1180px; overflow-x: auto; }` (`theme.css`). Não implementar breakpoints móveis sem nova decisão.
- **Ícones:** `lucide-react` quando necessário; logos de marca são os SVG inline descritos acima.
- **Custo visual:** a moldura usa CSS, gradientes leves e vetores inline; não usa fotografia, vídeo, imagens externas nem fonte remota. O build de produção de 2026-09-28 passou, mas emitiu aviso de chunks acima de 500 kB devido à geração de PDF (`pdfmake` e fontes); esse peso preexistente não foi introduzido pela identidade visual e pode ser otimizado separadamente.
- **Implementação mista:** algumas páginas usam tokens semânticos shadcn (`bg-background`, `text-foreground`, `border-border`), outras classes Tailwind mapeadas em `src/index.css` (`zinc-*`, `amber-*`, `red-*`, `emerald-*`, `violet-*`). As duas convivem; novas cores de marca devem ser acrescentadas aos tokens e não espalhadas como hexes arbitrários.

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
