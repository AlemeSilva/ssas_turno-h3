# Férias, licenças, substitutos e plantões de feriado

**Estado:** levantado do código e da base a 2026-09-26. As regras entre colegas estão em `docs/regras-entre-colegas.md` (IDs `COL-`), aqui só se resumem com a referência. Decisões do Gerente: 2026-08-03 (migrações 0016, 0017), 2026-09-06 (0044), 2026-09-25 (0055), substitutos por semana civil (0025), plantão do titular (0027).
**Ler quando:** pedir, aprovar, rejeitar ou apagar férias; escolher substitutos; escolher o plantonista de um feriado; mexer no saldo de 22 dias; ler ou explicar o que aparece em "Ausências da equipa" e "Plantão de feriados".

## 1. Conceitos

- **Férias** (`tipo = FERIAS`): contam para o saldo anual de **22 dias úteis**. **Licença** (`tipo = LICENCA`): ausência aprovada fora desse saldo. **Não há ecrã para registar uma licença**; hoje só por SQL.
- Um pedido nasce **pendente** (`PENDENTE`) e o Gerente ou delegado passa-o a **aprovado** (`APROVADA`) ou **rejeitado** (`REJEITADA`). Só os aprovados contam na escala, no relatório e no headcount.
- **Substituto**: quem cobre uma ausência aprovada, decidido **por semana civil** (segunda a sexta), pelo Gerente ou delegado.
- **Plantão de feriado**: a pessoa confirmada para render o H3 num feriado em dia útil, das 07h00 ao fim da cadeia diária.

## 2. Interface: painel "Férias" (Escala do Mês)

- **Formulário:** "Data de início", "Data de fim" e o botão **Pedir férias** ("A enviar…" enquanto grava). Cria sempre um pedido **em nome de quem está a usar a aplicação**. Depois de gravar, os campos limpam-se.
- **Lista de pedidos:** quem não é Gerente nem delegado vê os pedidos **pendentes** de todos; o Gerente e o delegado veem os **pendentes e os aprovados**, por ordem de data de início. Só aparecem pedidos de pessoas **ativas**. Sem pedidos: "Sem pedidos pendentes.". Cada linha: "NOME · DD/MM/AAAA a DD/MM/AAAA".
  - Pendente, para o Gerente ou delegado: botões **Aprovar** (balão: "Aprova o pedido — conta para o limite anual de 22 dias úteis") e **Rejeitar** ("Recusa o pedido — não conta para o limite anual"). Cada botão tem uma pausa de 500 ms por pedido, para evitar cliques duplos.
  - Nos outros casos: uma etiqueta com o estado (PENDENTE âmbar, APROVADA verde, REJEITADA vermelha — esta última existe no código de estilo mas nunca é alcançada com os dados que o painel carrega hoje: a lista só busca pedidos `PENDENTE` e `APROVADA`, nunca `REJEITADA`).
  - O Gerente e o delegado veem ainda **Cancelar**, que apaga o pedido. Pede confirmação em dois cliques (o botão passa a **Confirmar?** durante 4 segundos; "Clica outra vez para apagar em definitivo — não há forma de desfazer"). Serve para corrigir um registo enganado.
- **Mensagens de erro** traduzidas para linguagem simples:

| Situação | Mensagem no ecrã |
| --- | --- |
| Sobreposição com outro pedido teu | "Já tens outro pedido teu (pendente ou aprovado) sobreposto a este período — cancela-o primeiro se quiseres ajustar as datas." |
| Sobreposição com um colega | "Já existem férias pedidas/aprovadas de outro colega neste período." |
| Saldo esgotado | "Este pedido ultrapassa o saldo anual de 22 dias úteis de férias." |
| Já há um pedido pendente | "Já existe um pedido pendente para esta pessoa — tem de ser decidido primeiro." |
| Outros (por exemplo, "Só é possível pedir férias/licença dentro do ano corrente.") | A mensagem da base, tal como vem |

## 3. Regras (resumo; texto completo em `docs/regras-entre-colegas.md`)

- **COL-01** Nenhum período (pendente ou aprovado) se sobrepõe ao de outro colega ativo, seja qual for o perfil. Os de quem saiu não bloqueiam.
- **COL-02** Uma pessoa não tem dois períodos seus sobrepostos.
- **COL-03** Um só pedido pendente de cada vez, e só para o ano corrente (ao criar); a decisão do Gerente nunca é bloqueada por isto. Com escala já atribuída, o pedido não é impedido: o substituto trata da cobertura.
- **COL-04** Saldo de 22 dias úteis por ano (só `FERIAS`, pendentes mais aprovadas, dias úteis de segunda a sexta sem descontar feriados).
- **COL-05** Só o Gerente ou delegado decide; a base deixa a pessoa apagar o seu pedido pendente, o ecrã só oferece "Cancelar" ao Gerente ou delegado.
- **FER-01** **O ano de um pedido é o ano da sua data de início.** Para o saldo, um pedido conta no ano em que **começa**, mesmo que acabe no seguinte.
- **FER-02** **Encurtar** um período (mesma pessoa, mesmo estado, mesma data de início, fim anterior) **nunca é bloqueado**; só se validam sobreposição e saldo quando algo muda de forma que possa criar conflito (migração 0057).
- **FER-03** Rejeitar **nunca** é bloqueado; aprovar volta a verificar sobreposição e saldo.
- **FER-04** Um pedido de férias de alguém que é entretanto **desativado** fica assim: os que começam de hoje em diante apagam-se (com as decisões de substituto que os acompanham); os que atravessam hoje ficam cortados até ao dia anterior; os anteriores mantêm-se (USR-08).
- **FER-05** Um período de férias **aprovado** afeta a escala: a célula mostra "Férias" nos dias úteis que não sejam feriado; não se atribui turno a quem tem os 7 dias da semana cobertos (TUR-07); e o relatório semanal só trata como ausência o que cobre **metade ou mais** dos 7 dias do período (REL-03).
- **FER-06** A coluna `eh_operador_h3` de `ferias` é uma fotografia do perfil no momento do pedido; deixou de ter efeito na regra de sobreposição desde a migração 0044.

