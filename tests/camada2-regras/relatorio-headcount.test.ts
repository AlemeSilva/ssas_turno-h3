import { describe, expect, it } from 'vitest'
import { construirDocumentoRelatorioHeadcount, nomeFicheiroRelatorioHeadcount, type EntradaRelatorioHeadcount } from '../../src/lib/relatorio-headcount'
import { construirFabricaMesFechado } from './fixtures-headcount'
import type { HeadcountParametros } from '../../src/types/database'
import type { Content } from 'pdfmake/interfaces'

const mesFechado = construirFabricaMesFechado({
  id: 1,
  volume_pedidos: 200,
  dias_recuperacao_cadeia: 0,
  capacidade_base_horas: 8,
  taxa_eficiencia: 0.85,
  taxa_cobertura_ferias: 0.6,
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
  capacidade_plena_horas_pessoa: 85.68,
  capacidade_plena_horas_equipa: 428.4,
  capacidade_presente_horas_equipa: 400,
  headcount_real_snapshot: 5,
  operador_h3_ativo_snapshot: 3,
  fechado: true,
  fechado_por: 'gerente-id',
  fechado_em: '2026-09-03T10:00:00Z',
  atualizado_por: null,
  atualizado_em: '2026-09-03T10:00:00Z',
  criado_em: '2026-09-01T00:00:00Z',
})

