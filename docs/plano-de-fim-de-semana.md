# Plano de Fim de Semana

**Estado:** levantado do código e da base a 2026-09-26. O modelo de tarefas reflete `SAS/Plano_Fim_Semana.xlsx`; as permissões e a reabertura vêm das migrações 0031, 0032, 0033 e 0041.
**Ler quando:** criar, aprovar, editar ou exportar um plano; mexer nas tarefas modelo, nas tarefas excecionais ou na hora-limite; permissões do operador do ciclo. Para o ciclo de quinta a segunda, ler antes `docs/calendario-h3.md`. O acompanhamento durante a execução vive em `docs/checklist.md`.

## 1. O que é

Um plano por **ciclo de fim de semana**: de **quinta a segunda** (5 dias), identificado pela quinta (`planos.data_inicio_ciclo`). Descreve, dia a dia, as tarefas da equipa (preparação, arranque de cadeias, manutenção), e alimenta o Checklist Ativo e os alarmes. Uma só linha por ciclo (`data_inicio_ciclo` é única).

- **PLA-01** O ciclo mostrado no ecrã é o da data de hoje segundo `semanaRefDe`: de quinta a segunda o do próprio ciclo; **à terça e à quarta já aparece o ciclo seguinte** (ainda sem plano). Ver `docs/calendario-h3.md`, SEM-11.
- **PLA-02** Um plano é do tipo **NORMAL** ou **MANUTENCAO**. É de manutenção quando o sábado do ciclo é o último sábado do mês (SEM-09); o tipo é calculado pela base ao criar o plano. Não há ecrã para o forçar.

## 2. Interface (página "Plano de Fim de Semana")

**Sem plano para o ciclo.** Um cartão diz "Ainda não existe plano para o ciclo com início em DD/MM/AAAA." e mostra:

- o botão **"Criar plano (pré-popula tarefas fixas)"**, se quem vê pode criar (PLA-05);
- caso contrário, "Só NOME (operador H3 desta semana) ou o Gerente podem criar este plano." (ou, se ainda não há H3, "…ainda não há H3 atribuído para este ciclo.").

**Com plano.** De cima para baixo:

1. **Cabeçalho.** Título "Plano Prévio · DD/MM/AAAA" enquanto o estado é Rascunho ou Pendente de aprovação; "Plano Definitivo · data" depois de aprovado (a data da aprovação, ou a do ciclo). Se for de manutenção, mostra a etiqueta **MANUTENÇÃO**. Por baixo, o estado: *Rascunho*, *Pendente de aprovação*, *Aprovado*, *Em execução*, *Concluído*. Botões: **Exportar Draft**, **Exportar Definitivo** (desativado em Rascunho e em Pendente), **Submeter para aprovação** (em Rascunho) e **Aprovar Plano** (em Pendente, a quem pode geri-lo).
2. **Aviso âmbar** (fechável) quando uma alteração feita pelo operador do ciclo reabriu o plano (PLA-08).
3. **"Texto pronto a copiar"**: depois de exportar, uma caixa só de leitura com o texto e o botão **Copiar** ("Copiado!" ou "Falhou — copia à mão").
4. **Um cartão por dia**, por ordem de data, com a lista das tarefas desse dia: hora de arranque a negrito, descrição, equipa responsável e, se houver, "HR. LIMITE: hh:mm". As tarefas de origem excecional levam um lápis (**Editar tarefa excecional**) a quem tem permissão.
5. **Formulário "Adicionar tarefa excecional"**: dia (um dos 5 dias do ciclo: Quinta, Sexta, Sábado, Domingo, Segunda, com a data), hora de arranque, equipa responsável (por omissão "DEOS - Operações"), descrição, e opcionalmente **Hora-limite** (com a dica "Se definida, esta tarefa passa a entrar nos alertas de atraso quando a hora-limite for ultrapassada sem estar concluída"). Validações do ecrã: "Escolhe o dia da tarefa.", "Escolhe a hora de arranque.", "Indica a equipa responsável.".
6. **Diálogo "Editar tarefa excecional"**: dia, hora de arranque, hora-limite, equipa e descrição; guarda com bloqueio otimista (ver PLA-10).

