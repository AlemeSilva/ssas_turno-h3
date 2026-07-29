# Suite de Homologação — Turno H3

Quatro camadas, da mais isolada (rápida, já executável) à mais
integrada (precisa de todo o ambiente real a funcionar), seguindo a
recomendação de testar por camadas: artefactos e ligações, módulos e
interações, acessos e segurança, ciclos completos.

| Camada | O quê | Ferramenta | Corre já neste ambiente? |
|---|---|---|---|
| 2 — Regras de negócio e algoritmos | Lógica pura: datas, alertas, templates, export, algoritmo de sugestão | Vitest | **Sim — 54/54 testes passam** |
| 1 — Base de dados & contratos | Schema, triggers, RLS | pgTAP | Não — precisa de Postgres local (Docker) |
| 3 — Interface e fluxos | Checklist, alertas, permissões, gestão de cadeias | Playwright | Não — precisa da app a correr + Supabase |
| 4 — Stress & concorrência transversal | Corridas, bypass de RLS, latência Realtime, volume | Scripts Node | Não — precisa de um projeto Supabase real |

## Como correr cada camada

```bash
# CAMADA 2 — já corre, sem nada externo
npm run test:regras

# CAMADA 1 — precisa de supabase init + supabase start (Docker)
supabase test db

# CAMADA 3 — precisa da app + Supabase; ver tests/camada3-e2e/README.md
npx tsx tests/camada3-e2e/seed/seed.ts
npm run dev &
npm run test:e2e

# CAMADA 4 — precisa de um projeto Supabase real; ver tests/camada4-stress/README.md
npm run test:stress
```

## Porque a Camada 2 é a única que corre aqui

O ambiente onde esta aplicação foi construída não tem Docker, Supabase
CLI, nem um projeto Supabase criado — confirmado antes de escrever
qualquer teste. A Camada 2 isola deliberadamente tudo o que é lógica
pura (sem base de dados, sem rede, sem browser), por isso é a única
que não depende de nada disso.

## O que a suite já encontrou e corrigiu, mesmo sem correr tudo

Escrever estes testes — mesmo os que não puderam ser executados —
obrigou a ler o código real com atenção suficiente para encontrar seis
bugs genuínos antes de qualquer homologação formal:

1. **Fuso horário em `paraISO`** — misturava data local com
   `toISOString()` (UTC); com Portugal em UTC+1 no horário de verão
   (a maior parte da época H3), causava erro sistemático de "um dia a
   menos" em `semana_ref`, datas do plano e das cadeias.
2. **`semanaRefDe` em Segunda-feira** — apontava para a Quinta-feira
   seguinte em vez da que estava a terminar o ciclo Qui→Seg em curso.
3. **Checagem das 20h reativa a disparar às 19h30** — padrão errado
   (devia reagir à hora, não antecipar 30 min como o GIR_FL).
4. **Checagem das 15h sem gating de manutenção** — disparava em
   qualquer Sábado, não só nos de manutenção.
5. **Carimbo do checklist a mostrar o UUID em vez do nome** — minava
   o próprio propósito do "carimbo inquestionável e legível".
6. **Condição de corrida no trigger de férias** — check-then-act sem
   proteção contra concorrência genuína; corrigido com uma exclusion
   constraint (migração `0004`).

Mais duas correções estruturais saíram do processo: `usePlanoCiclo`
usava uma lista de 18 cadeias fixa no código em vez de ler da tabela
`cadeias_catalogo` (só corrigido quando a gestão de cadeias foi
pedida), e o script de limpeza dos dados E2E não tinha em conta o
`ON DELETE RESTRICT` entre `usuarios` e `auth.users`.
