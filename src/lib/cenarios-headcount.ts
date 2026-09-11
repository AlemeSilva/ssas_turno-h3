// Motor de cálculo do "Estudo de Cenários" — puro, sem Supabase, nunca
// grava nada. Deriva tudo dos meses já fechados (mesesJanela, os mesmos
// lidos por calcularHeadcountIdeal) e de ajustes hipotéticos em memória.
//
// Princípio central: no ponto zero (nenhum ajuste tocado),
// calcularCenario tem de devolver EXATAMENTE o mesmo idealExato que
// calcularHeadcountIdeal(mesesJanela) — senão os dois números divergem
// na página e a ferramenta perde credibilidade. Isto NÃO se consegue
// reconstruindo carga_horas a partir da soma de 8 termos recalculados
// (SQL numeric vs. JS number, e "soma das médias" não é bit-a-bit igual
// a "média das somas" em ponto flutuante — mesma armadilha documentada
// em tests/camada2-regras/headcount.test.ts:56 via toBeCloseTo). Por
// isso o desenho aqui é "baseline sólido + delta por cima": a carga
// parte sempre de cargaBaseline = mean(carga_horas), lida tal e qual, e
// só os termos efetivamente TOCADOS (fora de tolerância do seu próprio
// valor histórico) entram como delta — um termo intocado contribui
// exatamente zero por EXCLUSÃO da soma, não por coincidência numérica.

// Import relativo (não '@/lib/headcount'): o alias '@' só está
// configurado em vite.config.ts, não em vitest.config.ts — um import de
// VALOR (não só de tipo) por esse alias falha a resolver em teste,
// ainda que funcione no build da app. O resto do projeto só usa '@/...'
// para tipos (apagados em tempo de compilação, nunca resolvidos em
// runtime), por isso nunca tinha topado com isto até agora.
import { aplicarMinimoEstrutural, avaliarRiscoEscalaH3, calcularHeadcountIdeal, classificarHeadcount, type ClassificacaoHeadcount } from './headcount'
import type { HeadcountMensal, HeadcountParametros } from '@/types/database'

function media(valores: number[]): number {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length
}

/** Tolerância de comparação contra o baseline — usada tanto para decidir
 * se um termo entra no cálculo como para o dirty-check da UI. Evita
 * falsos positivos por ruído de ponto flutuante quando um slider é
 * devolvido manualmente à posição original (0.1+0.2 !== 0.3 e afins). */
export const TOLERANCIA_BASELINE = 1e-5

export function tocado(valorAtual: number, baseline: number): boolean {
  return Math.abs(valorAtual - baseline) > TOLERANCIA_BASELINE
}

/**
 * Dias corridos do mês de `mesReferencia` ("AAAA-MM-DD", sempre dia 1 —
 * chk_headcount_mensal_primeiro_dia). `mesNum` é o número do mês de 1 a
 * 12, extraído diretamente — NÃO se subtrai 1. O construtor Date é
 * 0-indexado, por isso passar-lhe mesNum (1-12) aponta um mês à frente,
 * e o dia 0 recua exatamente um dia, caindo no último dia do mês
 * pretendido: funciona precisamente porque mesNum não é ajustado. É a
 * mesma técnica já usada em mesJaTerminou (HeadcountPage.tsx), só que lá
 * para o 1º dia do mês seguinte — aqui para o último dia deste. Quem
 * "corrigir" subtraindo 1 (a convenção habitual de Date) obtém
 * silenciosamente o mês ANTERIOR, sem erro nem exceção.
 */
export function diasNoMes(mesReferencia: string): number {
  const [ano, mesNum] = mesReferencia.split('-').map(Number)
  return new Date(ano, mesNum, 0).getDate()
}

interface TermosMes {
  diasCorridos: number
  semanas: number
  batchHorasDia: number
  olhoVivoMinutosDia: number
  prepFimSemanaHorasSemana: number
  imparidadeCalendarioHoras: number
  imparidadeExecucaoHorasSemana: number
  imparidadeReportesMinutosDia: number
  imparidadeReportesDiasMes: number
  volumePedidos: number
  tempoMedioPedidoMinutos: number
  diasRecuperacaoCadeia: number
  termoBatch: number
  termoOlhoVivo: number
  termoPrep: number
  termoImpCalendario: number
  termoImpExecucao: number
  termoReportes: number
  termoPedidos: number
  termoRecuperacao: number
}

