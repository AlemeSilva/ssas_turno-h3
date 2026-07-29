# CAMADA 3 — Interface e Fluxos (Playwright)

Testes E2E headless, viewport de desktop fixo em 1920x1080 (`playwright.config.ts`),
simulando o posto de trabalho da equipa sob VPN corporativa — sem projeto mobile,
propositadamente, porque a app é desktop-only.

## Pré-requisitos (não disponíveis neste ambiente de construção)

Não foram executados nesta sessão — precisam de:

1. Um projeto Supabase real (ou local via `supabase start`) com as migrações
   `0001` a `0003` aplicadas.
2. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente, para o seed.
3. A app a correr (`npm run dev`, ou `E2E_BASE_URL` a apontar para um deploy).
4. Browsers do Playwright instalados: `npx playwright install chromium`.

## Como correr

```bash
# 1. Semear dados de teste (utilizadores, escala, plano, checklist, cadeias)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx tests/camada3-e2e/seed/seed.ts

# 2. Noutro terminal, com .env.local preenchido
npm run dev

# 3. Correr a suite
npm run test:e2e

# 4. Limpar os dados de teste
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx tests/camada3-e2e/seed/limpar.ts
```

## Cobertura

- `checklist-imutabilidade.spec.ts` — confirmação em 2 etapas, carimbo
  legível (nome, não UUID — bug encontrado e corrigido ao escrever
  este teste), UI nunca oferece desmarcar diretamente, só o Gerente
  vê "Destravar" e precisa de justificativa.
- `alertas-condicionais.spec.ts` — popups de instrução `*`/`**` ao
  marcar atraso, ausentes numa cadeia normal.
- `alerta-sonoro-visual.spec.ts` — janelas críticas 20h/15h com o
  relógio do browser mockado (`page.clock`); confirma que o alerta das
  15h nunca aparece fora de um ciclo de manutenção.
- `permissoes-perfil.spec.ts` — a interface reflete a mesma fronteira
  de permissão que a CAMADA 1 testa diretamente na API.
- `gestao-cadeias.spec.ts` — adicionar/desativar cadeias na aba
  Definições, nunca com opção de apagar.

## O que esta suite validou por inspeção, mesmo sem correr

Escrever estes testes contra o código real dos componentes (não só a
especificação) obrigou a confirmar texto exato, seletores e fluxo —
isso já encontrou e corrigiu dois bugs reais antes de qualquer
execução: o carimbo do checklist mostrava o UUID em vez do nome da
pessoa, e o `usuarios.id -> auth.users(id)` com `ON DELETE RESTRICT`
faria o script de limpeza falhar sem apagar primeiro a linha de
`usuarios`.
