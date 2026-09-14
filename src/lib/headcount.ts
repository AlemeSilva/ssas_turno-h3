// Lógica pura da calculadora de Headcount Ideal — sem Supabase, 100%
// testável. O cálculo de um mês (calcular_headcount, em SQL) precisa
// de acesso privilegiado a parâmetros/férias, por isso vive na base de
// dados; isto aqui é só a média de tendência e a classificação, que só
// precisam dos meses já fechados (já legíveis por RLS normal) — nunca
// recalcula a partir de dados ao vivo, só lê os valores já congelados
// no fecho de cada mês, para o histórico nunca mudar retroativamente.

import { formatarMesAnoPT } from './datas'
import type { HeadcountMensal, HeadcountParametros } from '@/types/database'

export type ClassificacaoHeadcount = 'ACEITAVEL' | 'SOBRE_DIMENSIONADO' | 'SUB_DIMENSIONADO'

/**
 * Médias de carga e de capacidade plena por pessoa dos meses já
 * fechados passados — extraído de calcularHeadcountIdeal para ser
 * reaproveitado tal-e-qual pelo ecrã de explicação do cálculo, que
 * precisa de mostrar as duas médias, não só o quociente final.
 */
export function mediasJanela(mesesFechados: HeadcountMensal[]): { cargaMedia: number; capacidadeMedia: number } | null {
  if (mesesFechados.length === 0) return null
  const cargaMedia = mesesFechados.reduce((soma, m) => soma + (m.carga_horas ?? 0), 0) / mesesFechados.length
  const capacidadeMedia =
    mesesFechados.reduce((soma, m) => soma + (m.capacidade_plena_horas_pessoa ?? 0), 0) / mesesFechados.length
  return { cargaMedia, capacidadeMedia }
}

/**
 * Média das cargas e das capacidades plenas por pessoa dos meses já
 * fechados passados — a janela de tendência (quantos meses) é decidida
 * por quem chama, ao selecionar quais linhas passar aqui.
 */
/** Divisão carga÷capacidade partilhada por calcularHeadcountIdeal e calcularEstadoHeadcountAtual — nunca recalculada duas vezes a partir do zero para a mesma janela. */
function idealPorHorasDeMedias(medias: { cargaMedia: number; capacidadeMedia: number } | null): number | null {
  if (medias === null || medias.capacidadeMedia === 0) return null
  return medias.cargaMedia / medias.capacidadeMedia
}

export function calcularHeadcountIdeal(mesesFechados: HeadcountMensal[]): number | null {
  return idealPorHorasDeMedias(mediasJanela(mesesFechados))
}

/**
 * Compara sempre o headcount real DE HOJE (ao vivo) com o ideal exato,
 * nunca arredondado — arredondar antes de comparar distorceria a
 * banda de tolerância para um só lado (achado do Gerente: ceil(4,01)=5
 * com tolerância ±1 dava [4,6], assimétrico à volta do valor real).
 */
export function classificarHeadcount(realHoje: number, idealExato: number, bandaTolerancia: number): ClassificacaoHeadcount {
  const diferenca = realHoje - idealExato
  if (Math.abs(diferenca) <= bandaTolerancia) return 'ACEITAVEL'
  return diferenca > 0 ? 'SOBRE_DIMENSIONADO' : 'SUB_DIMENSIONADO'
}

/**
 * Piso estrutural do Headcount Ideal — garantia contratual, independente
 * da carga de trabalho. A equipa opera 24x7; H1/H2/H3 exigem sempre
 * `minimoTurnosCriticos` pessoas em simultâneo (hoje 1+1+1=3; H4 não
 * conta, absorve quem sobra nas transições). Contratualmente, esse
 * mínimo concorrente nunca pode exceder `garantiaContratualFracao` do
 * total da equipa — daí o total ter de ser sempre pelo menos
 * minimoTurnosCriticos ÷ garantiaContratualFracao, para sustentar
 * rotação de férias e ausências sem furar a cobertura. Achado do
 * Gerente, 2026-09-11: sem isto, "ideal" podia cair abaixo do que a
 * própria estrutura de turnos exige, mesmo com pouco volume de pedidos.
 */
