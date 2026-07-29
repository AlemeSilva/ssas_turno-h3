import { adicionarDias, paraISO } from './datas'
import type { OrigemTarefa, TipoFimSemana } from '../types/database'

export interface NovaTarefa {
  data_execucao: string
  descricao_tarefa: string
  equipa_responsavel: string
  hora_arranque: string
  dt_previsao: string
  hr_previsao_termino: string
  origem: OrigemTarefa
  observacao?: string
}

/**
 * Tarefas fixas e recorrentes do ciclo H3, a pré-popular ao criar um
 * novo plano — reflete a estrutura observada em Plano_Fim_Semana.xlsx.
 * O operador escalado pode sempre editar horários/observações e
 * acrescentar tarefas excecionais depois.
 */
export function gerarTarefasTemplate(dataInicioCiclo: string, tipo: TipoFimSemana): NovaTarefa[] {
  const quinta = new Date(dataInicioCiclo + 'T00:00:00')
  const sexta = paraISO(adicionarDias(quinta, 1))
  const sabado = paraISO(adicionarDias(quinta, 2))
  const domingo = paraISO(adicionarDias(quinta, 3))
  const segunda = paraISO(adicionarDias(quinta, 4))

  const tarefas: NovaTarefa[] = [
    {
      data_execucao: sexta,
      descricao_tarefa: 'Preparação para o final de semana',
      equipa_responsavel: 'DEOS - Operações',
      hora_arranque: '19:00',
      dt_previsao: sexta,
      hr_previsao_termino: '21:00',
      origem: 'TEMPLATE',
      observacao: 'Refresh aos Spawners e ciclo de atividades de preparação do batch de fim de semana.',
    },
    {
      data_execucao: sexta,
      descricao_tarefa: 'Refresh aos Spawners',
      equipa_responsavel: 'DEOS - Operações',
      hora_arranque: '21:00',
      dt_previsao: sexta,
      hr_previsao_termino: '22:00',
      origem: 'TEMPLATE',
    },
    {
      data_execucao: sexta,
      descricao_tarefa: 'Arranque Cadeia - AUTOMÁTICA',
      equipa_responsavel: 'DEOS - Operações',
      hora_arranque: '23:00',
      dt_previsao: sabado,
      hr_previsao_termino: '14:00',
      origem: 'TEMPLATE',
    },
    {
      data_execucao: sabado,
      descricao_tarefa: 'Arranque Cadeia - AUTOMÁTICA',
      equipa_responsavel: 'DEOS - Operações',
      hora_arranque: '23:00',
      dt_previsao: domingo,
      hr_previsao_termino: '14:00',
      origem: 'TEMPLATE',
    },
    {
      data_execucao: domingo,
      descricao_tarefa: 'Arranque Cadeia - AUTOMÁTICA',
      equipa_responsavel: 'DEOS - Operações',
      hora_arranque: '23:00',
      dt_previsao: segunda,
      hr_previsao_termino: '14:00',
      origem: 'TEMPLATE',
    },
  ]

  if (tipo === 'MANUTENCAO') {
    tarefas.push({
      data_execucao: sabado,
      descricao_tarefa: 'Restart Higiénico SAS + GP — OnPremise (PRD + PRE + DSV) + Cloud (SAS AML)',
      equipa_responsavel: 'DEOS - Sistemas',
      hora_arranque: '15:00',
      dt_previsao: sabado,
      hr_previsao_termino: '18:00',
      origem: 'MANUTENCAO',
      observacao: 'Renovação das licenças do ambiente SAS.',
    })
  }

  return tarefas
}

export const SECOES_CHECKLIST: { id: string; titulo: string }[] = [
  { id: 'PREPARACAO', titulo: 'Preparação' },
  { id: 'REUNIAO', titulo: 'Reunião de Planeamento' },
  { id: 'BATCH_SEX_SAB', titulo: 'Batch Sexta → Sábado' },
  { id: 'BATCH_SAB_DOM', titulo: 'Batch Sábado → Domingo' },
  { id: 'BATCH_DOM_SEG', titulo: 'Batch Domingo → Segunda' },
]
