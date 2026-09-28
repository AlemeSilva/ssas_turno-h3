# Regras entre elementos da equipa

**Estado:** levantado do código e da base em produção a 2026-09-26; reconfirmado a 2026-09-28 (COL-05, COL-06, COL-12, COL-15 — migrações 0062/0063). As decisões do Gerente estão indicadas onde existem (ver `docs/decisoes.md`). Cada regra tem uma só casa: as que dizem respeito ao turno de cada pessoa vivem em `docs/turnos-e-rotacao.md` (IDs `TUR-`) e aqui só se referem.
**Ler quando:** férias, licenças, substitutos, trocas, delegação, plantões, saídas da equipa, quem pode editar o quê, ou qualquer pergunta do tipo "o que acontece se dois colegas...".

## 1. Quem é quem

| Papel | O que é | Como se sabe |
| --- | --- | --- |
| **Gerente (titular)** | Utilizador ativo com perfil `GERENTE`. **Só pode haver um ativo** | Índice único `ux_usuarios_gerente_titular_unico` (migração 0042) |
| **Delegado** | Utilizador ativo com uma delegação de aprovação a cobrir **hoje**. Tem os poderes de Gerente, menos os do titular (secção 6) | Função `is_gerente_ou_delegado()` |
| **Operador H3** | Perfil `OPERADOR_H3`. Roda entre H3, H2 e H4; propõe trocas | Perfil |
| **Operador** | Perfil `OPERADOR`. Turno fixo H1 ou H4 | Perfil e `turno_fixo` |
| **Operador do ciclo** | O `OPERADOR_H3` **ativo** com H3 no sábado do ciclo (`data_inicio_ciclo + 2`). Pode criar, editar e aprovar o plano e o checklist desse ciclo | Função `operador_do_ciclo()` |
| **Ativo / inativo** | `usuarios.ativo`. Quem saiu da equipa está inativo e **não conta** em nada que olhe para o futuro (regra USR-01) | `docs/utilizadores-e-saidas.md` |

## 2. Situações e respostas (resumo)

| Se acontecer... | Quem trata | Como | Regras |
| --- | --- | --- | --- |
| Alguém pede férias ou licença | O próprio pede; o Gerente ou delegado decide | Escala do Mês, painel Férias | COL-01 a COL-05 |
| Alguém está ausente uma semana | Gerente ou delegado escolhe o substituto, por semana civil | Início, "Confirmar substituto" | COL-06 a COL-08 |
| O H3 de uma semana não pode fazê-la | O H3 propõe a troca a outro `OPERADOR_H3`; o Gerente ou delegado decide | Escala do Mês, painel Trocas de H3 | COL-09 a COL-13 |
| O Gerente vai estar ausente | O titular cria uma delegação a uma pessoa ativa | Escala do Mês, painel Delegação | COL-14 a COL-17 |
| Há um feriado num dia útil | Gerente ou delegado escolhe o plantonista; só o titular o pode mudar | Início, "Plantão de feriados" | COL-18 a COL-20 |
| O H3 sai da equipa | Ao desativá-lo apaga-se a escala de hoje em diante; a semana em curso fica com a linha dele, que já não conta; aparece o aviso "H3 por atribuir" | Utilizadores; alerta; Sugestão automática ou edição | USR-08, ALA-07 |
| Uma semana fica sem ninguém em H1, H2 ou H4 | Gerente ou delegado | Escala do Mês, célula ou Sugestão automática | TUR-02 |

## 3. Ausências: férias e licenças entre colegas

Aplicam-se no momento de gravar (trigger `trg_valida_ferias`), por isso valem para qualquer caminho, não só para o ecrã.