export function aplicarMinimoEstrutural(
  idealPorHoras: number,
  minimoTurnosCriticos: number,
  garantiaContratualFracao: number
): number {
  const piso = calcularPisoEstrutural(minimoTurnosCriticos, garantiaContratualFracao)
  if (piso === null) return idealPorHoras
  return Math.max(idealPorHoras, piso)
}

/**
 * Piso estrutural em si, isolado — devolve null (não Infinity/NaN) quando a
 * garantia contratual não é um valor válido para dividir. Única fonte da
 * guarda, partilhada por aplicarMinimoEstrutural (decide o Ideal exato) e
 * pelo relatório PDF (mostra o número na explicação do cálculo) — antes o
 * PDF recalculava esta divisão à parte, sem a guarda, podendo mostrar
 * "Infinity" ao lado de um Ideal exato correto (achado de peer-review).
 */
export function calcularPisoEstrutural(minimoTurnosCriticos: number, garantiaContratualFracao: number): number | null {
  if (garantiaContratualFracao <= 0) return null
  return minimoTurnosCriticos / garantiaContratualFracao
}

export interface EstadoHeadcountAtual {
  medias: { cargaMedia: number; capacidadeMedia: number } | null
  idealPorHoras: number | null
  idealExato: number | null
  classificacao: ClassificacaoHeadcount | null
}

/**
 * Deriva o estado atual do Headcount (médias, Ideal por horas, Ideal exato,
 * classificação) num único lugar — fonte única partilhada pela página
 * (HeadcountPage) e pelo relatório PDF, para as duas superfícies nunca
 * poderem divergir na mesma sequência de cálculo (achado de peer-review:
 * antes cada uma reimplementava os mesmos 3 passos encadeados à parte).
 */
export function calcularEstadoHeadcountAtual(
  mesesJanela: HeadcountMensal[],
  headcountRealHoje: number,
  parametros: HeadcountParametros
): EstadoHeadcountAtual {
  const medias = mediasJanela(mesesJanela)
  const idealPorHoras = idealPorHorasDeMedias(medias)
  const idealExato = idealPorHoras !== null ? aplicarMinimoEstrutural(idealPorHoras, parametros.minimo_turnos_criticos, parametros.garantia_contratual_fracao) : null
  const classificacao = idealExato !== null ? classificarHeadcount(headcountRealHoje, idealExato, parametros.banda_tolerancia_pessoas) : null
  return { medias, idealPorHoras, idealExato, classificacao }
}

/**
 * "Capacidade Presente Necessária" — indicador operacional à parte do
 * veredito estrutural: mostra se a equipa realmente presente no
 * último mês fechado (descontando férias/licenças reais) bastou, sem
 * influenciar a classificação principal (que usa capacidade plena).
 */
export function calcularPercentagemCapacidadePresente(mesFechado: HeadcountMensal): number | null {
  const plena = mesFechado.capacidade_plena_horas_equipa
  const presente = mesFechado.capacidade_presente_horas_equipa
  if (!plena) return null
  return ((presente ?? 0) / plena) * 100
}

/**
 * A escala anual (preencher_escala_anual, migração 0035) só funciona
 * com um mínimo de 3 Operadores H3 ativos. Este aviso é condicional e
 * independente do veredito global — mostra-se mesmo com o total da
 * equipa "aceitável", para nunca esconder este risco específico atrás
 * de um número saudável (achado do Gerente).
 */
export function avaliarRiscoEscalaH3(operadorH3Ativo: number, minimo = 3): boolean {
  return operadorH3Ativo <= minimo
}

