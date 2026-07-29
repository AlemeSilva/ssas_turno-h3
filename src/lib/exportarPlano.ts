import type { Plano, TarefaPlano } from '../types/database'
import { formatarDataPT } from './datas'

/**
 * Gera o texto do plano (Draft de Quinta ou Definitivo de Sexta) pronto
 * a copiar/colar para envio manual por email — sem qualquer envio
 * automático pela aplicação. Sempre em português europeu.
 */
export function gerarTextoPlano(plano: Plano, tarefas: TarefaPlano[], versao: 'DRAFT' | 'DEFINITIVO'): string {
  const titulo = versao === 'DRAFT' ? 'PRÉVIA (DRAFT)' : 'PLANO DEFINITIVO'
  const tipo = plano.tipo_fim_semana === 'MANUTENCAO' ? 'Fim de semana de MANUTENÇÃO de ambiente' : 'Fim de semana normal'

  const linhas: string[] = []
  linhas.push(`${titulo} — Plano de Fim de Semana`)
  linhas.push(`${tipo}`)
  linhas.push('')
  linhas.push(`Ciclo com início em ${formatarDataPT(plano.data_inicio_ciclo)}.`)
  linhas.push('')

  const porDia = new Map<string, TarefaPlano[]>()
  for (const t of tarefas) {
    const lista = porDia.get(t.data_execucao) ?? []
    lista.push(t)
    porDia.set(t.data_execucao, lista)
  }

  for (const [dia, lista] of [...porDia.entries()].sort()) {
    linhas.push(`--- ${formatarDataPT(dia)} ---`)
    for (const t of lista) {
      const limite = t.hr_limite ? ` | HR. LIMITE: ${t.hr_limite}` : ''
      linhas.push(
        `${t.hora_arranque ?? '—'} · ${t.descricao_tarefa} (${t.equipa_responsavel})${limite}`
      )
      if (t.observacao) linhas.push(`   Obs.: ${t.observacao}`)
    }
    linhas.push('')
  }

  if (plano.observacoes_gerais) {
    linhas.push('Observações gerais:')
    linhas.push(plano.observacoes_gerais)
  }

  return linhas.join('\n')
}
