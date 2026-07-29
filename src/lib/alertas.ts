// Lógica pura dos alertas — sem DOM, sem Supabase, 100% testável.
// Dois padrões de alerta, deliberadamente diferentes (fechado no
// levantamento de requisitos):
//  - REATIVO (HR.LIMITE, checagens 20h/15h): o alerta dispara NA hora
//    de referência; há 30 min de tolerância antes de ficar elegível
//    para escalonamento.
//  - PREDITIVO (GIR_FL): o aviso dispara 30 min ANTES da hora de
//    referência (para dar tempo de agir), escalona-se à própria hora.

export type EstadoAlerta = 'FUTURO' | 'ALERTA' | 'ESCALONAR'

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function diferencaMinutos(a: string, b: string): number {
  return paraMinutos(b) - paraMinutos(a)
}

export function avaliarAlertaReativo(horaReferenciaHHMM: string, agoraHHMM: string, toleranciaMin = 30): EstadoAlerta {
  const diff = diferencaMinutos(horaReferenciaHHMM, agoraHHMM) // agora - referência
  if (diff < 0) return 'FUTURO'
  if (diff < toleranciaMin) return 'ALERTA'
  return 'ESCALONAR'
}

export function avaliarAlertaPreditivo(horaReferenciaHHMM: string, agoraHHMM: string, antecedenciaMin = 30): EstadoAlerta {
  const diff = diferencaMinutos(horaReferenciaHHMM, agoraHHMM) // agora - referência (negativo = antes)
  if (diff < -antecedenciaMin) return 'FUTURO'
  if (diff < 0) return 'ALERTA'
  return 'ESCALONAR'
}

export function estaHrLimiteEstourado(horaLimite: string | null, statusTarefa: string, agoraHHMM: string): boolean {
  if (!horaLimite || statusTarefa === 'CONCLUIDO') return false
  return agoraHHMM >= horaLimite
}

/** diaSemanaIso: 1=Segunda … 7=Domingo (ISO 8601). */
export function isoWeekdayDe(d: Date): number {
  const dia = d.getDay()
  return dia === 0 ? 7 : dia
}

export interface RiscoGirFl {
  aplicavel: boolean
  estado: EstadoAlerta
}

/**
 * O alerta do GIR_FL só existe na secção Sábado→Domingo, e só importa
 * se alguma das cadeias dependentes ainda não estiver concluída.
 */
export function avaliarRiscoGirFl(diaSemanaIso: number, agoraHHMM: string, statusDependencias: string[]): RiscoGirFl {
  const algumaPendente = statusDependencias.some((s) => !s.startsWith('CONCLUIDO'))
  if (diaSemanaIso !== 6 || !algumaPendente) {
    return { aplicavel: false, estado: 'FUTURO' }
  }
  return { aplicavel: true, estado: avaliarAlertaPreditivo('22:00', agoraHHMM, 30) }
}

export interface ProximoAlerta {
  rotulo: string
  horario: string
  minutosRestantes: number
}

/**
 * Próximo alerta fixo do ciclo H3 a mostrar na barra superior:
 * 20h (Sáb/Dom, sempre), 15h (só Sáb de manutenção), 22h (só Sáb,
 * janela GIR_FL). A checagem de manutenção é a peça que faltava no
 * protótipo inicial — sem ela, o alerta das 15h disparava em todos os
 * sábados, não só nos de manutenção.
 */
export function calcularProximoAlerta(agora: Date, ehFimDeSemanaManutencao: boolean): ProximoAlerta | null {
  const diaSemanaIso = isoWeekdayDe(agora)
  const agoraHHMM = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`

  const candidatos: ProximoAlerta[] = []
  const ehSabado = diaSemanaIso === 6
  const ehDomingo = diaSemanaIso === 7

  function minutosAte(horaHHMM: string): number {
    return diferencaMinutos(agoraHHMM, horaHHMM)
  }

  if ((ehSabado || ehDomingo) && minutosAte('20:00') > 0) {
    candidatos.push({ rotulo: 'Checagem das 20h', horario: '20:00', minutosRestantes: minutosAte('20:00') })
  }
  if (ehSabado && ehFimDeSemanaManutencao && minutosAte('15:00') > 0) {
    candidatos.push({ rotulo: 'Checagem das 15h (manutenção)', horario: '15:00', minutosRestantes: minutosAte('15:00') })
  }
  if (ehSabado && minutosAte('22:00') > 0) {
    candidatos.push({ rotulo: 'Janela GIR_FL (22h)', horario: '22:00', minutosRestantes: minutosAte('22:00') })
  }

  if (candidatos.length === 0) return null
  return candidatos.sort((a, b) => a.minutosRestantes - b.minutosRestantes)[0]
}