export interface ParcelaCarga {
  chave:
    | 'pedidos'
    | 'batch'
    | 'olho_vivo'
    | 'prep_fim_semana'
    | 'imparidade_calendario'
    | 'imparidade_execucao'
    | 'imparidade_reportes'
    | 'recuperacao_cadeia'
  valor: number
}

export interface DecomposicaoCalculoMes {
  diasCorridos: number
  semanas: number
  diasUteis: number
  parcelasCarga: ParcelaCarga[]
  somaParcelasCarga: number
  cargaRegistada: number
  capacidadeCalculada: number
  capacidadeRegistada: number
}

/**
 * Decompõe carga_horas e capacidade_plena_horas_pessoa de UM mês já
 * fechado nas parcelas da fórmula de calcular_headcount() (SQL, migração
 * 0052) — espelhada aqui termo a termo para o ecrã de explicação do
 * cálculo. Usa sempre os valores JÁ CONGELADOS desse mês (nunca os
 * parâmetros atuais), para bater com o que foi realmente gravado no
 * fecho. A carga usa dias corridos (batch/Olho Vivo acontecem todos os
 * dias, incluindo fins de semana e feriados); a capacidade usa dias
 * ÚTEIS — mes.dias_uteis, já congelado no fecho, nunca recalculado aqui
 * (feriados_portugal pode mudar no futuro; o histórico não pode derivar
 * de forma diferente se isso acontecer). A soma das parcelas de carga
 * pode diferir da carga registada por um resíduo mínimo de
 * arredondamento (numeric do Postgres vs. number do JS) — quem consome
 * isto deve mostrar essa diferença, nunca escondê-la nem forçar o
 * encaixe.
 */
export function decomporCalculoMes(mes: HeadcountMensal): DecomposicaoCalculoMes {
  const [ano, mesNum] = mes.mes_referencia.slice(0, 7).split('-').map(Number)
  // mesNum (1-12) não é ajustado para 0-index — de propósito: o dia 0 do
  // "mês seguinte" no construtor Date é sempre o último dia do mês
  // mesNum, espelhando v_mes_fim em calcular_headcount() (SQL).
  const diasCorridos = new Date(ano, mesNum, 0).getDate()
  const semanas = diasCorridos / 7
  const diasUteis = mes.dias_uteis ?? 0

  const parcelasCarga: ParcelaCarga[] = [
    { chave: 'pedidos', valor: (mes.volume_pedidos ?? 0) * ((mes.tempo_medio_pedido_minutos ?? 0) / 60) },
    { chave: 'batch', valor: (mes.batch_horas_dia ?? 0) * diasCorridos },
    { chave: 'olho_vivo', valor: ((mes.olho_vivo_minutos_dia ?? 0) / 60) * diasCorridos },
    { chave: 'prep_fim_semana', valor: (mes.prep_fim_semana_horas_semana ?? 0) * semanas },
    { chave: 'imparidade_calendario', valor: mes.imparidade_calendario_horas ?? 0 },
    { chave: 'imparidade_execucao', valor: (mes.imparidade_execucao_horas_semana ?? 0) * semanas },
    { chave: 'imparidade_reportes', valor: ((mes.imparidade_reportes_minutos_dia ?? 0) / 60) * (mes.imparidade_reportes_dias_mes ?? 0) },
    { chave: 'recuperacao_cadeia', valor: mes.dias_recuperacao_cadeia * 24 },
  ]
  const somaParcelasCarga = parcelasCarga.reduce((soma, p) => soma + p.valor, 0)
  const capacidadeCalculada = diasUteis * (mes.capacidade_base_horas ?? 0) * (mes.taxa_eficiencia ?? 0) * (mes.taxa_cobertura_ferias ?? 0)

  return {
    diasCorridos,
    semanas,
    diasUteis,
    parcelasCarga,
    somaParcelasCarga,
    cargaRegistada: mes.carga_horas ?? 0,
    capacidadeCalculada,
    capacidadeRegistada: mes.capacidade_plena_horas_pessoa ?? 0,
  }
}