## 3. Estados do plano e transições

`RASCUNHO` → (**Submeter para aprovação**) → `PENDENTE_APROVACAO` → (**Aprovar Plano**) → `APROVADO`.

- **PLA-03** Só se pode aprovar um plano que esteja **Pendente de aprovação** ("Só é possível aprovar um plano que esteja Pendente de aprovação (estado atual: …)."). Nem o Gerente salta de Rascunho para Aprovado. Trigger `trg_planos_transicao_aprovacao`.
- **PLA-04** A data e hora da aprovação (`data_aprovacao`) são sempre as do servidor, no momento em que o estado passa a Aprovado; o browser não as escolhe. A quem fica creditada a aprovação (`aprovado_por`) só pode ser quem a faz (política RLS `planos_update`).
- Os estados `EM_EXECUCAO` e `CONCLUIDO` existem no modelo e no Histórico, mas **nenhuma funcionalidade os atribui hoje**; todos os planos existentes estão `APROVADO`.

## 4. Quem pode o quê

- **PLA-05** **Criar** o plano, **aprovar** o plano, **editar** tarefas e escrever no checklist: o **Gerente**, o **delegado** e o **operador do ciclo** (o `OPERADOR_H3` ativo que tem H3 no sábado do ciclo, `data_inicio_ciclo + 2`). Regra da base (`pode_editar_plano`, `is_operador_do_ciclo`); o ecrã usa a mesma função (`operador_do_ciclo`), por isso nunca discorda da base. Os outros utilizadores só veem. O botão "Submeter para aprovação" aparece a todos, mas só grava a quem tem esta permissão (o ecrã não avisa os outros).
- **PLA-06** Tarefas de origem **`TEMPLATE`** e **`MANUTENCAO`**: só o Gerente ou delegado as edita ou apaga. Tarefas **`EXCECIONAL`**: também o operador do ciclo (RLS `tarefas_update` e `tarefas_delete`).
- **PLA-07** Uma tarefa **concluída é imutável** (ver `docs/checklist.md`, CHK-02).
- **PLA-08** Se alguém que **não é Gerente nem delegado** (na prática, o operador do ciclo) **adiciona, edita ou apaga** uma tarefa de um plano já **Aprovado** ou **Em execução**, o plano **volta a Pendente de aprovação** e regista-se `REABERTURA_APROVACAO` ("Alteração a tarefa após aprovação, formalmente pendente de nova aprovação do Gerente."). Marcar uma tarefa como concluída **não** reabre (só se alteram estado, quem executou e hora de conclusão). Quando não reabre, cada alteração fica registada como `EDICAO_TAREFA` ou `CONCLUSAO_TAREFA`. O Gerente ou delegado edita sem reabrir. Trigger `trg_tarefas_reabre_aprovacao`.
- **PLA-09** A **hora-limite** (`hr_limite`) de uma tarefa alimenta o alarme de atraso (`docs/alarmes.md`, ALA-03). O formulário e o diálogo de edição **só pedem a hora**, nunca o dia previsto: por isso a hora-limite conta sempre no dia da execução da tarefa, e um limite depois da meia-noite não se consegue expressar pelo ecrã.
- **PLA-10** **Bloqueio otimista da edição:** o diálogo de edição só grava se a tarefa não foi alterada por outra pessoa desde que foi aberto (compara `atualizado_em`). Se tiver mudado, avisa "Não foi possível guardar — a tarefa foi alterada ou removida por outra pessoa entretanto. Fecha e tenta novamente.".

## 5. Criar o plano: o que é gerado

O botão **Criar plano** faz, por esta ordem:

1. Insere o plano (`data_inicio_ciclo` = a quinta do ciclo; o tipo NORMAL ou MANUTENCAO é calculado pela base).
2. Insere as **tarefas modelo** (`origem = TEMPLATE`), abaixo.
3. Insere os **itens do checklist** modelo (`docs/checklist.md`).
4. Insere as **cadeias** do catálogo ativo, para as três secções de batch, com a data de cada uma (`docs/checklist.md`).

