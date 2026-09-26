// Lógica pura dos alertas — sem DOM, sem Supabase, 100% testável.
import { ativacaoH3DaSemana, ehSabadoISO, paraISO, sabadoDaSemanaH3 } from './datas'

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

export interface TarefaComHrLimite {
  hr_limite: string | null
  /** DT. PREVISÃO: dia previsto de fim. */
  dt_previsao: string | null
  /** Dia marcado; conta quando não há dia previsto. */
  data_execucao: string
  status: string
}

/**
 * Momento (hora local) em que se esgota a HR. LIMITE de uma tarefa: o dia
 * previsto de fim (dt_previsao) ou, se estiver vazio, o dia marcado
 * (data_execucao), às hr_limite. Uma hora-limite depois da meia-noite pede o
 * dia seguinte em dt_previsao. `null` sem HR. LIMITE ou com valores inválidos.
 */
function momentoHrLimite(t: Pick<TarefaComHrLimite, 'hr_limite' | 'dt_previsao' | 'data_execucao'>): Date | null {
  const hora = /^(\d{2}):(\d{2})/.exec(t.hr_limite ?? '')
  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(t.dt_previsao || t.data_execucao)
  if (!hora || !dia) return null
  return new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3]), Number(hora[1]), Number(hora[2]))
}

/** Reativo: a tarefa não concluída passou o momento da sua HR. LIMITE (dia e hora). */
export function estaHrLimiteEstourado(tarefa: TarefaComHrLimite, momento: Date): boolean {
  if (tarefa.status === 'CONCLUIDO') return false
  const limite = momentoHrLimite(tarefa)
  return limite !== null && momento.getTime() >= limite.getTime()
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

/**
 * O preenchimento automático anual de escala/feriados (cron 1 Nov)
 * corre sozinho, sem ninguém a ver — se falhar, só fica registado em
 * logs_auditoria, sem alerta nenhum (achado real, 2026-08-27).
 * Decide se há algo por resolver olhando só para a ação mais recente
 * desse tipo: uma falha ou erro ainda não foi seguida de um sucesso.
 * Deliberadamente sem filtrar por ano — assim que alguém corrigir a
 * causa e voltar a correr com sucesso, o aviso desaparece sozinho.
 */
export function avaliarSaudeAutomacaoAnual(ultimaAcao: string | null): boolean {
  return ultimaAcao === 'PREENCHIMENTO_AUTOMATICO_FALHOU' || ultimaAcao === 'PREENCHIMENTO_AUTOMATICO_ERRO'
}

/**
 * Distinto de avaliarSaudeAutomacaoAnual: um turno com o pool de
 * candidatos vazio (ex.: ninguém com turno_fixo=H1) é um estado
 * válido, não uma falha — a escala é gerada na mesma, só "vale a pena
 * confirmar" (âmbar), não "algo partiu" (vermelho).
 */
export function avaliarAvisoAutomacaoAnual(ultimaAcao: string | null): boolean {
  return ultimaAcao === 'PREENCHIMENTO_AUTOMATICO_AVISO'
}

export interface AlertaHeadcountMensal {
  avisoAmbar: boolean
  avisoVermelho: boolean
  mesesPendentes: string[]
}

/**
 * O volume de pedidos de um mês só é conhecido depois de ele acabar —
 * por isso o Gerente tem até ao dia 5 do mês seguinte para preencher e
 * fechar o mês anterior. mesesAbertos: mes_referencia (YYYY-MM-DD, 1º
 * dia do mês) de cada mês de headcount ainda não fechado — nunca inclui
 * o mês atual (esse não chega a existir como rascunho antes de acabar).
 * Âmbar = só o mês anterior está pendente, a partir do dia 5. Vermelho
 * = há algum mês mais antigo que isso ainda por fechar.
 */
export function avaliarAlertaHeadcountMensal(mesesAbertos: string[], hoje: Date): AlertaHeadcountMensal {
  const mesAtualISO = paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const mesAnteriorISO = paraISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))

  const pendentes = mesesAbertos.filter((m) => m < mesAtualISO).sort()

  return {
    avisoAmbar: hoje.getDate() >= 5 && pendentes.includes(mesAnteriorISO),
    avisoVermelho: pendentes.some((m) => m < mesAnteriorISO),
    mesesPendentes: pendentes,
  }
}

export interface AlertaSemanasSemH3 {
  /** semana_ref (Sábado) de cada semana com escala mas sem nenhum H3 ativo, da mais próxima para a mais distante. */
  semanas: string[]
  /** Alguma é a semana em curso ou o H3 dela se ativa (22h de sexta-feira) nos próximos 7 dias. */
  urgente: boolean
}

/**
 * Semanas da escala, a partir da semana em curso, que ficaram sem H3.
 * Acontece quando um operador H3 sai: desativar apaga-lhe a escala de
 * hoje em diante (migração 0057), e a semana em curso mantém a linha
 * dele, que já não conta. Só olha para semanas que existem na escala
 * (têm linha de alguém) — semanas para lá do que já foi preenchido não
 * são "sem H3", ainda não foram geradas.
 *
 * O turno H3 é semanal: a semana tem semana_ref no SÁBADO e ativa-se às
 * 22h de sexta-feira, na véspera (o H3 trabalha 22h00 às 07h00), até às 22h
 * da sexta seguinte. Uma linha de escala noutro dia da semana não é uma
 * semana: aconteceu com uma troca aprovada com a data de uma quinta-feira
 * (a base de dados já a recusa, migração 0061), que deixava na escala uma
 * linha solta nesse dia. Essas linhas são ignoradas — nem inventam uma
 * semana "sem H3" (foi o erro da primeira versão: acusou 15/10 a 21/10 quando
 * as semanas de sábado 10/10 e 17/10 tinham H3), nem cobrem uma semana que
 * não tem.
 *
 * `escalas` = linhas de escala_semanal; `idsH3Ativos` = utilizadores
 * OPERADOR_H3 ativos (só esses podem cumprir o turno H3); `momento` = agora,
 * com hora. A semana em curso é a do último sábado, exceto a partir das 22h
 * de sexta-feira, em que já é a do sábado seguinte (ver sabadoDaSemanaH3).
 */
export function avaliarSemanasSemH3(
  escalas: { semana_ref: string; usuario_id: string; turno: string }[],
  idsH3Ativos: ReadonlySet<string>,
  momento: Date
): AlertaSemanasSemH3 {
  const inicioJanela = paraISO(sabadoDaSemanaH3(momento))
  const limiteUrgente = momento.getTime() + 7 * 24 * 60 * 60 * 1000

  const comEscala = new Set<string>()
  const comH3 = new Set<string>()
  for (const e of escalas) {
    if (!ehSabadoISO(e.semana_ref)) continue
    if (e.semana_ref < inicioJanela) continue
    comEscala.add(e.semana_ref)
    if (e.turno === 'H3' && idsH3Ativos.has(e.usuario_id)) comH3.add(e.semana_ref)
  }

  const semanas = [...comEscala].filter((s) => !comH3.has(s)).sort()
  return { semanas, urgente: semanas.some((s) => ativacaoH3DaSemana(s).getTime() <= limiteUrgente) }
}