/**
 * Rótulo e fórmula (em texto simples, nível "leigo") de cada parcela da
 * carga — fonte única partilhada pelo "Ver Cálculo" (HeadcountExplicacaoDialog)
 * e pelo relatório PDF, para as duas superfícies nunca poderem divergir no
 * texto explicativo de uma fórmula.
 */
export const PARCELAS_CARGA_INFO: Record<
  ParcelaCarga['chave'],
  { rotulo: string; formula: (mes: HeadcountMensal, diasCorridos: number, semanas: number) => string }
> = {
  pedidos: {
    rotulo: 'Pedidos',
    formula: (mes) => `${mes.volume_pedidos ?? 0} pedidos × ${mes.tempo_medio_pedido_minutos ?? 0} min ÷ 60`,
  },
  batch: {
    rotulo: 'Batch',
    formula: (mes, dias) => `${mes.batch_horas_dia ?? 0} h/dia × ${dias} dias`,
  },
  olho_vivo: {
    rotulo: 'Olho Vivo',
    formula: (mes, dias) => `${mes.olho_vivo_minutos_dia ?? 0} min/dia ÷ 60 × ${dias} dias`,
  },
  prep_fim_semana: {
    rotulo: 'Prep. fim de semana',
    formula: (mes, _dias, semanas) => `${mes.prep_fim_semana_horas_semana ?? 0} h/semana × ${semanas.toFixed(2)} semanas`,
  },
  imparidade_calendario: {
    rotulo: 'Imparidade: calendário',
    formula: (mes) => `fixo, ${mes.imparidade_calendario_horas ?? 0} h/mês`,
  },
  imparidade_execucao: {
    rotulo: 'Imparidade: execução',
    formula: (mes, _dias, semanas) => `${mes.imparidade_execucao_horas_semana ?? 0} h/semana × ${semanas.toFixed(2)} semanas`,
  },
  imparidade_reportes: {
    rotulo: 'Imparidade: reportes',
    formula: (mes) => `${mes.imparidade_reportes_minutos_dia ?? 0} min/dia ÷ 60 × ${mes.imparidade_reportes_dias_mes ?? 0} dias/mês`,
  },
  recuperacao_cadeia: {
    rotulo: 'Recuperação de cadeia',
    formula: (mes) => `${mes.dias_recuperacao_cadeia} dias × 24h`,
  },
}

/**
 * Frase única do veredito, partilhada pelo "Ver Cálculo" e pelo relatório
 * PDF — mesmo motivo do bloco acima.
 */
export function fraseVeredicto(classificacao: ClassificacaoHeadcount, real: number, idealExato: number, banda: number): string {
  const diferenca = Math.abs(real - idealExato).toFixed(1)
  if (classificacao === 'ACEITAVEL') {
    return `A diferença entre a equipa real (${real}) e o Ideal (${idealExato.toFixed(1)}) é ${diferenca} pessoas, dentro da tolerância de ±${banda}, por isso o veredito é Aceitável.`
  }
  if (classificacao === 'SOBRE_DIMENSIONADO') {
    return `A equipa real (${real}) está ${diferenca} pessoas acima do Ideal (${idealExato.toFixed(1)}), fora da tolerância de ±${banda}, por isso o veredito é Sobre-dimensionado.`
  }
  return `A equipa real (${real}) está ${diferenca} pessoas abaixo do Ideal (${idealExato.toFixed(1)}), fora da tolerância de ±${banda}, por isso o veredito é Sub-dimensionado.`
}

export interface CampoParametro {
  chave: keyof HeadcountParametros
  rotulo: string
  descricao: string
  passo?: string
}

/**
 * Descrição de cada parâmetro, em texto simples — fonte única partilhada
 * pelo painel de parâmetros (HeadcountPage) e pelo relatório PDF.
 */