- **COL-01** **Nenhum período de férias ou licença (pendente ou aprovado) pode sobrepor-se ao de outro colega ativo**, seja qual for o perfil dos dois. Mensagem: "Já existem férias/licença de outro colega sobrepostas a este período." É o requisito original, reafirmado pelo Gerente a 2026-09-06 (migração 0044, que alargou a regra a qualquer par de colegas; antes só valia entre `OPERADOR_H3`). Os períodos de quem já saiu da equipa **não bloqueiam** os colegas (migração 0055, 2026-09-25).
- **COL-02** Uma pessoa também não pode ter dois períodos seus sobrepostos (pendentes ou aprovados). Mensagem: "Já tens um pedido de férias/licença teu sobreposto a este período." Encurtar um período nunca é bloqueado (migração 0057).
- **COL-03** Só se pode ter **um pedido pendente** de cada vez ("Já tens um pedido pendente — aguarda que seja decidido antes de submeter outro.") e só se pede para o **ano corrente**: o ano da data de início tem de ser o ano de hoje ("Só é possível pedir férias/licença dentro do ano corrente."). As duas regras só se aplicam ao criar o pedido, nunca a uma decisão do Gerente (decisão de 2026-08-03, migração 0016). Com escala já atribuída o pedido **não** é impedido: o mecanismo de substituto trata da cobertura (decisão de 2026-08-03, migração 0017).
- **COL-04** **Saldo anual: 22 dias úteis** de férias, somando os pedidos `FERIAS` pendentes e aprovados cuja data de início é do mesmo ano ("Este pedido ultrapassa o saldo anual de 22 dias úteis de férias."). Os dias úteis contam de segunda a sexta, sem descontar feriados. As **licenças** (`LICENCA`) e os pedidos rejeitados não contam para o saldo. Não há ecrã para registar uma licença: hoje só se cria por SQL.
- **COL-05** Quem decide: só o Gerente ou delegado aprova ou rejeita (o pedido de um colega passa a `APROVADA` ou `REJEITADA`). A base permite a uma pessoa apagar o **seu** pedido enquanto estiver pendente, mas o ecrã só oferece o botão "Cancelar" ao Gerente ou delegado, que pode apagar qualquer pedido (confirmação em dois cliques, sem forma de desfazer). Rejeitar nunca é bloqueado por sobreposição ou saldo; aprovar continua sujeito a ambos. **Ninguém decide o seu próprio pedido**: `trg_valida_ferias` recusa (mensagem "Não podes decidir (aprovar/rejeitar) o teu próprio pedido de férias/licença…") qualquer `UPDATE` que mude o `status` para `APROVADA`/`REJEITADA`, ou `INSERT` que já nasça nesse estado, sempre que `auth.uid() = usuario_id` — mesmo o Gerente titular a pedir a sua própria férias precisa de outro Gerente ou delegado para a decidir (migração 0062, corrigido no stress-test de documentação de 2026-09-28; testado em `supabase/tests/29_ninguem_decide_o_proprio.sql`).

## 4. Substitutos de uma ausência

- **COL-06** Para cada **semana civil (segunda a sexta)** que uma ausência aprovada toca, o Gerente ou delegado decide o substituto: **uma pessoa ativa** (que não seja o próprio ausente) ou **"Nenhum"**. A ausência de decisão significa "por decidir"; "Nenhum" é uma decisão explícita (grava-se `substituto_id` vazio). Uma ausência de várias semanas pode assim ter pessoas diferentes em cada semana (migração 0025). Só o Gerente ou delegado grava estas decisões. **"Que não seja o próprio ausente" é imposto na base**, não só no ecrã: o trigger `trg_ferias_semanas_valida` recusa um `substituto_id` igual ao `usuario_id` da ausência (migração 0063, corrigido no stress-test de documentação de 2026-09-28; testado em `supabase/tests/30_substituto_e_delegado_nao_proprio.sql`).
- **COL-07** O substituto escolhido aparece na Escala do Mês, no lugar da pessoa ausente, nos dias úteis dessa semana civil ("Férias — substituído por …"). No **relatório semanal**, o substituto da semana civil dominante (a segunda a seguir à sexta do período) assume o turno do ausente, **desde que** o próprio substituto não esteja também ausente nem tenha saído da equipa.
- **COL-08** Um substituto que entretanto sai da equipa **deixa de cobrir**: a semana volta a "por decidir" no Início e a célula fica como ausência sem substituto. A base **não** impede escolher como substituto alguém que também está de férias nessa semana; o relatório trata esse caso deixando o turno vazio.

## 5. Trocas de H3