const PARAMETROS: HeadcountParametros = {
  id: true,
  capacidade_base_horas: 8,
  taxa_eficiencia: 0.85,
  taxa_cobertura_ferias: 0.6,
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

function entradaBase(overrides: Partial<EntradaRelatorioHeadcount> = {}): EntradaRelatorioHeadcount {
  const mesesFechados = [mesFechado('2026-08-01'), mesFechado('2026-07-01'), mesFechado('2026-06-01')]
  return {
    mesesJanela: mesesFechados,
    mesesFechados,
    parametros: PARAMETROS,
    headcountRealHoje: 5,
    operadorH3AtivoHoje: 3,
    geradoEm: new Date('2026-09-14T15:30:00'),
    ...overrides,
  }
}

/** Achata uma árvore de Content do pdfmake num único texto, para testes que só
 * precisam de confirmar que uma frase aparece algures — sem depender da
 * estrutura exata dos nós (mais robusto a ajustes de layout). Inclui a cor
 * (color/fillColor) como uma marca de texto "[cor:#xxxxxx]" — sem isto, um
 * mapeamento de cor trocado (ex. verde no lugar de vermelho) passava por
 * todos os testes sem ser detetado (achado de peer-review). */
function achatarTexto(no: unknown): string {
  if (no === null || no === undefined) return ''
  if (typeof no === 'string') return no
  if (typeof no === 'number') return String(no)
  if (Array.isArray(no)) return no.map(achatarTexto).join(' ')
  if (typeof no === 'object') {
    const obj = no as Record<string, unknown>
    const partes: string[] = []
    if ('text' in obj) partes.push(achatarTexto(obj.text))
    if ('columns' in obj) partes.push(achatarTexto(obj.columns))
    if ('stack' in obj) partes.push(achatarTexto(obj.stack))
    if ('table' in obj) {
      const tabela = obj.table as { body?: unknown[][] }
      partes.push(achatarTexto(tabela.body))
    }
    if (typeof obj.color === 'string') partes.push(`[cor:${obj.color}]`)
    if (typeof obj.fillColor === 'string') partes.push(`[fundo:${obj.fillColor}]`)
    return partes.join(' ')
  }
  return ''
}

function textoCompleto(entrada: EntradaRelatorioHeadcount): string {
  const doc = construirDocumentoRelatorioHeadcount(entrada)
  return doc ? achatarTexto(doc.content as Content[]) : ''
}

// Tamanho A4 em pt, só para satisfazer o tipo real de pdfmake
// (ContextPageSize) nas chamadas diretas a header()/footer() abaixo — os
// valores em si não influenciam nenhuma asserção destes testes.
const TAMANHO_PAGINA_A4 = { width: 595.28, height: 841.89, orientation: 'portrait' as const }

describe('construirDocumentoRelatorioHeadcount — guardas (replica calcularHeadcountIdeal, nunca confia no chamador)', () => {
  it('sem meses na janela, devolve null em vez de produzir um documento com NaN', () => {
    expect(construirDocumentoRelatorioHeadcount(entradaBase({ mesesJanela: [] }))).toBeNull()
  })

  it('capacidade plena por pessoa a zero na janela toda devolve null (divisão degenerada)', () => {
    const janelaDegenerada = [mesFechado('2026-08-01', { capacidade_plena_horas_pessoa: 0 })]
    expect(construirDocumentoRelatorioHeadcount(entradaBase({ mesesJanela: janelaDegenerada }))).toBeNull()
  })
})

describe('construirDocumentoRelatorioHeadcount — estrutura do documento', () => {
  it('produz um documento A4 com cabeçalho e rodapé como funções (repetem em cada página)', () => {
    const doc = construirDocumentoRelatorioHeadcount(entradaBase())
    expect(doc?.pageSize).toBe('A4')
    expect(typeof doc?.header).toBe('function')
    expect(typeof doc?.footer).toBe('function')
  })

  it('o cabeçalho inclui o texto exato pedido, com a data e a hora da geração', () => {
    const doc = construirDocumentoRelatorioHeadcount(entradaBase())
    const header = typeof doc?.header === 'function' ? doc.header(1, 1, TAMANHO_PAGINA_A4) : null
    const texto = achatarTexto(header)
    expect(texto).toContain('Calculadora de Headcount')
    expect(texto).toContain('Operação SSAS Montepio')
    expect(texto).toContain('14/09/2026')
    expect(texto).toContain('15:30')
  })

  it('o rodapé mostra "Página X de Y" a partir dos valores recebidos', () => {
    const doc = construirDocumentoRelatorioHeadcount(entradaBase())
    const footer = typeof doc?.footer === 'function' ? doc.footer(2, 5, TAMANHO_PAGINA_A4) : null
    expect(achatarTexto(footer)).toContain('Página 2 de 5')
  })

  it('inclui um título de documento (info.title) — nenhum PDF sem nome para o leitor', () => {
    const doc = construirDocumentoRelatorioHeadcount(entradaBase())
    expect(doc?.info?.title).toBeTruthy()
  })
})

describe('construirDocumentoRelatorioHeadcount — conteúdo factual', () => {
  it('mostra a classificação e o veredito, coerentes com classificarHeadcount', () => {
    // carga 600, capacidade/pessoa 85.68 → ideal por horas = 600/85.68 ≈ 7.0;
    // piso = 3/0.5 = 6 → ideal exato ≈ 7.0; real=5 → sub-dimensionado
    const texto = textoCompleto(entradaBase())
    expect(texto).toContain('Sub-dimensionado')
  })

  it('a cor do veredito nunca fica trocada entre classificações — achado de peer-review (a cobertura anterior não conseguia detetar isto)', () => {
    const textoSub = textoCompleto(entradaBase()) // real=5 vs. ideal≈7.0 → Sub-dimensionado
    expect(textoSub).toContain('Sub-dimensionado')
    expect(textoSub).toContain('[cor:#b91c1c]')
    expect(textoSub).not.toContain('[cor:#047857]')

    const textoAceitavel = textoCompleto(entradaBase({ headcountRealHoje: 7 })) // 7 real vs. ideal≈7.0 → dentro da banda
    expect(textoAceitavel).toContain('Aceitável')
    expect(textoAceitavel).toContain('[cor:#047857]')
    expect(textoAceitavel).not.toContain('[cor:#b91c1c]')
  })

  it('a tabela de parâmetros tem uma linha por cada campo de CAMPOS_PARAMETROS, mais o cabeçalho', () => {
    const doc = construirDocumentoRelatorioHeadcount(entradaBase())
    expect(doc).not.toBeNull()
    const seccaoParametros = (doc!.content as Content[]).find(
      (c) => typeof c === 'object' && c !== null && 'table' in c && achatarTexto((c as { table: { body: unknown[][] } }).table.body[0]).includes('Parâmetro')
    ) as { table: { body: unknown[][] } } | undefined
    expect(seccaoParametros?.table.body.length).toBe(16) // 15 parâmetros (CAMPOS_PARAMETROS) + 1 linha de cabeçalho
  })

  it('a tabela de Histórico usa só os 5 meses mais recentes, mesmo recebendo mais', () => {
    const seteMeses = [
      mesFechado('2026-08-01'),
      mesFechado('2026-07-01'),
      mesFechado('2026-06-01'),
      mesFechado('2026-05-01'),
      mesFechado('2026-04-01'),
      mesFechado('2026-03-01'),
      mesFechado('2026-02-01'),
    ]
    const doc = construirDocumentoRelatorioHeadcount(entradaBase({ mesesFechados: seteMeses }))
    expect(doc).not.toBeNull()
    const seccaoHistorico = (doc!.content as Content[]).find(
      (c) => typeof c === 'object' && c !== null && 'table' in c && achatarTexto((c as { table: { body: unknown[][] } }).table.body[0]).includes('Operador H3')
    ) as { table: { body: unknown[][] } } | undefined
    expect(seccaoHistorico?.table.body.length).toBe(6) // 5 meses + 1 linha de cabeçalho
  })

  it('a tabela de Histórico nunca inclui a coluna de headcount real (pedido explícito do Gerente), e usa o mesmo rótulo "Operador H3" do ecrã', () => {
    const texto = textoCompleto(entradaBase())
    const cabecalhosHistorico = ['Mês', 'Pedidos', 'Carga (h)', 'Operador H3']
    for (const cabecalho of cabecalhosHistorico) expect(texto).toContain(cabecalho)
    expect(texto).not.toContain('Headcount real')
    expect(texto).not.toContain('Turno H3') // achado de peer-review: o rótulo antigo divergia do ecrã
  })

  it('avisa quantos meses estão a ser mostrados quando há mais de 5 fechados, e não avisa quando não há corte', () => {
    const seteMeses = Array.from({ length: 7 }, (_, i) => mesFechado(`2026-${String(8 - i).padStart(2, '0')}-01`))
    const textoComCorte = textoCompleto(entradaBase({ mesesFechados: seteMeses }))
    expect(textoComCorte).toContain('Mostrando os 5 meses mais recentes, de 7 meses já fechados no total.')

    const textoSemCorte = textoCompleto(entradaBase()) // 3 meses por omissão
    expect(textoSemCorte).not.toContain('meses já fechados no total')
  })

  it('mostra "—" em vez de "0" quando carga_horas de um mês do Histórico é null — nunca finge que uma ausência de dados é um valor real', () => {
    const comNulo = [mesFechado('2026-08-01', { carga_horas: null }), mesFechado('2026-07-01'), mesFechado('2026-06-01')]
    const texto = textoCompleto(entradaBase({ mesesFechados: comNulo }))
    expect(texto).toContain('—')
  })

  it('a percentagem de capacidade presente só aparece quando é calculável (guarda replicada de calcularPercentagemCapacidadePresente)', () => {
    const comPresente = textoCompleto(entradaBase())
    expect(comPresente).toContain('Capacidade presente em')

    const semPlena = [mesFechado('2026-08-01', { capacidade_plena_horas_equipa: null }), mesFechado('2026-07-01'), mesFechado('2026-06-01')]
    const semPresente = textoCompleto(entradaBase({ mesesFechados: semPlena }))
    expect(semPresente).not.toContain('Capacidade presente em')
  })

  it('nunca usa a sigla "H3" sem explicar o que o turno significa, na secção de Estado atual', () => {
    const doc = construirDocumentoRelatorioHeadcount(entradaBase())
    expect(doc).not.toBeNull()
    const primeiraSeccao = achatarTexto((doc!.content as Content[]).slice(0, 4))
    expect(primeiraSeccao).toContain('turno H3')
    expect(primeiraSeccao).toContain('cobre fins de semana')
  })

  it('mostra a nota de diferença de arredondamento quando a carga registada não bate com a soma das parcelas', () => {
    // A fixture por omissão usa carga_horas: 600, que não reconcilia com as
    // outras parcelas de Agosto — deliberado, testado explicitamente aqui
    // (achado de peer-review: antes ninguém verificava este texto).
    const texto = textoCompleto(entradaBase())
    expect(texto).toContain('Diferença de arredondamento')
  })

  it('não mostra a nota quando a carga registada bate exatamente com a soma das parcelas calculadas', () => {
    const diasAgosto = 31
    const semanasAgosto = 31 / 7
    const cargaReconciliada = 200 * (40 / 60) + 15 * diasAgosto + (30 / 60) * diasAgosto + 2 * semanasAgosto + 8 + 1 * semanasAgosto + (30 / 60) * 15
    const janela = [mesFechado('2026-08-01', { carga_horas: cargaReconciliada }), mesFechado('2026-07-01'), mesFechado('2026-06-01')]
    const texto = textoCompleto(entradaBase({ mesesJanela: janela }))
    expect(texto).not.toContain('Diferença de arredondamento')
  })

  it('mostra "não aplicável" em vez de "Infinity" quando a garantia contratual é inválida — achado de peer-review', () => {
    const parametrosInvalidos = { ...PARAMETROS, garantia_contratual_fracao: 0 }
    const texto = textoCompleto(entradaBase({ parametros: parametrosInvalidos }))
    expect(texto).toContain('não aplicável')
    expect(texto).not.toContain('Infinity')
  })
})

describe('nomeFicheiroRelatorioHeadcount — nome de ficheiro seguro entre sistemas operativos', () => {
  it('inclui data e hora da geração, sem acentos nem espaços', () => {
    const nome = nomeFicheiroRelatorioHeadcount(new Date('2026-09-14T15:30:00'))
    expect(nome).toBe('Calculadora-Headcount-2026-09-14-15h30.pdf')
    expect(nome).toMatch(/^[A-Za-z0-9-]+\.pdf$/)
  })
})
