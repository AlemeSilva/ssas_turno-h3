import { describe, expect, it } from 'vitest'
import { gerarTarefasTemplate } from '../../src/lib/templateTarefas'
import { gerarChecklistTemplate } from '../../src/lib/templateChecklist'

// Ciclo de referência: 2026-07-30 é uma Quinta-feira; o Sábado (01/08)
// é o último Sábado de julho — logo, ciclo de manutenção.
const QUINTA = '2026-07-30'

describe('gerarTarefasTemplate — tarefas fixas e recorrentes', () => {
  it('gera as 5 tarefas fixas num fim de semana NORMAL, sem a de manutenção', () => {
    const tarefas = gerarTarefasTemplate(QUINTA, 'NORMAL')
    expect(tarefas).toHaveLength(5)
    expect(tarefas.some((t) => t.origem === 'MANUTENCAO')).toBe(false)
  })

  it('acrescenta a tarefa de manutenção só quando tipo=MANUTENCAO, sem remover as fixas', () => {
    const tarefas = gerarTarefasTemplate(QUINTA, 'MANUTENCAO')
    expect(tarefas).toHaveLength(6)
    const manutencao = tarefas.find((t) => t.origem === 'MANUTENCAO')
    expect(manutencao?.equipa_responsavel).toBe('DEOS - Sistemas')
    expect(manutencao?.data_execucao).toBe('2026-08-01') // Sábado do ciclo
  })

  it('a cadeia "Arranque Cadeia - AUTOMÁTICA" de sexta prevê terminar no sábado às 14h', () => {
    const tarefas = gerarTarefasTemplate(QUINTA, 'NORMAL')
    const arranqueSexta = tarefas.find((t) => t.data_execucao === '2026-07-31' && t.descricao_tarefa.includes('AUTOMÁTICA'))
    expect(arranqueSexta?.dt_previsao).toBe('2026-08-01')
    expect(arranqueSexta?.hr_previsao_termino).toBe('14:00')
  })

  it('todas as tarefas do template têm origem TEMPLATE (nunca EXCECIONAL)', () => {
    const tarefas = gerarTarefasTemplate(QUINTA, 'NORMAL')
    expect(tarefas.every((t) => t.origem === 'TEMPLATE')).toBe(true)
  })
})

describe('gerarChecklistTemplate — itens fixos por secção', () => {
  it('num fim de semana normal não inclui a linha de manutenção mensal', () => {
    const itens = gerarChecklistTemplate('NORMAL')
    expect(itens.some((i) => i.item_descricao.toLowerCase().includes('manutenção mensal'))).toBe(false)
  })

  it('num fim de semana de manutenção, a linha aparece especificamente na secção BATCH_SAB_DOM', () => {
    const itens = gerarChecklistTemplate('MANUTENCAO')
    const linha = itens.find((i) => i.item_descricao.toLowerCase().includes('manutenção mensal'))
    expect(linha).toBeDefined()
    expect(linha?.secao).toBe('BATCH_SAB_DOM')
  })

  it('cobre as 5 secções esperadas com pelo menos um item cada', () => {
    const itens = gerarChecklistTemplate('NORMAL')
    const secoes = new Set(itens.map((i) => i.secao))
    expect(secoes).toEqual(new Set(['PREPARACAO', 'REUNIAO', 'BATCH_SEX_SAB', 'BATCH_SAB_DOM', 'BATCH_DOM_SEG']))
  })
})