// Espelha literalmente a fórmula de v_carga em calcular_headcount
// (migração 0039) — cada termo calculado com os valores congelados
// desse mês específico, para depois entrar numa média termo-a-termo
// (nunca "média dos parâmetros × média do calendário").
function termosDoMes(m: HeadcountMensal): TermosMes {
  const diasCorridos = diasNoMes(m.mes_referencia)
  const semanas = diasCorridos / 7
  const batchHorasDia = m.batch_horas_dia ?? 0
  const olhoVivoMinutosDia = m.olho_vivo_minutos_dia ?? 0
  const prepFimSemanaHorasSemana = m.prep_fim_semana_horas_semana ?? 0
  const imparidadeCalendarioHoras = m.imparidade_calendario_horas ?? 0
  const imparidadeExecucaoHorasSemana = m.imparidade_execucao_horas_semana ?? 0
  const imparidadeReportesMinutosDia = m.imparidade_reportes_minutos_dia ?? 0
  const imparidadeReportesDiasMes = m.imparidade_reportes_dias_mes ?? 0
  const volumePedidos = m.volume_pedidos ?? 0
  const tempoMedioPedidoMinutos = m.tempo_medio_pedido_minutos ?? 0
  const diasRecuperacaoCadeia = m.dias_recuperacao_cadeia
  return {
    diasCorridos,
    semanas,
    batchHorasDia,
    olhoVivoMinutosDia,
    prepFimSemanaHorasSemana,
    imparidadeCalendarioHoras,
    imparidadeExecucaoHorasSemana,
    imparidadeReportesMinutosDia,
    imparidadeReportesDiasMes,
    volumePedidos,
    tempoMedioPedidoMinutos,
    diasRecuperacaoCadeia,
    termoBatch: batchHorasDia * diasCorridos,
    termoOlhoVivo: (olhoVivoMinutosDia / 60) * diasCorridos,
    termoPrep: prepFimSemanaHorasSemana * semanas,
    termoImpCalendario: imparidadeCalendarioHoras,
    termoImpExecucao: imparidadeExecucaoHorasSemana * semanas,
    termoReportes: (imparidadeReportesMinutosDia / 60) * imparidadeReportesDiasMes,
    termoPedidos: (tempoMedioPedidoMinutos / 60) * volumePedidos,
    termoRecuperacao: diasRecuperacaoCadeia * 24,
  }
}

export interface BaselinesCenario {
  mediaDiasCorridos: number
  mediaSemanas: number
  batchHorasDia: number
  olhoVivoMinutosDia: number
  prepFimSemanaHorasSemana: number
  imparidadeCalendarioHoras: number
  imparidadeExecucaoHorasSemana: number
  imparidadeReportesMinutosDia: number
  imparidadeReportesDiasMes: number
  volumePedidos: number
  tempoMedioPedidoMinutos: number
  diasRecuperacaoCadeia: number
  termoBatch: number
  termoOlhoVivo: number
  termoPrep: number
  termoImpCalendario: number
  termoImpExecucao: number
  termoReportes: number
  termoPedidos: number
  termoRecuperacao: number
}

/**
 * Um valor de baseline por termo/parâmetro — usado só para decidir o
 * tipo de slider (0 → absoluto) e para calcular deltas; nunca para
 * reconstruir a carga total (essa vem sempre de mean(carga_horas)
 * diretamente, ver calcularCenario). Assume mesesJanela não vazio — os
 * dois pontos de entrada (calcularCenario e a inicialização do diálogo)
 * já garantem isso via o mesmo guard de calcularHeadcountIdeal.
 */
export function construirBaselinesTermos(mesesJanela: HeadcountMensal[]): BaselinesCenario {
  const termos = mesesJanela.map(termosDoMes)
  const col = <K extends keyof TermosMes>(chave: K): number[] => termos.map((t) => t[chave])
  return {
    mediaDiasCorridos: media(col('diasCorridos')),
    mediaSemanas: media(col('semanas')),
    batchHorasDia: media(col('batchHorasDia')),
    olhoVivoMinutosDia: media(col('olhoVivoMinutosDia')),
    prepFimSemanaHorasSemana: media(col('prepFimSemanaHorasSemana')),
    imparidadeCalendarioHoras: media(col('imparidadeCalendarioHoras')),
    imparidadeExecucaoHorasSemana: media(col('imparidadeExecucaoHorasSemana')),
    imparidadeReportesMinutosDia: media(col('imparidadeReportesMinutosDia')),
    imparidadeReportesDiasMes: media(col('imparidadeReportesDiasMes')),
    volumePedidos: media(col('volumePedidos')),
    tempoMedioPedidoMinutos: media(col('tempoMedioPedidoMinutos')),
    diasRecuperacaoCadeia: media(col('diasRecuperacaoCadeia')),
    termoBatch: media(col('termoBatch')),
    termoOlhoVivo: media(col('termoOlhoVivo')),
    termoPrep: media(col('termoPrep')),
    termoImpCalendario: media(col('termoImpCalendario')),
    termoImpExecucao: media(col('termoImpExecucao')),
    termoReportes: media(col('termoReportes')),
    termoPedidos: media(col('termoPedidos')),
    termoRecuperacao: media(col('termoRecuperacao')),
  }
}

