# Operação: publicar, migrar e verificar

**Estado:** levantado a 2026-09-27 do código, dos fluxos do GitHub e de comandos reais (`npm audit`, `git remote`, o CLI da Netlify). **Regra do Gerente, 2026-09-26: nunca fazer `git push` para `main` sem autorização explícita, mesmo quando pediu para implementar algo** — implementa-se e faz-se commit local; só se publica depois de perguntar. `DEPLOY.md`, na raiz do repositório, é um guia histórico de 2026-07-31 com informação hoje incorreta (uma equipa, datas e um CI que já não existem); não seguir os seus passos sem confirmar aqui primeiro.
**Ler quando:** publicar uma alteração de código, de função do servidor ou de base de dados; escrever ou alterar um fluxo do GitHub; verificar algo contra a produção; decidir se um push é seguro.

## 1. As três coisas que "publicar" pode querer dizer

Não há um único botão de publicar: o ecrã, as funções do servidor e a base de dados seguem **três caminhos independentes**.

| O quê | Como se publica | Gatilho |
| --- | --- | --- |
| **Ecrã** (React/Vite) | A Netlify constrói e publica | `git push` para `main` |
| **Funções do servidor** (Edge Functions) | Um fluxo do GitHub publica as três de uma vez | `git push` que altere `supabase/functions/**` ou `supabase/config.toml` |
| **Base de dados** (migrações SQL) | À mão, com uma ligação direta | Nenhum — ninguém aplica isto automaticamente |

## 2. Publicar o ecrã (Netlify)

- **Repositório:** `git@github.com:AlemeSilva/ssas_turno-h3.git` (público). **Site Netlify:** `turno-h3` (id `1864742a-de9f-4eff-b6c4-eaa19a2b7bff`), produção em `https://turno-h3.netlify.app`. O CLI `netlify` está autenticado nesta máquina.
- **Um `git push` para `main` publica logo em produção** (`netlify.toml`, `[context.production]`); não há ambiente de staging. Um push para outro ramo cria uma **pré-visualização** em `https://[nome-do-ramo]--turno-h3.netlify.app`.
- Constrói com `npm run build` (`tsc -b && vite build`) em Node 22, publica a pasta `dist`. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` vêm da UI da Netlify, nunca do repositório; localmente ficam em `.env.local` (fora do controlo de versão).
- **OP-01** O plano da Netlify tem um limite mensal de créditos de deploy (plano "Personal", ~15 créditos por deploy de produção); cada push desnecessário para `main` consome-o. Uma alteração que não precisa de novo deploy (por exemplo, só documentação) pode levar `[skip ci]` ou `[skip netlify]` em qualquer parte da mensagem do commit — a Netlify não constrói esse commit (confirmado na documentação oficial da Netlify).
- **OP-02** Nunca publicar sem autorização explícita do Gerente, mesmo quando o pedido original era "implementa isto": implementar e fazer commit **local**; só depois perguntar "posso fazer push?". Juntar vários pedidos pendentes num só push, para poupar créditos.
- **Provar que um deploy correspondeu ao commit certo:** `netlify api listSiteDeploys --data '{"site_id":"1864742a-de9f-4eff-b6c4-eaa19a2b7bff","per_page":3}'` mostra o estado, o `commit_ref` e a hora. Prova mais forte: os builds são reprodutíveis — `git archive HEAD` para uma pasta limpa, ligar `node_modules` e `.env.local`, `npm run build`, e o `dist/assets/index-<hash>.js` resultante é **exatamente** o que a produção serve (`curl -s https://turno-h3.netlify.app/ | grep -o 'assets/index-[^"]*\.js'`, depois `cmp`).
- **Rollback:** na UI da Netlify, em Deploys, "Publish deploy" sobre uma versão anterior é imediato; corrigir a fonte exige depois um `git revert` em `main` (senão o próximo push republica a versão com o problema).

## 3. Publicar as funções do servidor (Edge Functions)

