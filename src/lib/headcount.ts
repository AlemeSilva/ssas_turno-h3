// Lógica pura da calculadora de Headcount Ideal — sem Supabase, 100%
// testável. O cálculo de um mês (calcular_headcount, em SQL) precisa
// de acesso privilegiado a parâmetros/férias, por isso vive na base de
// dados; isto aqui é só a média de tendência e a classificação, que só
// precisam dos meses já fechados (já legíveis por RLS normal) — nunca
// recalcula a partir de dados ao vivo, só lê os valores já congelados
// no fecho de cada mês, para o histórico nunca mudar retroativamente.

import type { HeadcountMensal } from '@/types/database'

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
export function calcularHeadcountIdeal(mesesFechados: HeadcountMensal[]): number | null {
  const medias = mediasJanela(mesesFechados)
  if (medias === null || medias.capacidadeMedia === 0) return null
  return medias.cargaMedia / medias.capacidadeMedia
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
  if (garantiaContratualFracao <= 0) return idealPorHoras
  const minimoEstrutural = minimoTurnosCriticos / garantiaContratualFracao
  return Math.max(idealPorHoras, minimoEstrutural)
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