**Tarefas modelo** (equipa "DEOS - Operações", salvo indicação; datas relativas à quinta do ciclo):

| Dia | Arranque | Tarefa | Previsão de fim |
| --- | --- | --- | --- |
| Sexta (+1) | 19:00 | Preparação para o final de semana | sexta 21:00 |
| Sexta (+1) | 21:00 | Refresh aos Spawners | sexta 22:00 |
| Sexta (+1) | 23:00 | Arranque Cadeia - AUTOMÁTICA | sábado 14:00 |
| Sábado (+2) | 23:00 | Arranque Cadeia - AUTOMÁTICA | domingo 14:00 |
| Domingo (+3) | 23:00 | Arranque Cadeia - AUTOMÁTICA | segunda 14:00 |
| Sábado (+2), **só em manutenção**, equipa "DEOS - Sistemas" | 15:00 | Restart Higiénico SAS + GP, OnPremise (PRD + PRE + DSV) + Cloud (SAS AML), origem `MANUTENCAO` | sábado 18:00 |

- **PLA-11** A criação **não é atómica**: se um dos passos 2 a 4 falhar depois de o plano estar criado, o plano fica sem essa parte e o ecrã não o assinala. (A base recusa criar dois planos para o mesmo ciclo.)
- **PLA-12** As cadeias são lidas do catálogo **no momento da criação** (`cadeias_catalogo` ativas): acrescentar ou desativar uma cadeia só afeta os planos criados depois.

## 6. Exportar

- **Exportar Draft** (a "prévia de quinta"): pode usar-se a qualquer momento, mesmo em Rascunho. Título "PRÉVIA (DRAFT) — Plano de Fim de Semana".
- **Exportar Definitivo** (o "definitivo de sexta"): só depois de aprovado. Título "PLANO DEFINITIVO — Plano de Fim de Semana".
- O texto traz o tipo ("Fim de semana normal" ou "Fim de semana de MANUTENÇÃO de ambiente"), "Ciclo com início em DD/MM/AAAA.", e por cada dia (`--- DD/MM/AAAA ---`) as tarefas (`hora · descrição (equipa) | HR. LIMITE: …` e "Obs.: …" se houver), e as observações gerais do plano, se existirem.
- A aplicação **nunca envia** o texto: copia-se e envia-se à mão.

## 7. Limites e lacunas conhecidos

- Não há ecrã para editar as tarefas modelo (só as excecionais), o tipo de fim de semana, as observações gerais, nem para atribuir os estados Em execução e Concluído.
- Uma tarefa excecional só se apaga por SQL: o ecrã só oferece adicionar e editar.
- A hora de "arranque" e a "previsão de fim" das tarefas modelo estão fixas no código (`src/lib/templateTarefas.ts`); mudar um horário do modelo exige uma alteração de código.

## 8. Código e testes

- Ecrã: `src/pages/PlanoPage.tsx`, `src/data/usePlanoCiclo.ts`, `src/lib/templateTarefas.ts`, `src/lib/templateChecklist.ts`, `src/lib/exportarPlano.ts`.
- Base: tabelas `planos`, `tarefas_plano`; triggers `trg_planos_default_tipo`, `trg_planos_transicao_aprovacao`, `trg_tarefas_plano_imutavel`, `trg_tarefas_plano_toca_atualizado_em`, `trg_tarefas_plano_reabre`; funções `pode_editar_plano`, `is_operador_do_ciclo`, `operador_do_ciclo`, `calcula_tipo_fim_semana`.
- Testes: `supabase/tests/04_calcula_tipo_fim_semana.sql`, `10_tarefas_plano_edicao.sql`, `11_tarefas_excecionais_conclusao.sql`, `12_aprovacao_operador_h3.sql`; `tests/camada2-regras/templates.test.ts`, `export.test.ts`.
