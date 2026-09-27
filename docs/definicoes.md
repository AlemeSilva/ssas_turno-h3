# Definições: gestão de cadeias

**Estado:** levantado do código e da base a 2026-09-26. O catálogo reflete a matriz de acompanhamento diário do `SAS/CheckList.xlsx`.
**Ler quando:** acrescentar, desativar ou reativar uma cadeia; mudar de que cadeias depende o alerta GIR_FL; perceber por que uma cadeia aparece ou não num plano novo. O acompanhamento das cadeias durante o fim de semana está em `docs/checklist.md`; o alerta GIR_FL em `docs/alarmes.md`.

## 1. O que é

A página `/definicoes` (só Gerente e delegado; para os outros, "Esta área é reservada ao Gerente.") tem hoje um só cartão, **Gestão de Cadeias**, que mantém o **catálogo de cadeias** do acompanhamento diário. Uma cadeia é um processo de batch que se acompanha por secção e por dia durante o fim de semana.

Texto do ecrã: "Adicionar ou desativar uma cadeia da matriz de acompanhamento diário — situação pouco frequente, mas suportada sem alterações de código. Uma cadeia com histórico registado nunca é apagada, só desativada: deixa de entrar em novos planos, mas os registos antigos mantêm-se intactos para auditoria."

## 2. Interface

- **Formulário:** "Nome da cadeia" (ex.: SD_NOVA), "Categoria" (Normal, `*` (cópia automática para Cloud), `**` (input AML/MAB)) e o botão **Adicionar cadeia**. Um nome vazio é ignorado sem mensagem; erros da base aparecem tal como vêm (por exemplo, nome repetido).
- **Tabela** com uma linha por cadeia, por ordem: **Cadeia**, **Categoria**, **Dependência GIR_FL (22h)**, **Estado** (Ativa/Desativada) e o botão **Desativar** ou **Reativar**.
- **Dependência GIR_FL:** um botão **Incluída** / **Não incluída** por cadeia (não aparece na própria GIR_FL). Balão: "Esta cadeia atrasa o alerta de risco da GIR_FL às 22h — clica para retirar" ou "Clica para esta cadeia passar a atrasar o alerta de risco da GIR_FL às 22h".
- Todas as alterações propagam-se em tempo real às outras sessões.

## 3. Regras

- **DEF-01** Só o **Gerente e o delegado** alteram o catálogo e as dependências do GIR_FL (políticas RLS `cadeias_catalogo_write_gerente`, `gir_fl_dependencias_write_gerente`); qualquer utilizador autenticado pode **ler**.
- **DEF-02** **Adicionar:** o nome fica **em maiúsculas e sem espaços nas pontas**, é a **chave** da cadeia (não pode repetir-se), a ordem é a maior existente mais um, e nasce **ativa**. A categoria só se escolhe ao criar; **não há ecrã para renomear, reordenar nem mudar a categoria** depois.
- **DEF-03** Uma cadeia **com histórico** (que já apareceu em algum plano) **nunca se apaga** ("Esta cadeia já tem histórico registado — desative-a (ativo=false) em vez de a apagar."). O ecrã só oferece Desativar e Reativar; não há "apagar".
- **DEF-04** Desativar uma cadeia faz com que **deixe de entrar nos planos novos**; os planos já criados mantêm as suas linhas dessa cadeia. As cadeias dos planos criam-se **a partir do catálogo ativo no momento da criação** (`docs/plano-de-fim-de-semana.md`, PLA-12).
- **DEF-05** O catálogo é a **única fonte** das cadeias: a aplicação nunca tem uma lista fixa no código, para que adicionar ou desativar uma cadeia se reflita de imediato, sem alterações de código.
- **DEF-06** **Dependências do GIR_FL:** são as cadeias que, se ainda não estiverem concluídas, fazem disparar o alerta preditivo do GIR_FL no sábado (`docs/alarmes.md`, ALA-04). Só contam as cadeias da secção *Batch Sábado → Domingo* que estejam marcadas como dependência.
- **DEF-07** A **categoria** decide a instrução que aparece ao marcar atraso numa cadeia: `*` (cópia automática por crontab) ou `**` (input automático para as soluções AML/MAB); as `Normal` não têm instrução (`docs/checklist.md`, secção 2.3).

## 4. Estado do catálogo a 2026-09-26 (dados, não regras)

20 cadeias, todas ativas, por ordem: SD, SD_FL `*`, SD_EXT, SD_SAS, MKT, ODS_SAS, ODS_GP, DDS, SB_DDS, GIR_FL, MDA, EP_DDS `**`, NDOD, MARKET ABUSE `**`, MII DIARIO, EP_MDA, IMPARIDADE DIARIA, CRC, SAS AML, SAS MAB.

Dependências do GIR_FL: DDS, ODS_GP, ODS_SAS, SD, SD_EXT, SD_FL e SD_SAS.

Cada plano novo cria, para cada uma das 20 cadeias, uma linha em cada uma das três secções de batch (60 linhas por plano com este catálogo).

## 5. Limites conhecidos

- As ações de Desativar, Reativar e Incluída/Não incluída não mostram mensagem de erro se falharem.
- A ordem das cadeias na base só serve de ordenação; no Checklist as cadeias mostram-se **por ordem alfabética**.

## 6. Código e testes

- `src/pages/DefinicoesPage.tsx`, `src/data/useCadeiasCatalogo.ts`, `src/lib/cadeiasInfo.ts`.
- Base: `cadeias_catalogo`, `gir_fl_dependencias`, trigger `trg_cadeias_catalogo_protege_historico`.
- Testes: `supabase/tests/08_gestao_cadeias.sql`, `tests/camada3-e2e/gestao-cadeias.spec.ts`.