export const CAMPOS_PARAMETROS: CampoParametro[] = [
  {
    chave: 'capacidade_base_horas',
    rotulo: 'Capacidade-base (h/dia)',
    descricao:
      'Horas de trabalho nominais de uma pessoa por dia. É o ponto de partida da capacidade plena, antes de qualquer desconto de eficiência ou de reserva de férias.',
  },
  {
    chave: 'taxa_eficiencia',
    rotulo: 'Taxa de eficiência (0-1)',
    passo: '0.01',
    descricao:
      'Fração do dia de trabalho presente que é efetivamente produtiva, descontando pausas, formação e pequenos atrasos do dia a dia. Aplica-se como multiplicador direto na capacidade plena por pessoa (ex.: 0,85 = 85% do dia é produtivo).',
  },
  {
    chave: 'taxa_cobertura_ferias',
    rotulo: 'Taxa de cobertura de férias (0-1)',
    passo: '0.01',
    descricao:
      'Fração da capacidade nominal que sobra depois de reservar estruturalmente para a rotação de férias da equipa ao longo do ano. Não é a ausência real de um mês específico, essa já está refletida na capacidade presente; é antes uma margem fixa para que o Headcount Ideal já venha dimensionado para absorver férias sem entrar em rutura (ex.: 0,90 = reserva-se 10% da capacidade para cobertura de férias).',
  },
  {
    chave: 'batch_horas_dia',
    rotulo: 'Batch (h/dia)',
    descricao:
      'Horas de processamento em lote (batch) que a equipa tem de garantir todos os dias do mês, independentemente do volume de pedidos. Entra na carga total multiplicada pelos dias corridos do mês.',
  },
  {
    chave: 'olho_vivo_minutos_dia',
    rotulo: 'Olho Vivo (min/dia)',
    descricao:
      'Minutos por dia dedicados à tarefa Olho Vivo, uma carga fixa diária da equipa. Entra na carga total (convertida para horas) multiplicada pelos dias corridos do mês.',
  },
  {
    chave: 'prep_fim_semana_horas_semana',
    rotulo: 'Prep. fim de semana (h/semana)',
    descricao:
      'Horas por semana dedicadas à preparação do Plano de Fim de Semana. Entra na carga total multiplicada pelo número de semanas do mês.',
  },
  {
    chave: 'tempo_medio_pedido_minutos',
    rotulo: 'Tempo médio / pedido (min)',
    descricao:
      'Tempo médio, em minutos, para tratar um pedido. Multiplicado pelo volume de pedidos do mês (convertido para horas) dá a parcela da carga relativa a pedidos.',
  },
  {
    chave: 'imparidade_calendario_horas',
    rotulo: 'Imparidade: calendário (h/mês)',
    descricao:
      'Horas fixas por mês dedicadas à parte de calendário do Cálculo de Imparidade: um valor único que se soma uma vez à carga total, sem escalar com dias ou semanas do mês.',
  },
  {
    chave: 'imparidade_execucao_horas_semana',
    rotulo: 'Imparidade: execução (h/semana)',
    descricao:
      'Horas por semana dedicadas à execução do Cálculo de Imparidade. Entra na carga total multiplicada pelo número de semanas do mês.',
  },
  {
    chave: 'imparidade_reportes_minutos_dia',
    rotulo: 'Imparidade: reportes (min/dia)',
    descricao:
      'Minutos por dia dedicados aos reportes do Cálculo de Imparidade, nos dias em que há reportes. Combina-se com "Imparidade: reportes (dias/mês)" para dar a carga total de reportes do mês.',
  },
  {
    chave: 'imparidade_reportes_dias_mes',
    rotulo: 'Imparidade: reportes (dias/mês)',
    descricao:
      'Número de dias por mês em que há reportes do Cálculo de Imparidade. Multiplicado pelos minutos por dia de reportes dá a carga total de reportes do mês.',
  },
  {
    chave: 'banda_tolerancia_pessoas',
    rotulo: 'Banda de tolerância (pessoas)',
    descricao:
      'Margem de tolerância, em número de pessoas, à volta do Headcount Ideal. Dentro desta margem (ideal ± banda) a equipa é classificada como Aceitável; fora dela, Sobre-dimensionada ou Sub-dimensionada.',
  },
  {
    chave: 'janela_tendencia_meses',
    rotulo: 'Janela de tendência (meses)',
    descricao:
      'Número de meses fechados mais recentes usados para calcular a média móvel que dá o Headcount Ideal. Suaviza picos e vales pontuais de carga e de capacidade em vez de reagir a um único mês atípico.',
  },
  {
    chave: 'minimo_turnos_criticos',
    rotulo: 'Mínimo turnos críticos (pessoas)',
    descricao:
      'Pessoas em simultâneo exigidas nos turnos obrigatórios (H1, H2 e H3, três dos quatro turnos da rotação diária da equipa; hoje 1+1+1=3). O quarto turno, H4, não conta para este mínimo: absorve quem sobra nas transições, não é um posto próprio. Junto com a Garantia contratual, define o piso estrutural do Headcount Ideal, independente da carga de pedidos.',
  },
  {
    chave: 'garantia_contratual_fracao',
    rotulo: 'Garantia contratual (0-1)',
    passo: '0.01',
    descricao:
      'Fração contratual: o mínimo de turnos críticos nunca pode exceder esta fração do total da equipa (ex.: 0,50 = os turnos obrigatórios não podem exigir mais de metade da equipa em simultâneo). O piso estrutural do Ideal é Mínimo turnos críticos ÷ esta fração.',
  },
]