/** As 9 grandezas ajustáveis (7 de carga/tarefas + volume + recuperação
 * de cadeia) guardam sempre o valor ABSOLUTO atual, na unidade natural
 * do termo — a tradução percentual (-100% a +200%) é só de apresentação,
 * feita no diálogo. Os dois contadores de headcount são independentes e
 * somados dão o total usado no cálculo. */
export interface AjustesCenario {
  batchHorasDia: number
  olhoVivoMinutosDia: number
  prepFimSemanaHorasSemana: number
  imparidadeCalendarioHoras: number
  imparidadeExecucaoHorasSemana: number
  imparidadeReportesMinutosDia: number
  imparidadeReportesDiasMes: number
  volumePedidos: number
  diasRecuperacaoCadeia: number
  operadores: number
  operadoresH3: number
}

/** Estado inicial do simulador: cada ajuste começa exatamente no seu
 * próprio baseline (mesma variável, não uma reconstrução) — por isso
 * `tocado(valor, baseline)` é falso para todos no arranque, sem
 * depender de nenhum flag extra. */
export function estadoInicial(baselines: BaselinesCenario, operadoresHoje: number, operadoresH3Hoje: number): AjustesCenario {
  return {
    batchHorasDia: baselines.batchHorasDia,
    olhoVivoMinutosDia: baselines.olhoVivoMinutosDia,
    prepFimSemanaHorasSemana: baselines.prepFimSemanaHorasSemana,
    imparidadeCalendarioHoras: baselines.imparidadeCalendarioHoras,
    imparidadeExecucaoHorasSemana: baselines.imparidadeExecucaoHorasSemana,
    imparidadeReportesMinutosDia: baselines.imparidadeReportesMinutosDia,
    imparidadeReportesDiasMes: baselines.imparidadeReportesDiasMes,
    volumePedidos: baselines.volumePedidos,
    diasRecuperacaoCadeia: baselines.diasRecuperacaoCadeia,
    operadores: operadoresHoje,
    operadoresH3: operadoresH3Hoje,
  }
}

export interface ResultadoCenario {
  idealExato: number | null
  classificacao: ClassificacaoHeadcount | null
  cargaHoras: number
  capacidadePlenaEquipaHoras: number
  capacidadeRealHojeHoras: number
  maxY: number
  riscoH3: boolean
  headcountSimuladoTotal: number
}

function resultadoSemBaseline(headcountSimuladoTotal: number, operadoresH3: number): ResultadoCenario {
  return {
    idealExato: null,
    classificacao: null,
    cargaHoras: 0,
    capacidadePlenaEquipaHoras: 0,
    capacidadeRealHojeHoras: 0,
    maxY: 0,
    riscoH3: avaliarRiscoEscalaH3(operadoresH3),
    headcountSimuladoTotal,
  }
}

/**
 * Calcula o cenário hipotético. No ponto zero (ajustes === baselines em
 * cada campo), idealExato bate exatamente com
 * aplicarMinimoEstrutural(calcularHeadcountIdeal(mesesJanela), ...) da
 * página principal — cargaHoras é literalmente cargaBaseline
 * (mean(carga_horas), sem nenhuma soma de termos pelo meio) porque
 * nenhum termo passa no `tocado()` e a soma de deltas fica vazia; o
 * piso estrutural aplica-se depois, da mesma forma nos dois sítios.
 */