- Fluxo `.github/workflows/deploy-functions.yml`: dispara em `push` para `main` que altere `supabase/functions/**` ou `supabase/config.toml`, ou manualmente (`workflow_dispatch`). Publica **sempre as três funções** (`sugerir-escala`, `desactivar-saidos`, `gerir-utilizadores`) com a CLI da Supabase, usando o segredo `SUPABASE_ACCESS_TOKEN` do repositório.
- **OP-03** Alterar uma função é alterar comportamento em produção assim que o push chega a `main` — a mesma regra de pedir autorização antes de publicar (OP-02) aplica-se aqui também. Ver `docs/edge-functions.md`.

## 4. Aplicar uma migração na base de dados

- **Não há `supabase db push` nem CI a aplicar migrações.** As 61 migrações em `supabase/migrations/` (`docs/base-de-dados.md`, secção 11) foram todas aplicadas **à mão**, por ordem, contra a produção.
- **Ligação:** `.db_conn`, na raiz do repositório (gitignored, nunca commitado) — a connection string direta (forma "pooler") do projeto Supabase `usqzsprhqxpupizhpenz`. Verificar este ficheiro **antes** de pedir credenciais ao Gerente; já existe.
- **Sem `psql`, Docker nem a CLI da Supabase** disponíveis neste ambiente. As ligações fazem-se com um pequeno script Node (`pg`, instalado à parte na pasta de rascunho) que lê `.db_conn` e liga com `ssl: { rejectUnauthorized: false }`.
- **OP-04** Uma migração real que fica aplica-se autónoma (uma instrução de cada vez, sem embrulhar em transação — a maioria já traz o seu próprio `begin`/`commit` quando precisa). Uma consulta ou teste **exploratório** embrulha-se sempre em `begin; … rollback;`, mesmo que altere ou substitua uma função (`create or replace function` é transacional: a versão em produção só muda de facto num `commit`).
- **OP-05** Depois de qualquer execução que tocou tabelas reais, provar por **consulta** que não sobrou resíduo (contar as linhas com os marcadores sintéticos usados), nunca só confiar no `rollback`.

## 5. Testar as regras da base de dados (pgTAP) contra produção

- **Não existe CI para a suite** `supabase/tests/*.sql` (61 ficheiros → hoje 28; um fluxo `pgtap.yml` existiu e foi **removido a 2026-09-25** por reaplicar as migrações 0001 a 0009 sobre a produção a cada execução — não recriar sem perceber por que foi removido). Corre-se com o mesmo script Node da secção 4.
- **Forma:** uma só ligação; `begin`; opcionalmente as migrações ainda por aplicar, na mesma transação, para comparar "antes" e "depois"; cada ficheiro de teste dentro de `savepoint`/`rollback to savepoint`; a execução **termina sempre em `rollback`** — nada fica gravado.
- **OP-06** Desde 2026-09-25 a produção **não tem** a extensão `pgtap` nem o schema `tests` instalados (removidos a pedido do Gerente). Cada execução tem de os criar **dentro da própria transação** (`create extension pgtap with schema extensions`, depois `supabase/tests/00_helpers.sql`) — desaparecem com o `rollback` final.
- **A concatenação migração+teste tem uma armadilha:** uma migração nova **não** traz o seu próprio `begin`/`rollback` (autocommita quando aplicada a sério); um ficheiro de teste tem o seu **próprio** `begin`/`rollback`, só à volta do seu corpo. Colar os dois ficheiros com um simples `cat` faz a migração correr **antes** do `begin` do teste — aplica-se a sério, mesmo se o teste depois reverter. Solução: montar um script com **um único** `begin`/`rollback` exterior, tirando as linhas `begin;`/`rollback;` de cada ficheiro individual.
- **OP-07** Nunca simular condições em produção reescrevendo funções ou vistas dentro da transação (mesmo revertida) para fingir outra data ou estado — só correr os testes reais, sem alterações extra. Ficou definido a 2026-09-25 depois de uma simulação de "relógio" ter sido interrompida por ir além do pedido.
- **OP-08** Nunca acionar ao vivo, para "só verificar", uma ação genuinamente irreversível (por exemplo Fechar Mês do Headcount) — verificar o estado do botão (ativo/desativado) e confiar nos testes já passados para o caminho de escrita.

