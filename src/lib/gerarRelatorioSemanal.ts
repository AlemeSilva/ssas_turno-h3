import type { EscalaSemanal, Ferias, TurnoTipo, Usuario } from '../types/database'
import { adicionarDias, agora, formatarDataPT, paraISO } from './datas'

export const HORARIO_TURNO: Record<TurnoTipo, string> = {
  H1: '07h00 às 16h00',
  H2: '14h00 às 23h00',
  H3: '22h00 às 07h00',
  H4: '09h00 às 18h00',
}

function saudacao(momentoAtual: Date): string {
  const hora = momentoAtual.getHours()
  if (hora < 12) return 'Bom dia,'
  if (hora < 19) return 'Boa tarde,'
  return 'Boa noite,'
}

/**
 * Texto do relatório semanal de turnos, pronto a copiar/colar para
 * envio manual por email — mesma estrutura do modelo real usado hoje
 * pelo Gerente. Sempre em português europeu.
 *
 * `semanaRef` é a sexta-feira de início do período (não o `semana_ref`
 * interno de `escala_semanal`, que ancora ao sábado seguinte) — quem
 * chama esta função já deve ter filtrado `escalas` para a semana certa.
 */
export function gerarTextoRelatorioSemanal(
  semanaRef: string,
  escalas: EscalaSemanal[],
  ferias: Ferias[],
  usuarios: Usuario[],
  momentoAtual: Date = agora()
): string {
  const inicio = new Date(semanaRef + 'T00:00:00')
  const fim = adicionarDias(inicio, 6)
  const nomeDe = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? id

  const emFerias = ferias.filter((f) => f.data_inicio <= paraISO(fim) && f.data_fim >= semanaRef)
  const idsEmFerias = new Set(emFerias.map((f) => f.usuario_id))

  // Mapa id -> turno efetivo (não listas por turno independentes).
  // "Operação SAS" é só a equipa operacional — o Gerente tem turno H4
  // fixo em escala_semanal (para ter uma linha na grelha do mês), mas
  // nunca aparece neste relatório, tal como no modelo real usado hoje.
  // Quem está de férias/licença esta semana também não aparece a
  // "trabalhar" nenhum turno.
  const idsGerentes = new Set(usuarios.filter((u) => u.perfil === 'GERENTE').map((u) => u.id))
  const turnoEfetivo = new Map<string, TurnoTipo>()
  for (const e of escalas) {
    if (!idsEmFerias.has(e.usuario_id) && !idsGerentes.has(e.usuario_id)) {
      turnoEfetivo.set(e.usuario_id, e.turno)
    }
  }
  // Quem está ausente mas já tem substituto escolhido (Início →
  // "Confirmar substituto", ver migração 0009) cobre o turno de quem
  // substitui — desde que o próprio substituto não esteja também
  // ausente essa semana. Sem substituto confirmado, o turno fica
  // vazio ("—"), a sinalizar decisão manual do Gerente, tal como já
  // acontecia para qualquer ausência sem cobertura definida.
  for (const f of emFerias) {
    if (!f.substituto_id || idsEmFerias.has(f.substituto_id)) continue
    const turnoDoAusente = escalas.find((e) => e.usuario_id === f.usuario_id)?.turno
    if (turnoDoAusente) {
      turnoEfetivo.set(f.substituto_id, turnoDoAusente)
    }
  }

  const linhas: string[] = []
  linhas.push(saudacao(momentoAtual))
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
    const pessoas = [...turnoEfetivo.entries()].filter(([, t]) => t === turno).map(([id]) => nomeDe(id))
    linhas.push(`${turno} - ${HORARIO_TURNO[turno]} – ${pessoas.length > 0 ? pessoas.join(' / ') : '—'}`)
  }
  linhas.push('')
  linhas.push('Férias/Licenças')
  const idsUnicosFerias = [...new Set(emFerias.map((f) => f.usuario_id))]
  if (idsUnicosFerias.length === 0) {
    linhas.push('—')
  } else {
    for (const id of idsUnicosFerias) linhas.push(nomeDe(id))
  }

  return linhas.join('\n')
}
