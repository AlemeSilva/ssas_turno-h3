# Testes: as quatro camadas

**Estado:** levantado a 2026-09-27, com a Camada 2 corrida agora mesmo (380/380) e o estado das outras três confirmado no código, nos fluxos do GitHub e nas memórias de sessões anteriores que as correram. `tests/README.md` (a raiz da pasta `tests/`) tem números e afirmações desatualizados desde a escrita inicial do projeto (fala em "54/54" na Camada 2 e diz que a Camada 1 "não corre"); **este ficheiro é a referência atual**, aquele fica como o mapa original das camadas.
**Ler quando:** escrever ou alterar um teste; decidir que camada cobre uma regra nova; correr a suite antes de publicar; explicar por que uma regra não tem teste automático.

## 1. As quatro camadas, hoje

| Camada | O quê | Ferramenta | Corre neste ambiente? | Corre em CI? |
| --- | --- | --- | --- | --- |
| **2 — Regras e algoritmos** | Lógica pura: datas, alertas, headcount, cenários, composição de escala, sugestão automática, templates, export | Vitest | **Sim, sempre** — sem rede nem base de dados | Não há workflow dedicado (nenhum fluxo do GitHub a corre hoje) |
| **1 — Base de dados e contratos** | Schema, gatilhos, RLS | pgTAP | **Sim**, contra a produção real, num script Node à parte (`docs/operacao.md`, secção 5) — nunca `supabase test db` (sem Docker aqui) | Não — o fluxo que existia (`pgtap.yml`) foi removido por ser perigoso (secção 3) |
| **3 — Interface e fluxos** | Checklist, alertas, permissões, gestão de cadeias | Playwright | Precisa da app a correr e de um Supabase com dados semeados | Só manual (`e2e.yml`, `workflow_dispatch`), e usa a produção real (`docs/operacao.md`) |
| **4 — Stress e concorrência** | Corridas, contorno de RLS pela API, latência do tempo real, volume | Scripts Node | Precisa de um projeto Supabase dedicado a isto — **não existe um** (secção 5) | Não |

## 2. Camada 2 — Regras e algoritmos (Vitest)

- `npm run test:regras` (ou `test:regras:watch`). Configuração: `vitest.config.ts`, ambiente `node`, ficheiros `tests/camada2-regras/**/*.test.ts`.
- **Hoje: 12 ficheiros, 380 testes, todos a passar** (corrido a 2026-09-27; ~0,4 s). Um décimo terceiro ficheiro (`fixtures-headcount.ts`) não é um teste, são os dados fixos partilhados pelos testes de headcount.
- Cobre: `alertas.test.ts`, `algoritmo-sugestao-h3.test.ts`, `cenarios-headcount.test.ts`, `composicaoEscala.test.ts`, `datas.test.ts`, `docs.test.ts` (a integridade estrutural de `docs/` e `CLAUDE.md`, não o seu conteúdo), `export.test.ts`, `headcount.test.ts`, `relatorio-headcount.test.ts`, `relatorio-headcount-pdf.test.ts`, `templates.test.ts`, `usuarios.test.ts` — a lógica que vive em `src/lib/` e nas duas Edge Functions sem I/O (`algoritmo.ts` de `sugerir-escala`, `composicaoEscala.ts`).
- **TES-01** É a única camada sem nenhuma dependência externa; por isso é a que se corre **sempre**, antes de qualquer publicação (`docs/operacao.md`).

## 3. Camada 1 — Base de dados e contratos (pgTAP)

- 29 ficheiros em `supabase/tests/` (`00_helpers.sql` + `01` a `28`), descritos um a um, com a migração que cada um cobre, em `supabase/tests/README.md` — **essa lista fica lá**, não se duplica aqui.
- **Não há Docker nem Supabase CLI neste ambiente**, por isso o caminho "oficial" (`supabase test db`) nunca correu aqui. A suite corre com um script Node descartável, sempre contra a **produção real**, sempre dentro de transações que terminam em `rollback` (`docs/operacao.md`, secção 5). Última corrida completa registada: 28 ficheiros, 259 `ok`, 0 falhas, 0 erros (2026-09-26).
- **TES-02** Não existe workflow de CI para esta camada. Existiu (`pgtap.yml`) e foi **removido a 2026-09-25**: reaplicava as migrações 0001 a 0009 sobre a produção a cada execução, repondo funções para versões antigas. Um substituto seguro precisaria de uma base própria (as migrações não se aplicam do zero numa base nova sem ajustes: a 0006 assume uma tabela antiga, a 0015 e a 0020 precisam do `pg_cron`).
- **TES-03** Lacuna conhecida: `preencher_feriados_anual()` não tem nenhum teste pgTAP. A função irmã, `preencher_escala_anual()`, tem quatro (`14` a `17`); a dos feriados nunca foi exercida por um teste automático — só por leitura de código e pela auditoria de execuções reais (`docs/preenchimento-anual-de-novembro.md`).
- Os ficheiros `14` a `17` não chamam `finish()` de propósito (um `rollback to savepoint` a meio repõe os contadores internos do pgTAP e faria `finish()` acusar "No tests run!").

