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

## Os turnos e a Sugestão automática

As regras de cada turno são as do preenchimento automático anual da escala
(`preencher_escala_anual()`, migração 0050), que é o que está em prática. A
"Sugestão automática" da Escala do Mês (`PainelSugestao`, função `sugerir-escala`,
lógica em `supabase/functions/sugerir-escala/algoritmo.ts`) tem de seguir as
mesmas, e só propõe (o "Aplicar" é um ato do Gerente ou do delegado):

- **H3**: rotação entre os OPERADOR_H3 ativos. Menos H3 nos últimos 3 meses,
  depois menos no ano, depois o id. Respeita `limite_h3_mensal`; se ninguém couber
  no limite, propõe na mesma, marcado "override". A sugestão evita quem tem férias
  (aprovadas ou pendentes) a sobrepor a semana.
- **H2**: rotação entre os OPERADOR_H3 ativos com `elegivel_h2`, sem o H3 da
  semana; as mesmas contagens, de H2.
- **H4**: os OPERADOR_H3 que nessa semana não são H3 nem H2, os OPERADOR com
  `turno_fixo` H4 e o Gerente ativo mais antigo.
- **H1**: os OPERADOR com `turno_fixo` H1.
- **Limite mensal**: a semana conta no mês onde cai a maioria dos 7 dias, o do 4.º
  dia (`semana_ref + 3`); a de 31/10 a 06/11/2026 é de novembro (migração 0050). O
  trigger conta todas as semanas H3 desse mês, e a sugestão também.
- Só entra quem está ativo, e a semana é sempre a do sábado: a função recusa outro dia.
- Verificado em 2026-09-26 contra o preenchimento anual real (numa transação
  revertida): as 52 semanas de 2027 saíram iguais às da sugestão.

## Alarmes

Padrões definidos no levantamento de requisitos (`src/lib/alertas.ts`):
**reativo** dispara na hora de referência, com 30 min de tolerância antes de
ficar elegível para escalonamento; **preditivo** avisa 30 min antes da hora de
referência e escalona à própria hora.

| Alarme | Critério | Quem vê | Código |
| --- | --- | --- | --- |
| Próximo alerta (barra) | 20h de sábado e de domingo; 15h só no sábado de fim de semana de manutenção; 22h só no sábado (janela GIR_FL) | todos | `calcularProximoAlerta` |
| HR.LIMITE (tarefas atrasadas) | reativo: dispara no momento-limite da tarefa, se ainda não concluída, e continua enquanto não for concluída. O momento é o dia previsto de fim (`dt_previsao`) ou, se estiver vazio, o dia marcado (`data_execucao`), mais a hora-limite. Um limite depois da meia-noite pede o dia seguinte em `dt_previsao`. Decidido pelo Gerente em 2026-09-26; hoje nenhuma tarefa tem HR.LIMITE | todos | `estaHrLimiteEstourado` |
| Checagens de 20h e de 15h (Checklist) | reativo: 20h de sábado e domingo; 15h só no sábado de manutenção | todos | `PainelAlertas` |
| GIR_FL (Checklist) | preditivo: aviso 30 min antes das 22h de sábado, escalona às 22h; só se houver cadeia dependente por concluir | todos | `avaliarRiscoGirFl` |
| Preenchimento automático anual (escala, feriados) | vermelho se a última ação for falha ou erro; âmbar se for aviso; desaparece na próxima execução com sucesso | Gerente e delegado | `avaliarSaudeAutomacaoAnual`, `avaliarAvisoAutomacaoAnual` |
| Headcount mensal | âmbar: o mês anterior por fechar, a partir do dia 5; vermelho: há um mês mais antigo por fechar | Gerente e delegado | `avaliarAlertaHeadcountMensal` |
| H3 por atribuir | semanas H3 (de sábado) que têm escala mas nenhum H3 ativo; vermelho se é a semana em curso ou o H3 dela se ativa nos próximos 7 dias, âmbar se não; linhas fora de sábado são ignoradas; decidido pelo Gerente ("tem de avisar") | Gerente e delegado | `avaliarSemanasSemH3` |

## Divergências conhecidas, por corrigir

Onde o código ainda não segue os critérios acima. Cada uma pede primeiro a
decisão do Gerente.

- A base de dados não impede uma linha de `escala_semanal` fora de sábado: só o
  ecrã, a Sugestão automática e as trocas o impedem.
