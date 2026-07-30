import type { EscalaSemanal, Ferias, TurnoTipo, Usuario } from '../types/database'
import { adicionarDias, formatarDataPT, paraISO } from './datas'

const HORARIO_TURNO: Record<TurnoTipo, string> = {
  H1: '07h00 às 16h00',
  H2: '14h00 às 23h00',
  H3: '22h00 às 07h00',
  H4: '09h00 às 18h00',
}

/**
 * Texto do relatório semanal de turnos, pronto a copiar/colar para
 * envio manual por email — mesma estrutura do modelo real usado hoje
 * pelo Gerente. Sempre em português europeu.
 */
export function gerarTextoRelatorioSemanal(
  semanaRef: string,
  escalas: EscalaSemanal[],
  ferias: Ferias[],
  usuarios: Usuario[]
): string {
  const inicio = new Date(semanaRef + 'T00:00:00')
  const fim = adicionarDias(inicio, 6)
  const nomeDe = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? id

  const linhas: string[] = []
  linhas.push('Boa tarde,')
  linhas.push('')
  linhas.push('Segue atualização de turnos, conforme abaixo:')
  linhas.push('')
  for (const turno of ['H1', 'H2', 'H3', 'H4'] as TurnoTipo[]) {
    linhas.push(`${turno} – ${HORARIO_TURNO[turno].toUpperCase()}`)
  }
  linhas.push('')
  linhas.push(`Segue escala e turnos referentes aos dias ${formatarDataPT(semanaRef)} a ${formatarDataPT(paraISO(adicionarDias(inicio, 6)))}.`)
  linhas.push('')
  linhas.push('Operação SAS')
  for (const turno of ['H1', 'H2', 'H3', 'H4'] as TurnoTipo[]) {
    const pessoas = escalas.filter((e) => e.turno === turno).map((e) => nomeDe(e.usuario_id))
    linhas.push(`${turno} - ${HORARIO_TURNO[turno]} – ${pessoas.length > 0 ? pessoas.join(' / ') : '—'}`)
  }
  linhas.push('')
  linhas.push('Férias/Licenças')
  const emFerias = ferias.filter((f) => f.data_inicio <= paraISO(fim) && f.data_fim >= semanaRef)
  if (emFerias.length === 0) {
    linhas.push('—')
  } else {
    for (const f of emFerias) linhas.push(nomeDe(f.usuario_id))
  }

  return linhas.join('\n')
}