- **COL-09** Só um utilizador **ativo com perfil `OPERADOR_H3`** pode **propor** uma troca, e só em **seu** nome (RLS: `usuario_proponente = auth.uid()`). O painel de proposta só aparece a `OPERADOR_H3`.
- **COL-10** O substituto proposto tem de ser um `OPERADOR_H3` **ativo** e o proponente tem de estar **ativo**, tanto ao propor como ao aprovar (o trigger corre nos dois momentos). Mensagens: "O substituto de uma troca de H3 tem de ter perfil OPERADOR_H3 e estar ativo." e "O proponente de uma troca de H3 tem de estar ativo."
- **COL-11** A semana de uma troca é o **sábado** em que a semana H3 começa (desde 2026-09-26, migração 0061). Mensagem: "A semana de uma troca de H3 começa ao sábado — escolhe o sábado dessa semana." Uma troca antiga já aprovada numa quinta continua consultável e editável; uma proposta antiga numa quinta pode ser rejeitada mas já não aprovada.
- **COL-12** **Só o Gerente ou delegado decide** (aprovar ou rejeitar). Não há passo de aceitação do colega. **Ninguém decide a sua própria troca**: `trg_valida_troca` recusa um `UPDATE`/`INSERT` que ponha `status` a `APROVADA`/`REJEITADA` quando `auth.uid() = usuario_proponente` — cobre também o caso de um delegado que seja `OPERADOR_H3` e proponha uma troca em seu próprio nome (migração 0062, corrigido no stress-test de documentação de 2026-09-28; testado em `supabase/tests/29_ninguem_decide_o_proprio.sql`).
- **COL-13** Efeito de **aprovar** (trigger `trg_aplica_troca_aprovada`), na linha de escala desse sábado: (a) apaga a linha de H3 do proponente; (b) põe o substituto em H3 (se já tinha outra linha nessa semana, passa a H3); (c) se o substituto tinha um turno **que não era H3** nessa semana, esse turno passa para o proponente (trocam de lugar). Como todos os triggers da escala se aplicam, a troca só é aceite se o resultado cumprir as regras (um H3 por semana, limite mensal do substituto, férias). Uma troca serve para o proponente passar o **seu** H3 da semana; se ele não for o H3 dessa semana e já existir outro H3, a aprovação é recusada pela regra de um H3 por semana. As propostas por decidir de quem sai da equipa apagam-se a partir de hoje (USR-08); as já decididas ficam no histórico.

## 6. Delegação de aprovação

- **COL-14** Só o **Gerente titular** cria, altera ou apaga delegações (RLS `delegacoes_write_titular`) e só vê o painel "Delegação de Aprovação". Qualquer utilizador autenticado pode **ler** as delegações.
- **COL-15** A delegação é **aditiva**: o titular mantém sempre o seu poder. Dá ao delegado, durante o período (de `data_inicio` a `data_fim`, ambos inclusive) e **enquanto estiver ativo**, o poder de aprovação de Gerente (`is_gerente_ou_delegado()`). O candidato a substituto é qualquer pessoa ativa que não o próprio titular — imposto por uma CHECK constraint (`chk_delegacao_substituto_diferente`, migração 0063), não só pelo filtro do ecrã (`PainelDelegacao.tsx`); corrigido no stress-test de documentação de 2026-09-28, testado em `supabase/tests/30_substituto_e_delegado_nao_proprio.sql`.
- **COL-16** **Não pode haver duas delegações com períodos sobrepostos**, contando só as de substitutos ativos ("Já existe uma delegação de aprovação ativa nesse período."). Encurtar uma delegação nunca é bloqueado.
- **COL-17** O que o delegado **não** pode fazer, por ser exclusivo do titular: criar, delegar ou desativar contas `GERENTE` e repor a palavra-passe do titular; alterar os parâmetros do Headcount e fechar um mês de headcount; **alterar ou apagar** um plantão já confirmado (só a primeira escolha é aberta ao delegado); criar delegações. Tudo o resto que o Gerente faz, o delegado faz. Cada linha de auditoria escrita por um delegado fica marcada com o `delegacao_id` da delegação em vigor.

## 7. Plantão de feriados

