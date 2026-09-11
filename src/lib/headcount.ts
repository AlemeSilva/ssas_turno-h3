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
 * Média das cargas e das capacidades plenas por pessoa dos meses já
 * fechados passados — a janela de tendência (quantos meses) é decidida
 * por quem chama, ao selecionar quais linhas passar aqui.
 */
export function calcularHeadcountIdeal(mesesFechados: HeadcountMensal[]): number | null {
  if (mesesFechados.length === 0) return null
  const cargaMedia = mesesFechados.reduce((soma, m) => soma + (m.carga_horas ?? 0), 0) / mesesFechados.length
  const capacidadeMedia =
    mesesFechados.reduce((soma, m) => soma + (m.capacidade_plena_horas_pessoa ?? 0), 0) / mesesFechados.length
  if (capacidadeMedia === 0) return null
  return cargaMedia / capacidadeMedia
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