## 6. Verificar o ecrã sem credenciais

Não há conta de teste à mão. Para ver e testar o ecrã autenticado sem tocar em produção: um **Supabase falso**, feito só na pasta de rascunho (nunca no repositório) — um plugin do Vite que troca `src/lib/supabase.ts` por uma implementação em memória (tabelas fixas, `rpc`, `channel`, `functions.invoke`, sessão simulada), com cenários trocáveis por parâmetro de URL. **Cuidado:** `preview_start` lê `.claude/launch.json` da pasta onde a sessão foi lançada (não da pasta do projeto); um nome de configuração desconhecido cai silenciosamente na configuração real (com Supabase verdadeiro) — confirmar sempre a porta/nome devolvidos antes de continuar.

## 7. Fluxos do GitHub Actions — resumo

| Fluxo | Dispara em | O que faz | Estado |
| --- | --- | --- | --- |
| `deploy-functions.yml` | push a `main` que toque `supabase/functions/**` ou `supabase/config.toml`; manual | Publica as 3 Edge Functions | ativo |
| `security-audit.yml` | push a `main` que toque `package.json`/`package-lock.json`; manual | `npm audit --production` | ativo; **0 vulnerabilidades** (verificado a 2026-09-27) |
| `e2e.yml` | **só manual** (`workflow_dispatch`) | Semeia dados sintéticos, corre a suite Playwright contra o build local, limpa no fim | **desligado do push de propósito** — usa `SUPABASE_URL`/`SERVICE_ROLE_KEY` **de produção**; correr só quando for mesmo preciso |
| ~~`pgtap.yml`~~ | — | — | **removido a 2026-09-25** (reaplicava migrações antigas em produção a cada execução) |

## 8. No fim de uma tarefa de implementação

- **OP-09** Confirmar **ao vivo**, nunca de memória, e fechar com dois veredictos, no vocabulário fixo do Gerente:
  - **Base de Dados:** Tudo implementado | Depende de autorização | Falta implementar
  - **Netlify:** Falta deploy | Tudo implementado | Falta implementar
- Uma pergunta de sim/não do Gerente recebe **"Sim"** ou **"Não"** como primeira palavra, depois o detalhe.

## 9. Limites e lacunas conhecidos

- `DEPLOY.md` e `ROLLOUT_PLAN.md`, na raiz, descrevem um processo e uma equipa de 2026-07/08 que já não correspondem à realidade (uma "Fase 1" de 9 utilizadores, um CI de pgTAP que foi removido, uma versão "0.0.0 pré-GA"). Ficam como registo histórico; **este ficheiro é a referência atual**.
- Não há ambiente de staging: toda a verificação de ecrã faz-se com o Supabase falso (secção 6) ou, para a base de dados, com transações revertidas contra a produção real (secção 5).
- `e2e.yml`, ao correr, semeia e apaga dados **na produção real**; por isso está desligado do push automático.
- Não há registo automático de quando uma migração foi aplicada (nenhuma tabela de "migrações aplicadas"); a única prova é o estado atual do esquema e a auditoria (`docs/historico.md`).

## 10. Código e referências

- `netlify.toml`, `.github/workflows/` (`deploy-functions.yml`, `security-audit.yml`, `e2e.yml`), `supabase/migrations/`, `supabase/tests/README.md`, `supabase/config.toml`.
- `docs/edge-functions.md` (as três funções e os seus agendamentos), `docs/base-de-dados.md` (o que cada migração numerada mudou), `docs/testes.md` (as quatro camadas de teste).