- **COL-18** Cada feriado tem **no máximo um plantonista confirmado** (índice único parcial `plantao_voluntarios_unico_confirmado`). Se dois tentarem confirmar o mesmo feriado, o segundo recebe "Este feriado já foi confirmado por outra pessoa entretanto."
- **COL-19** A **primeira escolha** do plantonista é aberta ao Gerente e ao delegado. **Trocar** um plantonista já confirmado é exclusivo do Gerente titular (RLS `plantao_voluntarios_update_titular`).
- **COL-20** A lista de plantão só mostra feriados **em dias úteis** a partir de hoje; ao fim de semana o H3 cobre o dia inteiro e não há plantão a confirmar. Um plantonista que saiu da equipa aparece como "Plantonista já não está na equipa" e a linha mantém-se gravada; a vista `feriados_sem_plantao` só conta plantonistas ativos.

## 8. O plano de fim de semana e o checklist entre colegas

Ver `docs/plano-de-fim-de-semana.md` e `docs/checklist.md`; em resumo:

- **COL-21** Só o **Gerente, o delegado e o operador do ciclo** criam ou aprovam o plano, e escrevem no checklist e nas cadeias desse ciclo (RLS `pode_editar_plano`). Os outros utilizadores só leem, mesmo que o ecrã lhes mostre os botões.
- **COL-22** As tarefas de origem `TEMPLATE` e `MANUTENCAO` só o Gerente ou delegado as edita ou apaga; as `EXCECIONAL` também o operador do ciclo.
- **COL-23** Se o operador do ciclo alterar o plano depois de aprovado, o plano **volta a Pendente de aprovação** e fica registada a reabertura. Marcar uma tarefa como concluída não reabre.
- **COL-24** Um item de checklist ou tarefa **concluída é imutável**; só o Gerente ou delegado a reabre ("Destravar"), com justificativa obrigatória, que fica em auditoria.

## 9. Quem pode o quê (resumo dos papéis)

| Ação | Qualquer utilizador | Operador H3 | Operador do ciclo | Delegado | Gerente titular |
| --- | --- | --- | --- | --- | --- |
| Ler (pela base) escala, férias, trocas, planos, checklist e auditoria | sim | sim | sim | sim | sim |
| Pedir e apagar as **suas** férias pendentes | sim | sim | sim | sim | sim |
| Decidir férias, substitutos, plantão (1.ª escolha), escala, trocas | não | não | não | sim | sim |
| Propor uma troca de H3 | não | **sim** | sim | só se tiver perfil Operador H3 | não (perfil `GERENTE`) |
| Criar, aprovar e editar o plano do seu ciclo; escrever no checklist | não | não | **sim** | sim | sim |
| Registar utilizadores `OPERADOR` e `OPERADOR_H3`; repor palavras-passe; desativar | não | não | não | sim | sim |
| Contas `GERENTE`, delegações, plantão já confirmado, parâmetros e fecho do Headcount | não | não | não | não | **só o titular** |
| Ver Relatórios, Histórico, Definições, Utilizadores, Headcount | não | não | não | sim | sim |

## 10. Onde está imposto

- **Base de dados** (vale para qualquer caminho de escrita): triggers `trg_valida_ferias`, `trg_valida_troca`, `trg_aplica_troca_aprovada`, `trg_valida_delegacao`, `trg_valida_escala_sobre_ferias`, `trg_valida_turno_h3`, `trg_valida_um_h3_por_semana`, `trg_valida_limite_h3_mensal`, `trg_usuarios_desativado_limpa_futuro`, `trg_ferias_semanas_valida`; políticas RLS (ver `docs/perfis-e-permissoes.md`); índices únicos (`ux_usuarios_gerente_titular_unico`, `plantao_voluntarios_unico_confirmado`); CHECK `chk_delegacao_substituto_diferente`.
- **Ecrã** (só esconde ou filtra, nunca substitui a base): `src/components/escala/PainelFerias.tsx`, `PainelTrocas.tsx`, `PainelDelegacao.tsx`, `src/pages/InicioPage.tsx`, `src/pages/UtilizadoresPage.tsx`.
- **Testes**: `supabase/tests/03`, `06`, `07`, `09`, `12`, `13`, `20`, `21`, `23`, `24`, `25`, `28`, `29`, `30` (ver `docs/testes.md`).