## 4. Camada 3 — Interface e fluxos (Playwright)

- Configuração: `playwright.config.ts` — Chrome desktop, 1920×1080, sem projeto mobile (a app é só desktop), sequencial (`workers: 1`, os cenários partilham o mesmo plano semeado).
- 5 ficheiros: `checklist-imutabilidade.spec.ts`, `alertas-condicionais.spec.ts`, `alerta-sonoro-visual.spec.ts` (nome histórico — não há som, ver `docs/alarmes.md`), `permissoes-perfil.spec.ts`, `gestao-cadeias.spec.ts`. Detalhe de cada um: `tests/camada3-e2e/README.md`.
- **Corre via `npm run test:e2e`, contra uma app local e um Supabase semeado** (`tests/camada3-e2e/seed/seed.ts` e `limpar.ts`), ou pelo fluxo `e2e.yml` do GitHub — **só manual**, porque semeia e limpa dados na **produção real** (não há projeto de homologação separado).
- **TES-04** Não há, a partir daqui, forma de confirmar **quando** o fluxo `e2e.yml` correu pela última vez (não há `gh` instalado nesta máquina para consultar o histórico de execuções do GitHub Actions, nem ficheiros de relatório desta suite no repositório). Quem precisar dessa data deve olhar diretamente na aba Actions do GitHub.
- Escrever estes testes contra o código real já apanhou dois problemas antes de qualquer execução: o carimbo do checklist mostrava o UUID em vez do nome, e o `ON DELETE RESTRICT` de `usuarios.id → auth.users(id)` fazia o script de limpeza falhar se não apagasse primeiro a linha de `usuarios`. Ambos corrigidos.

## 5. Camada 4 — Stress e concorrência (scripts Node)

- Orquestrador `tests/camada4-stress/executar-tudo.ts` (`npm run test:stress`), cinco cenários em sequência: `concorrencia-ferias.ts`, `concorrencia-checklist.ts`, `bypass-rls-api.ts`, `latencia-realtime.ts`, `volume-historico.ts`. Um sexto ficheiro (`cliente.ts`, 29 linhas) não é um cenário, é o cliente Supabase (service role + anónimo) partilhado pelos cinco scripts. Detalhe de cada um: `tests/camada4-stress/README.md`.
- **TES-05** O próprio README desta camada recomenda "um projeto de homologação dedicado, nunca produção" — mas este projeto só tem um Supabase, o de produção. Não há, hoje, um sítio seguro para correr esta camada; corrê-la contra produção criaria e apagaria utilizadores e geraria carga real. **Nunca correr `npm run test:stress` contra `usqzsprhqxpupizhpenz`** sem decidir isso explicitamente com o Gerente.
- Já rendeu um achado real, antes de qualquer produção: `concorrencia-ferias.ts` (8 pedidos verdadeiramente simultâneos) expôs uma condição de corrida check-then-act no gatilho de férias, corrigida na migração `0004` com uma exclusion constraint do Postgres (imune a corrida, ao contrário do gatilho, que ficou só para a mensagem de erro amigável no caso comum).
- `bypass-rls-api.ts` é o teste de segurança mais direto de toda a suite: ataca a API tal como um atacante o faria (chave pública sem sessão; sessão de `OPERADOR` a tentar auto-aprovar as próprias férias), contornando a interface por completo — a UI esconder um botão nunca é a fronteira real (`docs/perfis-e-permissoes.md`, PER-01).

## 6. Que camada cobre o quê

| Tipo de regra | Camada certa |
| --- | --- |
| Uma fórmula, uma data, uma decisão sem I/O (headcount, alarmes, sugestão) | 2 |
| Um gatilho, uma política RLS, uma restrição da base | 1 |
| Um fluxo visível no ecrã (cliques, mensagens, o que aparece a cada perfil) | 3 |
| Concorrência real, contorno da interface, volume | 4 |

Uma regra nova de negócio que vive em SQL ganha sempre um teste pgTAP (Camada 1) **antes** de se considerar terminada (`docs/operacao.md`, OP-04/OP-05); uma função pura em TypeScript ganha um teste Vitest (Camada 2) no mesmo commit.

## 7. Limites e lacunas conhecidos

- `preencher_feriados_anual()` sem cobertura automática (TES-03).
- Sem CI para as Camadas 1 e 4; a Camada 3 só corre manualmente (TES-02, TES-04).
- A Camada 4 não tem onde correr em segurança (TES-05).
- `tests/README.md` (o índice geral) tem números e afirmações da fase inicial do projeto, hoje incorretos; segue-se este ficheiro.
- Nenhuma das quatro camadas testa as Edge Functions **como funções HTTP** (só a lógica pura que cada uma importa, na Camada 2); `docs/edge-functions.md`, secção 9.

## 8. Código e referências

- `vitest.config.ts`, `playwright.config.ts`, `tests/README.md`, `tests/camada2-regras/`, `tests/camada3-e2e/` (com `README.md` e `seed/`), `tests/camada4-stress/` (com `README.md`), `supabase/tests/` (com `README.md`).