## 4. Interface e regras: substitutos (Início, "Ausências da equipa")

Só o Gerente e o delegado veem este cartão. Duas listas:

- **Hoje:** as ausências **aprovadas** de pessoas ativas que cobrem o dia de hoje.
- **Próxima semana (DD/MM/AAAA a DD/MM/AAAA):** as aprovadas que tocam o período de sexta a quinta seguinte (a "sexta administrativa" e os 6 dias depois), sem repetir as já listadas em "Hoje".

Cada ausência mostra "NOME · DD/MM/AAAA a DD/MM/AAAA" e, por baixo, **uma linha por semana civil** (segunda a sexta) que ela toca, com o intervalo real de dias dessa semana:

- Se já há decisão: a etiqueta verde **Substituto: NOME** ou a cinzenta **Sem substituto**.
- Se não há: o botão **Confirmar substituto** ("Abre a lista da equipa para escolheres quem cobre esta semana — aparece já na Escala do Mês"). Abre a lista das **pessoas ativas**, com exceção da ausente, mais o botão **Nenhum** ("Regista que esta semana não precisa de substituto"). Escolher grava a decisão dessa semana e fecha a lista; se falhar, mostra o erro.

Regras: **COL-06**, **COL-07** e **COL-08** (`docs/regras-entre-colegas.md`). Em resumo:

- **FER-07** A decisão é **por semana civil**, gravada em `ferias_semanas` (uma linha por período e semana). "Sem linha" é "por decidir"; "Nenhum" é uma decisão explícita.
- **FER-08** Um substituto que saiu da equipa deixa de contar: a semana volta a "por decidir".
- **FER-09** **Depois de decidida, a semana não se pode alterar pelo ecrã** (só desaparece a decisão se o substituto sair da equipa). Corrigir uma escolha errada exige alterar a linha em `ferias_semanas` na base.

O substituto aparece na Escala do Mês (célula "Férias — substituído por NOME") e no relatório semanal (`docs/relatorios.md`).

## 5. Interface e regras: plantão de feriados (Início, "Plantão de feriados")

Só o Gerente e o delegado veem este cartão. Lista os feriados **a partir de hoje, do ano corrente e que caiam em dias úteis** ("Sem feriados a partir de hoje este ano." se não houver). Cada linha "NOME · DD/MM/AAAA":

- **Sem plantonista:** botão **Confirmar plantonista** ("Abre a lista da equipa para escolheres quem fica de plantão neste feriado"), aberto ao Gerente e ao delegado. Abre a lista das pessoas ativas; escolher grava. Se outra pessoa o confirmou entretanto: "Este feriado já foi confirmado por outra pessoa entretanto.".
- **Com plantonista:** etiqueta verde **Plantonista: NOME**. Se o plantonista já saiu da equipa, etiqueta âmbar **Plantonista já não está na equipa**. O botão **Alterar** ("Escolhe outra pessoa para cobrir este feriado") só aparece ao **Gerente titular**.

Regras: **COL-18**, **COL-19**, **COL-20**. Em resumo:

- **FER-10** Um plantonista por feriado (índice único), primeira escolha do Gerente ou delegado, troca só do titular. A escolha grava-se como "voluntário confirmado" (`voluntario = true`), quer a pessoa se tenha oferecido ou tenha sido designada.
- **FER-11** Ao fim de semana não há plantão: o H3 cobre o dia inteiro.
- **FER-12** A vista `feriados_sem_plantao` lista os feriados do ano sem plantonista **ativo** confirmado (com quem é o H3 nessa data e os voluntários), para alertas ao Gerente. Nenhum ecrã a usa hoje.

## 6. Onde aparecem as ausências e os plantões

- Escala do Mês: células "Férias", "Férias — substituído por…", "Feriado", "Plantão" (`docs/escala.md`).
- Início: o resumo pessoal (barra do saldo) e a Visão do Gerente (`docs/inicio.md`).
- Relatório semanal: Férias/Licenças e substituições (`docs/relatorios.md`).
- Headcount: dias de ausência descontados na capacidade presente (`docs/headcount.md`).

## 7. Código e testes

- Ecrã: `src/components/escala/PainelFerias.tsx`, `src/pages/InicioPage.tsx`, `src/data/useResumoGerente.ts`, `src/data/useResumoUsuario.ts`, `src/lib/datas.ts` (`semanasTocadas`, `diasUteis`).
- Base: tabelas `ferias`, `ferias_semanas`, `plantao_voluntarios`, `feriados_portugal`; triggers `trg_valida_ferias`, `trg_ferias_marca_perfil_h3`, `trg_ferias_semanas_valida`; vista `feriados_sem_plantao`.
- Testes: `supabase/tests/03_trigger_ferias.sql`, `09_ferias_semanas_turno_fixo_plantao.sql`, `21_ferias_auto_sobreposicao_e_rejeicao.sql`, `23_ferias_sobreposicao_ignora_inativos.sql`, `27_feriados_sem_plantao_ignora_inativos.sql`, `29_ninguem_decide_o_proprio.sql`, `30_substituto_e_delegado_nao_proprio.sql`.