/** "AAAA-MM..." → "Mês de AAAA", em pt-PT (mesma convenção de dias-do-mês de decomporCalculoMes acima). */
export function formatarMesAnoDeReferencia(mesISO: string): string {
  const [ano, mesNum] = mesISO.slice(0, 7).split('-').map(Number)
  return formatarMesAnoPT(new Date(ano, mesNum - 1, 1))
}

export interface HistoriaEquipa {
  paragrafoCarga: string
  paragrafoCapacidade: string
}

function nomearParcelaDominante(decomposicao: DecomposicaoCalculoMes): { rotulo: string; valor: number } | null {
  const maior = decomposicao.parcelasCarga.reduce((a, b) => (b.valor > a.valor ? b : a))
  if (maior.valor <= 0) return null
  return { rotulo: PARCELAS_CARGA_INFO[maior.chave].rotulo, valor: maior.valor }
}

/**
 * Verdadeiro se a diferença entre dois valores for inferior a 3% do menor —
 * usado para descrever uma tendência como "estável" em vez de "subiu"/"desceu"
 * por causa de ruído irrelevante. Limiar relativo, não absoluto (achado do
 * stress-test: um limiar absoluto de poucas horas quase nunca dispara em
 * valores desta ordem de grandeza, ~650-950h).
 */
function variacaoInsignificante(a: number, b: number): boolean {
  const base = Math.max(Math.min(a, b), 1)
  return Math.abs(a - b) / base < 0.03
}

/**
 * Narrativa funcional (nível leigo) da janela de tendência — usa sempre o
 * MÍNIMO e o MÁXIMO da janela inteira, nunca só o mês mais antigo vs. o mais
 * recente. Achado do stress-test: com a janela real (Jun/Jul/Ago), o pico da
 * capacidade por pessoa está em Julho — o mês do MEIO — comparar só as pontas
 * (Junho vs. Agosto) escondia exatamente essa oscilação e sugeria uma
 * tendência que não existe.
 */
