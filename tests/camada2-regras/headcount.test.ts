import { describe, expect, it } from 'vitest'
import {
  aplicarMinimoEstrutural,
  avaliarRiscoEscalaH3,
  calcularHeadcountIdeal,
  calcularPercentagemCapacidadePresente,
  classificarHeadcount,
} from '../../src/lib/headcount'
import type { HeadcountMensal } from '../../src/types/database'

function mesFechado(overrides: Partial<HeadcountMensal>): HeadcountMensal {
  return {
    id: 1,
    mes_referencia: '2026-08-01',
    volume_pedidos: 200,
    dias_recuperacao_cadeia: 0,
    capacidade_base_horas: 8,
    taxa_eficiencia: 0.85,
    batch_horas_dia: 15,
    olho_vivo_minutos_dia: 30,
    prep_fim_semana_horas_semana: 2,
    tempo_medio_pedido_minutos: 40,
    imparidade_calendario_horas: 8,
    imparidade_execucao_horas_semana: 1,
    imparidade_reportes_minutos_dia: 30,
    imparidade_reportes_dias_mes: 15,
    carga_horas: 600,
    capacidade_plena_horas_pessoa: 200,
    capacidade_plena_horas_equipa: 1000,
    capacidade_presente_horas_equipa: 900,
    headcount_real_snapshot: 5,
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

describe('calcularHeadcountIdeal — média da janela de tendência, lida de valores já congelados', () => {
  it('devolve null sem nenhum mês fechado (ainda sem histórico suficiente)', () => {
    expect(calcularHeadcountIdeal([])).toBeNull()
  })
  it('com um só mês, o ideal é simplesmente carga ÷ capacidade plena por pessoa', () => {
    const ideal = calcularHeadcountIdeal([mesFechado({ carga_horas: 600, capacidade_plena_horas_pessoa: 200 })])
    expect(ideal).toBe(3)
  })
  it('com vários meses, faz a média da carga e da capacidade separadamente antes de dividir', () => {
    const ideal = calcularHeadcountIdeal([
      mesFechado({ carga_horas: 600, capacidade_plena_horas_pessoa: 200 }), // 3.0
      mesFechado({ carga_horas: 900, capacidade_plena_horas_pessoa: 180 }), // 5.0
    ])
    // carga média = 750, capacidade média = 190 → 750/190, não a média de (3.0, 5.0)
    expect(ideal).toBeCloseTo(750 / 190, 10)
  })
})

describe('classificarHeadcount — compara sempre o valor exato, nunca arredondado', () => {
  it('é aceitável dentro da banda de tolerância', () => {
    expect(classificarHeadcount(5, 4.2, 1)).toBe('ACEITAVEL')
    expect(classificarHeadcount(4, 4.2, 1)).toBe('ACEITAVEL')
  })
  it('é aceitável exatamente na fronteira da banda', () => {
    expect(classificarHeadcount(6, 5, 1)).toBe('ACEITAVEL')
    expect(classificarHeadcount(4, 5, 1)).toBe('ACEITAVEL')
  })
  it('fica sobre-dimensionado só depois de ultrapassar a banda', () => {
    expect(classificarHeadcount(6.01, 5, 1)).toBe('SOBRE_DIMENSIONADO')
  })
  it('fica sub-dimensionado só depois de ultrapassar a banda', () => {
    expect(classificarHeadcount(3.99, 5, 1)).toBe('SUB_DIMENSIONADO')
  })
  it('a banda é simétrica à volta do valor exato, não do arredondado — corrige a distorção original', () => {
    // ideal exato 4,01 arredondaria para 5; com a banda à volta do
    // arredondado, real=6 (na verdade +1,99 acima do exato) ainda
    // passava por "aceitável". Comparando com o exato, já não passa.
    expect(classificarHeadcount(6, 4.01, 1)).toBe('SOBRE_DIMENSIONADO')
  })
})

describe('calcularPercentagemCapacidadePresente — indicador operacional, não decide o veredito', () => {
  it('calcula a percentagem da capacidade plena que esteve mesmo presente', () => {
    const pct = calcularPercentagemCapacidadePresente(
      mesFechado({ capacidade_plena_horas_equipa: 1000, capacidade_presente_horas_equipa: 850 })
    )
    expect(pct).toBe(85)
  })
  it('devolve null se não há capacidade plena para comparar (mês sem dados)', () => {
    expect(calcularPercentagemCapacidadePresente(mesFechado({ capacidade_plena_horas_equipa: null }))).toBeNull()
  })
})

describe('aplicarMinimoEstrutural — piso contratual (H1+H2+H3 nunca mais que uma fração da equipa)', () => {
  it('caso real do achado: ideal por horas 3.3, piso 3÷0.5=6 — o piso vence', () => {
    expect(aplicarMinimoEstrutural(3.3, 3, 0.5)).toBe(6)
  })
  it('quando a carga de horas já excede o piso, o ideal por horas vence', () => {
    expect(aplicarMinimoEstrutural(8, 3, 0.5)).toBe(8)
  })
  it('exemplo do Gerente: 10 elementos necessários → garantia de 5, e o ideal por horas (10) continua a vencer', () => {
    expect(aplicarMinimoEstrutural(10, 5, 0.5)).toBe(10)
  })
  it('no limiar exato, fica no valor do piso (empate)', () => {
    expect(aplicarMinimoEstrutural(6, 3, 0.5)).toBe(6)
  })
  it('fração contratual inválida (0) devolve o ideal por horas sem aplicar piso nenhum, em vez de dividir por zero', () => {
    expect(aplicarMinimoEstrutural(3.3, 3, 0)).toBe(3.3)
  })
})

describe('avaliarRiscoEscalaH3 — a escala anual precisa de um mínimo de 3 Operadores H3', () => {
  it('sinaliza risco no limiar exato (3 ativos, sem margem nenhuma)', () => {
    expect(avaliarRiscoEscalaH3(3)).toBe(true)
  })
  it('sinaliza risco abaixo do limiar', () => {
    expect(avaliarRiscoEscalaH3(2)).toBe(true)
  })
  it('não sinaliza risco com margem acima do limiar', () => {
    expect(avaliarRiscoEscalaH3(4)).toBe(false)
  })
})