export function calcularCenario(
  mesesJanela: HeadcountMensal[],
  ajustes: AjustesCenario,
  headcountRealHoje: number,
  parametros: HeadcountParametros
): ResultadoCenario {
  const headcountSimuladoTotal = ajustes.operadores + ajustes.operadoresH3

  // Reutiliza calcularHeadcountIdeal para o guard em vez de duplicar as
  // suas duas condições (headcount.ts:19/:23 — sem meses fechados, ou
  // capacidade plena por pessoa a zero; nada impede taxa_eficiencia/
  // taxa_cobertura_ferias = 0, PainelParametros não tem min nesses
  // campos). Sem isto o simulador mostraria "NaN"/"Infinity" em vez de
  // "sem baseline", e uma futura mudança ao guard original ficaria
  // automaticamente refletida aqui.
  const idealBaseline = calcularHeadcountIdeal(mesesJanela)
  if (idealBaseline === null) return resultadoSemBaseline(headcountSimuladoTotal, ajustes.operadoresH3)

  // Mesma expressão exata de calcularHeadcountIdeal (reduce simples,
  // não uma reconstrução por termos) — cargaBaseline/capacidadePlenaPessoaBaseline
  // dividida dá literalmente idealBaseline, só que aqui precisamos dos
  // dois valores em separado para aplicar os deltas por cima.
  const capacidadePlenaPessoaBaseline = media(mesesJanela.map((m) => m.capacidade_plena_horas_pessoa ?? 0))
  const cargaBaseline = media(mesesJanela.map((m) => m.carga_horas ?? 0))
  const b = construirBaselinesTermos(mesesJanela)

  let deltaTotal = 0

  if (tocado(ajustes.batchHorasDia, b.batchHorasDia)) {
    deltaTotal += ajustes.batchHorasDia * b.mediaDiasCorridos - b.termoBatch
  }
  if (tocado(ajustes.olhoVivoMinutosDia, b.olhoVivoMinutosDia)) {
    deltaTotal += (ajustes.olhoVivoMinutosDia / 60) * b.mediaDiasCorridos - b.termoOlhoVivo
  }
  if (tocado(ajustes.prepFimSemanaHorasSemana, b.prepFimSemanaHorasSemana)) {
    deltaTotal += ajustes.prepFimSemanaHorasSemana * b.mediaSemanas - b.termoPrep
  }
  if (tocado(ajustes.imparidadeCalendarioHoras, b.imparidadeCalendarioHoras)) {
    deltaTotal += ajustes.imparidadeCalendarioHoras - b.termoImpCalendario
  }
  if (tocado(ajustes.imparidadeExecucaoHorasSemana, b.imparidadeExecucaoHorasSemana)) {
    deltaTotal += ajustes.imparidadeExecucaoHorasSemana * b.mediaSemanas - b.termoImpExecucao
  }

  // Termo de dois fatores: nunca dois deltas somados separadamente
  // (perderia o termo cruzado do produto e subestimaria o resultado
  // sempre que os dois sliders se mexem ao mesmo tempo) — sempre UM
  // cálculo único com os valores efetivos dos dois fatores.
  const minutosTocado = tocado(ajustes.imparidadeReportesMinutosDia, b.imparidadeReportesMinutosDia)
  const diasTocado = tocado(ajustes.imparidadeReportesDiasMes, b.imparidadeReportesDiasMes)
  if (minutosTocado || diasTocado) {
    const minutosEfetivo = minutosTocado ? ajustes.imparidadeReportesMinutosDia : b.imparidadeReportesMinutosDia
    const diasEfetivo = diasTocado ? ajustes.imparidadeReportesDiasMes : b.imparidadeReportesDiasMes
    deltaTotal += (minutosEfetivo / 60) * diasEfetivo - b.termoReportes
  }

  // Termo de pedidos: mesmo caso de dois fatores, mas tempo_medio_pedido_minutos
  // é estrutural (nunca tem slider) — o fator efetivo é sempre a sua média.
  if (tocado(ajustes.volumePedidos, b.volumePedidos)) {
    deltaTotal += (b.tempoMedioPedidoMinutos / 60) * ajustes.volumePedidos - b.termoPedidos
  }

  if (tocado(ajustes.diasRecuperacaoCadeia, b.diasRecuperacaoCadeia)) {
    deltaTotal += ajustes.diasRecuperacaoCadeia * 24 - b.termoRecuperacao
  }

  const cargaHoras = cargaBaseline + deltaTotal
  const idealPorHoras = cargaHoras / capacidadePlenaPessoaBaseline
  const idealExato = aplicarMinimoEstrutural(idealPorHoras, parametros.minimo_turnos_criticos, parametros.garantia_contratual_fracao)
  const classificacao = classificarHeadcount(headcountSimuladoTotal, idealExato, parametros.banda_tolerancia_pessoas)
  const capacidadePlenaEquipaHoras = capacidadePlenaPessoaBaseline * headcountSimuladoTotal
  const capacidadeRealHojeHoras = capacidadePlenaPessoaBaseline * headcountRealHoje
  // Nunca fixado no baseline — recalculado a partir dos valores
  // simulados atuais, para a margem de 15% ser válida em qualquer
  // ponto do intervalo dos sliders. Chão em 0: mesmo que um extremo de
  // sliders empurre cargaHoras para perto de zero (ou ligeiramente
  // negativo por ruído de ponto flutuante), maxY nunca fica indefinido.
  const maxY = Math.max(cargaHoras, capacidadePlenaEquipaHoras, capacidadeRealHojeHoras, 0) * 1.15
  const riscoH3 = avaliarRiscoEscalaH3(ajustes.operadoresH3)

  return { idealExato, classificacao, cargaHoras, capacidadePlenaEquipaHoras, capacidadeRealHojeHoras, maxY, riscoH3, headcountSimuladoTotal }
}