export function construirHistoriaEquipa(
  mesesJanela: HeadcountMensal[],
  headcountRealHoje: number,
  decomposicaoMaisRecente?: DecomposicaoCalculoMes
): HistoriaEquipa | null {
  if (mesesJanela.length === 0) return null
  const maisRecente = mesesJanela[0]
  // Aceita a decomposição já calculada por quem chama (ex.: o relatório PDF,
  // que também precisa dela para outras secções) para nunca recalcular a
  // mesma decomposição duas vezes — decompõe aqui só se ninguém a passou.
  const parcelaDominante = nomearParcelaDominante(decomposicaoMaisRecente ?? decomporCalculoMes(maisRecente))
  const fraseDominante = parcelaDominante
    ? ` Em ${formatarMesAnoDeReferencia(maisRecente.mes_referencia)}, a maior parcela foi ${parcelaDominante.rotulo} (${parcelaDominante.valor.toFixed(0)}h).`
    : ''

  const cargas = mesesJanela.map((m) => ({ mes: m.mes_referencia, valor: m.carga_horas ?? 0 }))
  const minCarga = cargas.reduce((a, b) => (b.valor < a.valor ? b : a))
  const maxCarga = cargas.reduce((a, b) => (b.valor > a.valor ? b : a))

  let paragrafoCarga: string
  if (mesesJanela.length === 1) {
    paragrafoCarga = `Em ${formatarMesAnoDeReferencia(maisRecente.mes_referencia)}, a carga de trabalho foi de ${maxCarga.valor.toFixed(0)}h.${fraseDominante}`
  } else if (variacaoInsignificante(minCarga.valor, maxCarga.valor)) {
    paragrafoCarga = `Nos últimos ${mesesJanela.length} meses fechados, a carga de trabalho manteve-se estável, entre ${minCarga.valor.toFixed(0)}h e ${maxCarga.valor.toFixed(0)}h.${fraseDominante}`
  } else {
    paragrafoCarga = `Nos últimos ${mesesJanela.length} meses fechados, a carga de trabalho variou entre ${minCarga.valor.toFixed(0)}h (${formatarMesAnoDeReferencia(minCarga.mes)}) e ${maxCarga.valor.toFixed(0)}h (${formatarMesAnoDeReferencia(maxCarga.mes)}).${fraseDominante}`
  }

  const capacidades = mesesJanela.map((m) => ({ mes: m.mes_referencia, valor: m.capacidade_plena_horas_pessoa ?? 0 }))
  const minCap = capacidades.reduce((a, b) => (b.valor < a.valor ? b : a))
  const maxCap = capacidades.reduce((a, b) => (b.valor > a.valor ? b : a))
  const reservaFeriasPct = maisRecente.taxa_cobertura_ferias !== null ? Math.round((1 - maisRecente.taxa_cobertura_ferias) * 100) : null
  const fraseReserva =
    reservaFeriasPct !== null && reservaFeriasPct > 0
      ? ` A capacidade planeada já reserva ${reservaFeriasPct}% para rotação de férias (Taxa de cobertura de férias = ${maisRecente.taxa_cobertura_ferias}).`
      : ''
  const fraseHoje = ` Hoje, a equipa conta com ${headcountRealHoje} pessoas.`

  let paragrafoCapacidade: string
  if (mesesJanela.length === 1) {
    paragrafoCapacidade = `Em ${formatarMesAnoDeReferencia(maisRecente.mes_referencia)}, a capacidade plena por pessoa foi de ${maxCap.valor.toFixed(0)}h.${fraseReserva}${fraseHoje}`
  } else if (variacaoInsignificante(minCap.valor, maxCap.valor)) {
    paragrafoCapacidade = `No mesmo período, a capacidade plena por pessoa manteve-se estável, por volta de ${maxCap.valor.toFixed(0)}h.${fraseReserva}${fraseHoje}`
  } else {
    paragrafoCapacidade = `No mesmo período, a capacidade plena por pessoa variou entre ${minCap.valor.toFixed(0)}h (${formatarMesAnoDeReferencia(minCap.mes)}) e ${maxCap.valor.toFixed(0)}h (${formatarMesAnoDeReferencia(maxCap.mes)}), uma oscilação ligada ao número de dias úteis de cada mês.${fraseReserva}${fraseHoje}`
  }

  return { paragrafoCarga, paragrafoCapacidade }
}
