# Gestão de Turnos — Accenture / Banco Montepio

Central de controlo, planeamento e execução operacional do Turno H3 (equipa DEOS — operação SAS).

## Stack

- **Frontend:** React + Vite + TypeScript, sem framework de UI pesado (CSS próprio em `src/styles/theme.css`).
- **Backend/Dados:** Supabase (Postgres + Auth + Realtime + Edge Functions). Sem servidor dedicado (Render foi deliberadamente excluído do desenho).
- **Deploy previsto:** Netlify (frontend) + Supabase (tudo o resto).

## Estrutura

```
supabase/
  migrations/
    0001_schema.sql   — tabelas, enums, triggers, regras de negócio
    0002_rls.sql      — políticas de Row Level Security
    0003_gestao_cadeias.sql — permite adicionar/desativar cadeias (Gerente)
    0004_concorrencia_ferias.sql — exclusion constraint + lock, corrige condição de corrida
  functions/
    sugerir-escala/   — Edge Function: sugestão (não aplica) de H1-H4
  tests/              — suite pgTAP (CAMADA 1 de homologação)
tests/
  camada2-regras/     — Vitest, lógica pura (já corre — ver tests/README.md)
  camada3-e2e/        — Playwright, interface e fluxos
  camada4-stress/     — scripts Node, stress e concorrência
src/
  auth/               — login, contexto de sessão, guarda de rota
  components/
    escala/           — férias, trocas, delegação de aprovação
    checklist/         — item de checklist, cadeia, painel de alertas
  data/               — hooks de acesso a dados (com subscrição Realtime)
  lib/                — datas, templates de tarefas/checklist, export, cores
  layout/             — shell principal, barra de alertas
  pages/              — as 5 abas: Plano, Checklist, Escala, Relatórios, Histórico
  types/database.ts   — tipos TypeScript alinhados ao schema
```

## Antes de correr

1. Criar um projeto Supabase (free tier).
2. Aplicar as migrações, por ordem, no SQL Editor do Supabase (ou via Supabase CLI):
   `0001_schema.sql` → `0002_rls.sql` → `0003_gestao_cadeias.sql` → `0004_concorrencia_ferias.sql`.
3. Criar os 6 utilizadores em Supabase Auth (Gerente provisiona manualmente, sem
   auto-registo público), e inserir a linha correspondente em `usuarios` para cada um
   (perfil `OPERADOR` / `OPERADOR_H3` / `GERENTE`).
4. Copiar `.env.example` para `.env.local` e preencher `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API no painel Supabase).
5. `npm install && npm run dev`.

A Edge Function `sugerir-escala` é opcional para já — o algoritmo de sugestão ainda
não está ligado a um botão na interface (ver "Por fazer" abaixo); pode ser invocada
diretamente via `supabase functions invoke sugerir-escala` para validação manual.

## Por fazer (fora do âmbito desta fase de construção)

- Ligar o botão "Sugerir automaticamente" da Escala à Edge Function `sugerir-escala`.
- Cron/Edge Function agendada que bloqueia o login de utilizadores cuja `data_saida`
  já passou (ver comentário em `src/auth/RequireAuth.tsx`).
- Alargar o Histórico aos restantes separadores propostos (Plano, Checklist/Cadeias)
  além de Escala e Auditoria, já implementados.
- Extrair tokens de cor definitivos (ficheiro de marca) caso a Accenture/Montepio
  forneçam um guia de marca formal além da imagem de referência usada agora.

## Idioma

Toda a interface e geração de relatórios está em português europeu (pt-PT).

## Homologação

Suite de testes por camadas em `tests/` — ver `tests/README.md` para o
quadro completo. A CAMADA 2 (`npm run test:regras`) já corre neste
repositório sem qualquer serviço externo; as restantes três precisam
de Postgres/Supabase reais e estão descritas, mas não executadas.
