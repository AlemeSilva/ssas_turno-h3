import { describe, expect, it } from 'vitest'
import {
  calcularCenario,
  construirBaselinesTermos,
  diasNoMes,
  estadoInicial,
  type AjustesCenario,
} from '../../src/lib/cenarios-headcount'
import { aplicarMinimoEstrutural, calcularHeadcountIdeal } from '../../src/lib/headcount'
import type { HeadcountMensal, HeadcountParametros } from '../../src/types/database'

function mesFechado(mesReferencia: string, overrides: Partial<HeadcountMensal> = {}): HeadcountMensal {
  return {
    id: 1,
    mes_referencia: mesReferencia,
    volume_pedidos: 200,
    dias_recuperacao_cadeia: 0,
    capacidade_base_horas: 8,
    taxa_eficiencia: 0.85,
    taxa_cobertura_ferias: 0.9,
    batch_horas_dia: 15,
    olho_vivo_minutos_dia: 30,
    prep_fim_semana_horas_semana: 2,
    tempo_medio_pedido_minutos: 40,
    imparidade_calendario_horas: 8,
    imparidade_execucao_horas_semana: 1,
    imparidade_reportes_minutos_dia: 30,
    imparidade_reportes_dias_mes: 15,
    carga_horas: 600,
    dias_uteis: 21,
    capacidade_plena_horas_pessoa: 200,
    capacidade_plena_horas_equipa: 1400,
    capacidade_presente_horas_equipa: 1300,
    headcount_real_snapshot: 7,
    operador_h3_ativo_snapshot: 3,
    fechado: true,
    fechado_por: 'gerente-id',
    fechado_em: '2026-09-03T10:00:00Z',
    atualizado_por: null,
    atualizado_em: '2026-09-03T10:00:00Z',
    criado_em: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

// Junho (30 dias), Julho (31) e Agosto (31) de 2026 — parâmetros
// constantes nos 3 meses (o caso comum: parâmetro estrutural raramente
// muda dentro da janela de tendência), só o calendário varia.
const JANELA = [mesFechado('2026-06-01'), mesFechado('2026-07-01'), mesFechado('2026-08-01')]
const MEDIA_DIAS_CORRIDOS = (30 + 31 + 31) / 3
const MEDIA_SEMANAS = MEDIA_DIAS_CORRIDOS / 7

const PARAMETROS: HeadcountParametros = {
  id: true,
  capacidade_base_horas: 8,
  taxa_eficiencia: 0.85,
  taxa_cobertura_ferias: 0.9,
  batch_horas_dia: 15,
  olho_vivo_minutos_dia: 30,
  prep_fim_semana_horas_semana: 2,
  tempo_medio_pedido_minutos: 40,
  imparidade_calendario_horas: 8,
  imparidade_execucao_horas_semana: 1,
  imparidade_reportes_minutos_dia: 30,
  imparidade_reportes_dias_mes: 15,
  banda_tolerancia_pessoas: 1,
  janela_tendencia_meses: 3,
  minimo_turnos_criticos: 3,
  garantia_contratual_fracao: 0.5,
  atualizado_por: null,
  atualizado_em: '2026-09-01T00:00:00Z',
}

function ajustesBase(): AjustesCenario {
  const baselines = construirBaselinesTermos(JANELA)
  return estadoInicial(baselines, 4, 3) // 4 Operadores + 3 Operadores H3 = 7, igual ao headcount real de hoje
}

describe('diasNoMes — armadilha de indexação do Date (mesNum de 1-12, nunca subtraído)', () => {
  it('Fevereiro em ano não-bissexto (2026) tem 28 dias', () => {
    expect(diasNoMes('2026-02-01')).toBe(28)
  })
  it('Fevereiro em ano bissexto (2024) tem 29 dias', () => {
    expect(diasNoMes('2024-02-01')).toBe(29)
  })
  it('mês de 30 dias (Abril)', () => {
    expect(diasNoMes('2026-04-01')).toBe(30)
  })
  it('mês de 31 dias com rollover de ano (Dezembro)', () => {
    expect(diasNoMes('2026-12-01')).toBe(31)
  })
})

describe('construirBaselinesTermos — deteção de baseline zero (decide slider percentual vs. absoluto)', () => {
  it('um termo com histórico sempre a zero (recuperação de cadeia) dá baseline zero', () => {
    expect(construirBaselinesTermos(JANELA).diasRecuperacaoCadeia).toBe(0)
  })
  it('um termo com histórico normal dá baseline não-zero (slider percentual)', () => {
    expect(construirBaselinesTermos(JANELA).batchHorasDia).toBeCloseTo(15, 10)
  })
})

describe('calcularCenario — ponto zero reproduz exatamente calcularHeadcountIdeal + piso estrutural', () => {
  it('sem nenhum ajuste tocado, idealExato bate com a página principal (incluindo o piso estrutural)', () => {
    const resultado = calcularCenario(JANELA, ajustesBase(), 7, PARAMETROS)
    const idealEsperado = aplicarMinimoEstrutural(
      calcularHeadcountIdeal(JANELA)!,
      PARAMETROS.minimo_turnos_criticos,
      PARAMETROS.garantia_contratual_fracao
    )
    expect(resultado.idealExato).toBeCloseTo(idealEsperado, 10)
    expect(resultado.cargaHoras).toBeCloseTo(600, 10) // mean(carga_horas), não a soma dos 8 termos (~637h) — lidos independentemente por desenho
  })

  it('caso real desta janela: ideal por horas (3.0) fica abaixo do piso contratual (6) — o piso vence', () => {
    const resultado = calcularCenario(JANELA, ajustesBase(), 7, PARAMETROS)
    expect(calcularHeadcountIdeal(JANELA)).toBeCloseTo(3, 10) // 600/200, sem piso
    expect(resultado.idealExato).toBe(6) // 3 ÷ 0.5 — o piso, não o valor por horas
  })
})

describe('calcularCenario — decomposição termo-a-termo com valores conhecidos', () => {
  it('tocar só o batch aplica o delta sobre a média de dias corridos da janela', () => {
    const ajustes = { ...ajustesBase(), batchHorasDia: 20 } // baseline 15, +5 h/dia
    const resultado = calcularCenario(JANELA, ajustes, 7, PARAMETROS)
    const deltaEsperado = (20 - 15) * MEDIA_DIAS_CORRIDOS
    expect(resultado.cargaHoras).toBeCloseTo(600 + deltaEsperado, 6)
  })

  it('tocar a prep. de fim de semana aplica o delta sobre a média de semanas da janela (não de dias corridos)', () => {
    const ajustes = { ...ajustesBase(), prepFimSemanaHorasSemana: 3 } // baseline 2
    const resultado = calcularCenario(JANELA, ajustes, 7, PARAMETROS)
    const deltaEsperado = (3 - 2) * MEDIA_SEMANAS
    expect(resultado.cargaHoras).toBeCloseTo(600 + deltaEsperado, 6)
  })

  it('recuperação de cadeia com baseline 0 usa slider absoluto — delta = dias × 24h, sem termo de referência a subtrair', () => {
    const ajustes = { ...ajustesBase(), diasRecuperacaoCadeia: 5 }
    const resultado = calcularCenario(JANELA, ajustes, 7, PARAMETROS)
    expect(resultado.cargaHoras).toBeCloseTo(600 + 5 * 24, 10)
  })
})

describe('calcularCenario — termo de reportes: cálculo unificado dos dois fatores (achado crítico do stress-test)', () => {
  it('mexer só nos minutos usa a média histórica dos dias', () => {
    const ajustes = { ...ajustesBase(), imparidadeReportesMinutosDia: 45 } // baseline 30
    const resultado = calcularCenario(JANELA, ajustes, 7, PARAMETROS)
    // baseline do termo = (30/60)×15 = 7.5; novo termo = (45/60)×15 = 11.25
    expect(resultado.cargaHoras).toBeCloseTo(600 + (11.25 - 7.5), 10)
  })

  it('mexer nos dois sliders ao mesmo tempo NÃO é a soma de dois deltas separados — perderia o termo cruzado e subestimaria', () => {
    const ajustes = { ...ajustesBase(), imparidadeReportesMinutosDia: 45, imparidadeReportesDiasMes: 20 } // baseline 30/15
    const resultado = calcularCenario(JANELA, ajustes, 7, PARAMETROS)

    const baselineReportes = (30 / 60) * 15 // 7.5
    const correto = (45 / 60) * 20 // 15 — cálculo único com os dois efetivos
    const somaDeDoisDeltasSeparados =
      ((45 / 60) * 15 - baselineReportes) + ((30 / 60) * 20 - baselineReportes) // 3.75 + 2.5 = 6.25 — a fórmula errada

    expect(correto - baselineReportes).not.toBeCloseTo(somaDeDoisDeltasSeparados, 5)
    expect(resultado.cargaHoras).toBeCloseTo(600 + (correto - baselineReportes), 10)
  })
})

describe('calcularCenario — fórmula do MaxY, recalculada a partir dos valores simulados atuais', () => {
  it('MaxY = maior das três grandezas × 1,15, nunca fixado no baseline', () => {
    const resultado = calcularCenario(JANELA, ajustesBase(), 7, PARAMETROS)
    // ponto zero: cargaHoras=600, capacidadePlenaEquipaHoras=200×7=1400, capacidadeRealHojeHoras=200×7=1400
    expect(resultado.maxY).toBeCloseTo(1400 * 1.15, 10)
  })

  it('num extremo de sliders, MaxY acompanha o novo máximo em vez de cortar o gráfico', () => {
    const ajustes = { ...ajustesBase(), volumePedidos: 2000 } // suficiente para a carga ultrapassar a capacidade (1400h)
    const resultado = calcularCenario(JANELA, ajustes, 7, PARAMETROS)
    expect(resultado.cargaHoras).toBeGreaterThan(1400) // confirma que é mesmo a carga que passou a dominar
    expect(resultado.maxY).toBeCloseTo(resultado.cargaHoras * 1.15, 10)
  })
})

describe('calcularCenario — headcount simulado total em zero (achado do Gerente)', () => {
  it('não gera NaN/Infinity, classifica corretamente e o badge H3 ativa', () => {
    const ajustes = { ...ajustesBase(), operadores: 0, operadoresH3: 0 }
    const resultado = calcularCenario(JANELA, ajustes, 7, PARAMETROS)

    expect(resultado.headcountSimuladoTotal).toBe(0)
    expect(resultado.capacidadePlenaEquipaHoras).toBe(0)
    expect(Number.isFinite(resultado.idealExato)).toBe(true)
    expect(resultado.classificacao).toBe('SUB_DIMENSIONADO')
    expect(resultado.riscoH3).toBe(true)
    // capacidadeRealHojeHoras usa o headcount REAL de hoje (7), não o
    // simulado — por isso maxY nunca fica indefinido mesmo com o
    // headcount simulado a zero.
    expect(resultado.maxY).toBeCloseTo(200 * 7 * 1.15, 10)
  })
})

describe('calcularCenario — baseline nulo ou degenerado (guards replicados de calcularHeadcountIdeal)', () => {
  it('sem meses fechados devolve idealExato null, sem dividir por nada', () => {
    const resultado = calcularCenario([], ajustesBase(), 7, PARAMETROS)
    expect(resultado.idealExato).toBeNull()
    expect(resultado.classificacao).toBeNull()
  })

  it('capacidade plena por pessoa a zero (ex.: taxa_eficiencia=0 gravada) devolve idealExato null, não Infinity', () => {
    const janelaDegenerada = JANELA.map((m) => ({ ...m, capacidade_plena_horas_pessoa: 0 }))
    const resultado = calcularCenario(janelaDegenerada, ajustesBase(), 7, PARAMETROS)
    expect(resultado.idealExato).toBeNull()
  })

  it('o badge de risco H3 continua ativo mesmo sem baseline — é independente do veredito de capacidade', () => {
    const resultado = calcularCenario([], { ...ajustesBase(), operadoresH3: 2 }, 7, PARAMETROS)
    expect(resultado.riscoH3).toBe(true)
  })
})
