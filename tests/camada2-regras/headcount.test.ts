import { describe, expect, it } from 'vitest'
import {
  aplicarMinimoEstrutural,
  avaliarRiscoEscalaH3,
  calcularEstadoHeadcountAtual,
  calcularHeadcountIdeal,
  calcularPercentagemCapacidadePresente,
  calcularPisoEstrutural,
  classificarHeadcount,
  construirHistoriaEquipa,
  decomporCalculoMes,
  mediasJanela,
} from '../../src/lib/headcount'
import type { HeadcountMensal, HeadcountParametros } from '../../src/types/database'

const PARAMETROS_BASE: HeadcountParametros = {
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

// Fixture de um só argumento (sem mes_referencia) — a maioria dos testes
// deste ficheiro nunca varia o mês, por isso não usa a fábrica partilhada
// de tests/camada2-regras/fixtures-headcount.ts (essa exige o mês como
// primeiro argumento sempre). Diferença de conveniência deliberada, não
// divergência não examinada — ver o comentário nesse ficheiro.
function mesFechado(overrides: Partial<HeadcountMensal>): HeadcountMensal {
  return {
    id: 1,
    mes_referencia: '2026-08-01',
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

describe('mediasJanela — médias de carga e capacidade separadas, reaproveitadas por calcularHeadcountIdeal e pelo ecrã "Ver Cálculo"', () => {
  it('devolve null sem nenhum mês fechado', () => {
    expect(mediasJanela([])).toBeNull()
  })
  it('faz a média da carga e da capacidade separadamente, cada uma com o seu próprio valor', () => {
    const medias = mediasJanela([
      mesFechado({ carga_horas: 600, capacidade_plena_horas_pessoa: 200 }),
      mesFechado({ carga_horas: 900, capacidade_plena_horas_pessoa: 180 }),
    ])
    expect(medias?.cargaMedia).toBe(750)
    expect(medias?.capacidadeMedia).toBe(190)
  })
})

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

describe('calcularPisoEstrutural — a mesma guarda de aplicarMinimoEstrutural, isolada para quem só precisa de mostrar o número (ex.: o relatório PDF)', () => {
  it('calcula o piso normalmente com uma fração válida', () => {
    expect(calcularPisoEstrutural(3, 0.5)).toBe(6)
  })
  it('devolve null (não Infinity nem NaN) com fração zero — achado de peer-review: o relatório PDF recalculava isto sem esta guarda', () => {
    expect(calcularPisoEstrutural(3, 0)).toBeNull()
  })
  it('devolve null também com fração negativa', () => {
    expect(calcularPisoEstrutural(3, -0.1)).toBeNull()
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

describe('calcularEstadoHeadcountAtual — fonte única partilhada por HeadcountPage e pelo relatório PDF (achado de peer-review: antes cada um reimplementava a mesma sequência à parte)', () => {
  it('encadeia médias → ideal por horas → piso → classificação, de forma consistente com as funções individuais', () => {
    // capacidade alta de propósito (2000) para o ideal por horas (0.3) ficar
    // bem abaixo do piso (6) e não interferir com o teste do piso, abaixo.
    const janela = [mesFechado({ carga_horas: 600, capacidade_plena_horas_pessoa: 2000 })]
    const estado = calcularEstadoHeadcountAtual(janela, 6, PARAMETROS_BASE)
    expect(estado.medias).toEqual({ cargaMedia: 600, capacidadeMedia: 2000 })
    expect(estado.idealPorHoras).toBe(0.3) // 600/2000
    expect(estado.idealExato).toBe(6) // piso = 3/0.5 = 6, vence porque 6 > 0.3
    expect(estado.classificacao).toBe(classificarHeadcount(6, estado.idealExato!, PARAMETROS_BASE.banda_tolerancia_pessoas))
  })

  it('sem meses fechados, tudo fica null em cascata — nunca NaN', () => {
    const estado = calcularEstadoHeadcountAtual([], 5, PARAMETROS_BASE)
    expect(estado.medias).toBeNull()
    expect(estado.idealPorHoras).toBeNull()
    expect(estado.idealExato).toBeNull()
    expect(estado.classificacao).toBeNull()
  })

  it('o piso estrutural vence quando o ideal por horas fica abaixo do mínimo contratual', () => {
    const janela = [mesFechado({ carga_horas: 600, capacidade_plena_horas_pessoa: 200 })] // ideal por horas = 3
    const estado = calcularEstadoHeadcountAtual(janela, 3, PARAMETROS_BASE) // piso = 3/0.5 = 6
    expect(estado.idealPorHoras).toBe(3)
    expect(estado.idealExato).toBe(6)
  })
})

describe('decomporCalculoMes — espelha termo a termo a fórmula de calcular_headcount() (SQL), para o ecrã "Ver Cálculo"', () => {
  // Fevereiro de um ano não-bissexto: 28 dias, 4 semanas exatas — evita
  // dízima periódica nas asserções (só o termo de pedidos tem uma, por
  // causa de 40/60, comum a qualquer mês). diasUteisFev é o valor real
  // (validado contra a BD: Fevereiro/2026 tem 19 dias úteis sem
  // feriado) — deliberadamente diferente de diasFev, para o teste
  // provar que a capacidade usa dias úteis e não dias corridos.
  const diasFev = 28
  const semanasFev = 4
  const diasUteisFev = 19
  const volumePedidos = 200
  const tempoMedioPedidoMinutos = 40
  const batchHorasDia = 15
  const olhoVivoMinutosDia = 30
  const prepFimSemanaHorasSemana = 2
  const imparidadeCalendarioHoras = 8
  const imparidadeExecucaoHorasSemana = 1
  const imparidadeReportesMinutosDia = 30
  const imparidadeReportesDiasMes = 15
  const capacidadeBaseHoras = 8
  const taxaEficiencia = 0.85
  const taxaCoberturaFerias = 0.9

  // Carga e capacidade calculadas exatamente como calcular_headcount()
  // (SQL) — não valores redondos arbitrários — para que o mês seja
  // internamente consistente, como um mês fechado de verdade.
  const cargaEsperada =
    volumePedidos * (tempoMedioPedidoMinutos / 60) +
    batchHorasDia * diasFev +
    (olhoVivoMinutosDia / 60) * diasFev +
    prepFimSemanaHorasSemana * semanasFev +
    imparidadeCalendarioHoras +
    imparidadeExecucaoHorasSemana * semanasFev +
    (imparidadeReportesMinutosDia / 60) * imparidadeReportesDiasMes
  // + recuperação de cadeia × 24h — fixture usa 0 dias, por isso não entra na soma.
  const capacidadeEsperada = diasUteisFev * capacidadeBaseHoras * taxaEficiencia * taxaCoberturaFerias

  const mes = mesFechado({
    mes_referencia: '2026-02-01',
    volume_pedidos: volumePedidos,
    tempo_medio_pedido_minutos: tempoMedioPedidoMinutos,
    batch_horas_dia: batchHorasDia,
    olho_vivo_minutos_dia: olhoVivoMinutosDia,
    prep_fim_semana_horas_semana: prepFimSemanaHorasSemana,
    imparidade_calendario_horas: imparidadeCalendarioHoras,
    imparidade_execucao_horas_semana: imparidadeExecucaoHorasSemana,
    imparidade_reportes_minutos_dia: imparidadeReportesMinutosDia,
    imparidade_reportes_dias_mes: imparidadeReportesDiasMes,
    dias_recuperacao_cadeia: 0,
    capacidade_base_horas: capacidadeBaseHoras,
    taxa_eficiencia: taxaEficiencia,
    taxa_cobertura_ferias: taxaCoberturaFerias,
    carga_horas: cargaEsperada,
    dias_uteis: diasUteisFev,
    capacidade_plena_horas_pessoa: capacidadeEsperada,
  })

  it('dias corridos e semanas vêm do calendário do próprio mês (Fevereiro, não-bissexto) — dias úteis vêm do valor já congelado', () => {
    const dec = decomporCalculoMes(mes)
    expect(dec.diasCorridos).toBe(28)
    expect(dec.semanas).toBe(4)
    expect(dec.diasUteis).toBe(19)
  })

  it('cada parcela bate com a fórmula de calcular_headcount()', () => {
    const dec = decomporCalculoMes(mes)
    const porChave = Object.fromEntries(dec.parcelasCarga.map((p) => [p.chave, p.valor]))
    expect(porChave.pedidos).toBeCloseTo(200 * (40 / 60), 10)
    expect(porChave.batch).toBe(15 * 28)
    expect(porChave.olho_vivo).toBe((30 / 60) * 28)
    expect(porChave.prep_fim_semana).toBe(2 * 4)
    expect(porChave.imparidade_calendario).toBe(8)
    expect(porChave.imparidade_execucao).toBe(1 * 4)
    expect(porChave.imparidade_reportes).toBe((30 / 60) * 15)
    expect(porChave.recuperacao_cadeia).toBe(0)
  })

  it('a soma das 8 parcelas reproduz a carga registada de um mês internamente consistente', () => {
    const dec = decomporCalculoMes(mes)
    expect(dec.somaParcelasCarga).toBeCloseTo(dec.cargaRegistada, 10)
    expect(dec.somaParcelasCarga).toBeCloseTo(cargaEsperada, 10)
  })

  it('a capacidade calculada reproduz a capacidade registada — usa dias úteis (19), não dias corridos (28)', () => {
    const dec = decomporCalculoMes(mes)
    expect(dec.capacidadeCalculada).toBeCloseTo(dec.capacidadeRegistada, 10)
    expect(dec.capacidadeCalculada).toBe(19 * 8 * 0.85 * 0.9)
    expect(dec.capacidadeCalculada).not.toBeCloseTo(28 * 8 * 0.85 * 0.9, 1)
  })

  it('mês sem dias_uteis congelado (linha antiga) dá capacidade 0 em vez de usar dias corridos por engano', () => {
    const dec = decomporCalculoMes({ ...mes, dias_uteis: null })
    expect(dec.diasUteis).toBe(0)
    expect(dec.capacidadeCalculada).toBe(0)
  })

  it('recuperação de cadeia usa sempre 24h por dia', () => {
    const dec = decomporCalculoMes({ ...mes, dias_recuperacao_cadeia: 3 })
    const porChave = Object.fromEntries(dec.parcelasCarga.map((p) => [p.chave, p.valor]))
    expect(porChave.recuperacao_cadeia).toBe(3 * 24)
  })
})

describe('construirHistoriaEquipa — narrativa funcional da janela de tendência (nível leigo), para o relatório PDF', () => {
  it('sem nenhum mês fechado, devolve null', () => {
    expect(construirHistoriaEquipa([], 5)).toBeNull()
  })

  it('achado do stress-test: um pico no mês do MEIO da janela é identificado — comparar só as pontas (mais antigo vs. mais recente) escondia-o', () => {
    const janela = [
      mesFechado({ mes_referencia: '2026-08-01', capacidade_plena_horas_pessoa: 100 }), // mais recente
      mesFechado({ mes_referencia: '2026-07-01', capacidade_plena_horas_pessoa: 140 }), // meio — o pico real
      mesFechado({ mes_referencia: '2026-06-01', capacidade_plena_horas_pessoa: 110 }), // mais antigo
    ]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCapacidade).toContain('140h')
    expect(historia?.paragrafoCapacidade).toContain('Julho')
  })

  it('o mesmo vale para a carga — um vale no mês do meio da janela é identificado, não só as pontas', () => {
    const janela = [
      mesFechado({ mes_referencia: '2026-08-01', carga_horas: 660 }), // mais recente
      mesFechado({ mes_referencia: '2026-07-01', carga_horas: 500 }), // meio — o vale real
      mesFechado({ mes_referencia: '2026-06-01', carga_horas: 650 }), // mais antigo
    ]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCarga).toContain('500h')
    expect(historia?.paragrafoCarga).toContain('Julho')
  })

  it('variação inferior a 3% descreve-se como estável, não como subida — limiar relativo, não absoluto (o mesmo padrão dos números reais de Jun-Ago/2026 que motivou esta correção)', () => {
    const janela = [mesFechado({ mes_referencia: '2026-08-01', carga_horas: 663 }), mesFechado({ mes_referencia: '2026-06-01', carga_horas: 657 })]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCarga).toContain('estável')
    expect(historia?.paragrafoCarga).not.toContain('variou entre')
  })

  it('variação de 3% ou mais nomeia os meses do mínimo e do máximo, e menciona sempre o headcount real de hoje', () => {
    const janela = [mesFechado({ mes_referencia: '2026-08-01', carga_horas: 800 }), mesFechado({ mes_referencia: '2026-06-01', carga_horas: 600 })]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCarga).toContain('variou entre')
    expect(historia?.paragrafoCarga).toContain('600h')
    expect(historia?.paragrafoCarga).toContain('Junho')
    expect(historia?.paragrafoCarga).toContain('800h')
    expect(historia?.paragrafoCarga).toContain('Agosto')
    expect(historia?.paragrafoCapacidade).toContain('Hoje, a equipa conta com 5 pessoas')
  })

  it('janela com um único mês usa frase própria, sem comparar duas pontas', () => {
    const janela = [mesFechado({ mes_referencia: '2026-08-01', carga_horas: 663 })]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCarga).toContain('Agosto')
    expect(historia?.paragrafoCarga).toContain('663h')
    expect(historia?.paragrafoCarga).not.toContain('variou entre')
    expect(historia?.paragrafoCarga).not.toContain('manteve-se estável, entre')
  })

  it('nomeia a maior parcela de carga do mês mais recente, quando houver uma parcela dominante', () => {
    const janela = [mesFechado({ mes_referencia: '2026-08-01', volume_pedidos: 100000, tempo_medio_pedido_minutos: 60 })]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCarga).toContain('a maior parcela foi Pedidos')
  })

  it('não nomeia parcela nenhuma se todas as parcelas de carga forem zero — evita "Pedidos (0h)" sem sentido', () => {
    const janela = [
      mesFechado({
        mes_referencia: '2026-08-01',
        volume_pedidos: 0,
        batch_horas_dia: 0,
        olho_vivo_minutos_dia: 0,
        prep_fim_semana_horas_semana: 0,
        imparidade_calendario_horas: 0,
        imparidade_execucao_horas_semana: 0,
        imparidade_reportes_minutos_dia: 0,
        imparidade_reportes_dias_mes: 0,
        dias_recuperacao_cadeia: 0,
      }),
    ]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCarga).not.toContain('a maior parcela foi')
  })

  it('menciona a percentagem de reserva de férias, calculada a partir do parâmetro do mês mais recente', () => {
    const janela = [mesFechado({ mes_referencia: '2026-08-01', taxa_cobertura_ferias: 0.6 })]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCapacidade).toContain('reserva 40%')
  })

  it('omite a frase de reserva de férias quando o parâmetro é 1 (sem reserva nenhuma)', () => {
    const janela = [mesFechado({ mes_referencia: '2026-08-01', taxa_cobertura_ferias: 1 })]
    const historia = construirHistoriaEquipa(janela, 5)
    expect(historia?.paragrafoCapacidade).not.toContain('reserva')
  })
})
