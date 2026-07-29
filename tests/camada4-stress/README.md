# CAMADA 4 — Stress Test & Concorrência Transversal

Scripts Node contra um projeto Supabase real, atacando a API tal como
um utilizador (ou atacante) real faria — não simulações internas.

## Pré-requisitos (não disponíveis neste ambiente de construção)

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` de um
projeto Supabase real (recomenda-se um projeto de homologação
dedicado, nunca produção, dado que estes scripts criam e apagam
utilizadores de teste).

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:stress
```

## Cenários

- `concorrencia-ferias.ts` — 8 pedidos de férias sobrepostos,
  verdadeiramente simultâneos (`Promise.all`), de pessoas diferentes.
  Encontrou uma condição de corrida real (check-then-act no trigger) e
  motivou a migração `0004_concorrencia_ferias.sql` (exclusion
  constraint + lock consultivo por utilizador).
- `concorrencia-checklist.ts` — 10 escritas simultâneas ao mesmo item
  de checklist, confirma que o estado final é sempre consistente.
- `bypass-rls-api.ts` — ataques diretos à API (anon key sem sessão;
  sessão válida de OPERADOR a tentar auto-aprovar as próprias férias)
  contornando a UI por completo. Este é o teste de segurança mais
  importante da suite — a UI esconder um botão nunca é a fronteira
  real.
- `latencia-realtime.ts` — mede o tempo entre uma escrita e a chegada
  do evento Realtime num cliente subscrito, relevante para o
  requisito de sincronização instantânea na reunião de planeamento.
- `volume-historico.ts` — simula 3 anos de escala semanal acumulada e
  mede a latência da consulta que o ecrã de Histórico executa.

## Achado relevante já corrigido

Pensar neste cenário de concorrência genuína (não coberto pela
CAMADA 1, que testa comportamento sequencial) revelou que o trigger de
férias tinha uma janela de corrida real entre a verificação de
sobreposição e o commit. A correção (migração `0004`) usa uma
exclusion constraint do Postgres — imune a condições de corrida da
mesma forma que uma constraint UNIQUE o é — como proteção definitiva,
mantendo o trigger apenas para a mensagem de erro amigável no caso
comum (não concorrente).
