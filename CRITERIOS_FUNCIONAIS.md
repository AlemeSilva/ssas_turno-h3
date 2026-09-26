# Critérios funcionais em vigor

Reúne os critérios do Turno H3 que o código tem de respeitar. Vêm do Gerente
e dos documentos de origem em `SAS/` (`Escala_2026.xlsx`, `CheckList.xlsx`,
`Plano_Fim_Semana.xlsx`) e foram levantados do código. Se algum estiver errado,
corrige-se aqui primeiro e só depois o código.

**Cada alarme segue obrigatoriamente estes critérios.** Antes de criar ou
alterar um alarme: confirmar o critério com o Gerente, escrevê-lo aqui, e
testar com as linhas reais da produção, não só com dados inventados (foi o que
faltou ao aviso "H3 por atribuir", que acusou uma semana sem H3 por causa de
uma linha de escala solta que só os dados reais tinham).

## A semana do turno H3

- A escala (`escala_semanal.semana_ref`) é ao **sábado**: cada linha cobre de
  sábado a sexta. Toda a linha de escala é de um sábado; uma linha noutro dia
  da semana não é uma semana e nenhum cálculo a trata como tal.
- O turno H3 (22h00 às 07h00) **ativa-se às 22h de sexta-feira**, na véspera do
  sábado do `semana_ref`, e dura até às 22h da sexta seguinte. Até às 21h59 de
  sexta ainda é a semana anterior; a partir das 22h00 já é a do sábado seguinte.
  (Fontes: o Gerente, 2026-09-25; "BATCH SEXTA PARA SÁBADO" às 22h no
  `CheckList.xlsx`; os blocos H3 de sábado a sexta no `Escala_2026.xlsx`.)
- Código: `sabadoDaSemanaH3()` e `ativacaoH3DaSemana()` em `src/lib/datas.ts`.
- As trocas de H3 (`trocas_escala.semana_ref`) usam a mesma âncora: o sábado em
  que a semana começa. O formulário só aceita sábados e a base de dados recusa
  qualquer outro dia (migração 0061), porque a aprovação age nessa data exata:
  numa quinta não trocava semana nenhuma e deixava uma linha solta na escala. A
  troca #59 (2026-10-15, aprovada antes desta regra) fica no histórico.

Outras âncoras, que não se confundem com a da escala:

- Relatório semanal e emails: período de sexta a quinta, rotulado pela sexta
  administrativa (`proximaSextaISO`); nesse dia o H3 só arranca às 22h.
- Plano de Fim de Semana (`planos.data_inicio_ciclo`): quinta (`semanaRefDe`),
  ciclo de quinta a segunda.
- Férias e substitutos: semana civil, de segunda a sexta.

## Alarmes

Padrões definidos no levantamento de requisitos (`src/lib/alertas.ts`):
**reativo** dispara na hora de referência, com 30 min de tolerância antes de
ficar elegível para escalonamento; **preditivo** avisa 30 min antes da hora de
referência e escalona à própria hora.

| Alarme | Critério | Quem vê | Código |
| --- | --- | --- | --- |
| Próximo alerta (barra) | 20h de sábado e de domingo; 15h só no sábado de fim de semana de manutenção; 22h só no sábado (janela GIR_FL) | todos | `calcularProximoAlerta` |
| HR.LIMITE (tarefas excecionais atrasadas) | reativo: dispara na hora-limite da tarefa, se ainda não concluída. Limitação conhecida: compara só a hora, sem data, por isso um limite depois da meia-noite (por exemplo 02h00) dispara logo às 22h30 do dia anterior; hoje nenhuma tarefa tem HR.LIMITE | todos | `estaHrLimiteEstourado` |
| Checagens de 20h e de 15h (Checklist) | reativo: 20h de sábado e domingo; 15h só no sábado de manutenção | todos | `PainelAlertas` |
| GIR_FL (Checklist) | preditivo: aviso 30 min antes das 22h de sábado, escalona às 22h; só se houver cadeia dependente por concluir | todos | `avaliarRiscoGirFl` |
| Preenchimento automático anual (escala, feriados) | vermelho se a última ação for falha ou erro; âmbar se for aviso; desaparece na próxima execução com sucesso | Gerente e delegado | `avaliarSaudeAutomacaoAnual`, `avaliarAvisoAutomacaoAnual` |
| Headcount mensal | âmbar: o mês anterior por fechar, a partir do dia 5; vermelho: há um mês mais antigo por fechar | Gerente e delegado | `avaliarAlertaHeadcountMensal` |
| H3 por atribuir | semanas H3 (de sábado) que têm escala mas nenhum H3 ativo; vermelho se é a semana em curso ou o H3 dela se ativa nos próximos 7 dias, âmbar se não; linhas fora de sábado são ignoradas; decidido pelo Gerente ("tem de avisar") | Gerente e delegado | `avaliarSemanasSemH3` |

## Divergências conhecidas, por corrigir

Onde o código ainda não segue os critérios acima. Cada uma pede primeiro a
decisão do Gerente.

- Sugestão automática (`PainelSugestao` em `src/pages/EscalaPage.tsx` e função
  `sugerir-escala`): pede a "Quinta-feira de referência", o "Aplicar" grava
  linhas de `escala_semanal` com essa quinta como `semana_ref`, e a função
  procura a semana anterior nessa data menos 7 dias, onde a escala (aos
  sábados) não tem linhas. A base de dados não impede uma linha de escala fora
  de sábado.
