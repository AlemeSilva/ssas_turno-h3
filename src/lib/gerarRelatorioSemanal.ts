import type { AusenciaComSemanas, EscalaSemanal, TurnoTipo, Usuario } from '../types/database'
import { adicionarDias, agora, diasSobrepostos, formatarDataPT, paraISO, segundaDaSemanaDe } from './datas'

// O período reportado é sempre Sexta a Quinta seguinte — 7 dias.
const DIAS_NO_PERIODO = 7

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
  ferias: AusenciaComSemanas[],
  usuarios: Usuario[],
  momentoAtual: Date = agora()
): string {
  const inicio = new Date(semanaRef + 'T00:00:00')
  const fim = adicionarDias(inicio, 6)
  const nomeDe = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? id

  // O relatório é rotulado Sexta a Quinta, mas o substituto agora é
  // decidido por semana civil (Segunda a Sexta, ver migração 0025) —
  // as duas semanas não se alinham. A civil que mais se sobrepõe ao
  // período reportado é a que começa na Segunda logo a seguir a
  // semanaRef (4 dos seus 5 dias úteis ficam dentro do período); é
  // essa que se usa para decidir quem substitui quem esta semana.
  const semanaCivilDominante = paraISO(segundaDaSemanaDe(adicionarDias(inicio, 3)))

  // O dia rotulado como início da semana (semanaRef) é ainda um dia de
  // transição do ciclo anterior — o H3 só arranca às 22h desse dia.
  // Uma férias que termine exatamente nesse dia já não afeta a semana
  // nova (por isso data_fim > semanaRef, não >=): testado com o caso
  // real do Sérgio, cuja férias terminava na sexta que rotula a semana
  // seguinte e continuava a "roubar-lhe" o turno indevidamente.
  //
  // Só conta como "férias" para este relatório quando cobre 50% ou
  // mais dos 7 dias do período — decisão do Gerente de 2026-08-13.
  // Uma ausência de 1 ou 2 dias não justifica tirar a pessoa da sua
  // linha de turno nem listá-la em Férias/Licenças: caso real que
  // motivou isto — Bruno ausente 1 dia e Caique a iniciar férias no
  // último dia do período, nenhum dos dois devia aparecer.
  const fimISO = paraISO(fim)
  const emFerias = ferias.filter((f) => {
    if (!(f.data_inicio <= fimISO && f.data_fim > semanaRef)) return false
    return diasSobrepostos(f.data_inicio, f.data_fim, semanaRef, fimISO) / DIAS_NO_PERIODO >= 0.5
  })
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
  // Quem está ausente mas já tem substituto escolhido para a semana
  // civil dominante (Início → "Confirmar substituto", ver migração
  // 0025) cobre o turno de quem substitui — desde que o próprio
  // substituto não esteja também ausente essa semana. Sem substituto
  // confirmado (ou decisão "Nenhum"), o turno fica vazio ("—"), a
  // sinalizar decisão manual do Gerente, tal como já acontecia para
  // qualquer ausência sem cobertura definida.
  for (const f of emFerias) {
    const substitutoId = f.ferias_semanas.find((fs) => fs.semana_inicio === semanaCivilDominante)?.substituto_id
    if (!substitutoId || idsEmFerias.has(substitutoId)) continue
    const turnoDoAusente = escalas.find((e) => e.usuario_id === f.usuario_id)?.turno
    if (turnoDoAusente) {
      turnoEfetivo.set(substitutoId, turnoDoAusente)
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
  linhas.push(`Segue escala e turnos referentes aos dias ${formatarDataPT(semanaRef)} a ${formatarDataPT(fimISO)}.`)
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
