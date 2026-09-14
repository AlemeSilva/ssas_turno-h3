// Construtor puro do documento do relatório PDF de Headcount — nunca importa
// 'pdfmake' (só os TIPOS, apagados em tempo de compilação). A biblioteca em
// si só é usada em src/lib/relatorio-headcount-pdf.ts, importada de forma
// dinâmica a partir do clique no botão — para nunca pesar no resto da
// aplicação. Ver [[project_headcount_ideal]] (memória) para o racional
// completo das decisões de conteúdo e layout.

import {
  avaliarRiscoEscalaH3,
  calcularEstadoHeadcountAtual,
  calcularPercentagemCapacidadePresente,
  calcularPisoEstrutural,
  CAMPOS_PARAMETROS,
  construirHistoriaEquipa,
  decomporCalculoMes,
  formatarMesAnoDeReferencia,
  fraseVeredicto,
  PARCELAS_CARGA_INFO,
  type ClassificacaoHeadcount,
} from './headcount'
import { formatarDataPT, paraISO } from './datas'
import type { HeadcountMensal, HeadcountParametros } from '@/types/database'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'

export interface EntradaRelatorioHeadcount {
  mesesJanela: HeadcountMensal[]
  mesesFechados: HeadcountMensal[]
  parametros: HeadcountParametros
  headcountRealHoje: number
  operadorH3AtivoHoje: number
  geradoEm: Date
}

// Cores em hex, não classes Tailwind — pdfmake não interpreta CSS. Mesma
// paleta e mesmo significado de ROTULO_CLASSIFICACAO (HeadcountPage.tsx,
// emerald/amber/red — 50 para o fundo, 700 para o texto): duplicado
// deliberadamente, mesmo padrão já usado nos outros dois diálogos que
// também precisam da sua própria cópia (HeadcountCenariosDialog,
// HeadcountExplicacaoDialog). Se a paleta de HeadcountPage.tsx mudar,
// replicar aqui manualmente — é a única forma de aplicar a mesma cor num
// motor de PDF que não lê Tailwind.
const CLASSIFICACAO_PDF: Record<ClassificacaoHeadcount, { texto: string; corTexto: string; corFundo: string }> = {
  ACEITAVEL: { texto: 'Aceitável', corTexto: '#047857', corFundo: '#ecfdf5' },
  SOBRE_DIMENSIONADO: { texto: 'Sobre-dimensionado', corTexto: '#b45309', corFundo: '#fffbeb' },
  SUB_DIMENSIONADO: { texto: 'Sub-dimensionado', corTexto: '#b91c1c', corFundo: '#fef2f2' },
}

const COR_TEXTO_PRINCIPAL = '#18181b'
const COR_TEXTO_SECUNDARIO = '#52525b'
const COR_LINHA = '#e4e4e7'
const COR_CARGA = '#b45309'
const COR_CAPACIDADE = '#0369a1'

function formatarHoraPT(d: Date): string {
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

/** Nome de ficheiro sem acentos nem espaços — evita problemas de download entre sistemas operativos. */
export function nomeFicheiroRelatorioHeadcount(geradoEm: Date): string {
  const hora = `${String(geradoEm.getHours()).padStart(2, '0')}h${String(geradoEm.getMinutes()).padStart(2, '0')}`
  return `Calculadora-Headcount-${paraISO(geradoEm)}-${hora}.pdf`
}

function tituloSeccao(texto: string, comQuebraDePagina: boolean): Content {
  return {
    text: texto,
    style: 'tituloSeccao',
    margin: [0, comQuebraDePagina ? 0 : 18, 0, 8] as [number, number, number, number],
    pageBreak: comQuebraDePagina ? 'before' : undefined,
  }
}

/**
 * Título de secção + o(s) bloco(s) seguinte(s), sempre com a combinação
 * certa de página/quebra — nunca deixado ao critério de cada chamador.
 * Quando NÃO há quebra de página forçada, o título é colado ao(s) bloco(s)
 * seguinte(s) num stack "unbreakable", para nunca ficar sozinho no fundo de
 * uma página (achado ao inspecionar um PDF real). Quando HÁ quebra de
 * página forçada, o título já começa sempre no topo de uma página nova por
 * si só — não entra num stack unbreakable, porque combinar as duas coisas
 * confundiu o motor de paginação do pdfmake e produziu páginas em branco
 * (também achado ao inspecionar um PDF real). Antes, cada secção decidia
 * esta combinação à mão; um 6º caso podia facilmente escolher mal — agora é
 * estruturalmente impossível, a própria função decide a partir do mesmo
 * boolean.
 */
function seccaoComTitulo(titulo: string, comQuebraDePagina: boolean, ...blocosSeguintes: Content[]): Content[] {
  const tituloNode = tituloSeccao(titulo, comQuebraDePagina)
  if (comQuebraDePagina) return [tituloNode, ...blocosSeguintes]
  return [{ stack: [tituloNode, ...blocosSeguintes], unbreakable: true }]
}

function construirSeccaoEstadoAtual(
  classificacao: ClassificacaoHeadcount,
  headcountRealHoje: number,
  idealExato: number,
  banda: number,
  operadorH3AtivoHoje: number,
  riscoH3: boolean,
  ultimoFechado: HeadcountMensal | undefined,
  pctPresente: number | null
): Content[] {
  const info = CLASSIFICACAO_PDF[classificacao]
  const linhaH3 = riscoH3
    ? `Aviso: a equipa fixa do turno H3 (o turno que também cobre fins de semana e feriados) está com ${operadorH3AtivoHoje} de 3 elementos mínimos.`
    : `Elementos no turno H3 (equipa fixa que também cobre fins de semana e feriados): ${operadorH3AtivoHoje}.`

  const linhaResumo: Content = {
    columns: [
      {
        text: info.texto,
        bold: true,
        fontSize: 13,
        color: info.corTexto,
        fillColor: info.corFundo,
        margin: [8, 4, 8, 4] as [number, number, number, number],
        width: 'auto',
      },
      {
        text: `Equipa real: ${headcountRealHoje}   ·   Ideal: ${idealExato.toFixed(1)} pessoas   ·   Tolerância: ±${banda}`,
        fontSize: 10,
        color: COR_TEXTO_SECUNDARIO,
        margin: [10, 8, 0, 0] as [number, number, number, number],
      },
    ],
    columnGap: 10,
  }

  const linhas: Content[] = [
    { text: fraseVeredicto(classificacao, headcountRealHoje, idealExato, banda), fontSize: 10, color: COR_TEXTO_SECUNDARIO, margin: [0, 8, 0, 0] as [number, number, number, number] },
    { text: linhaH3, fontSize: 10, color: COR_TEXTO_SECUNDARIO, margin: [0, 6, 0, 0] as [number, number, number, number] },
  ]

  if (ultimoFechado && pctPresente !== null) {
    linhas.push({
      text: `Capacidade presente em ${formatarMesAnoDeReferencia(ultimoFechado.mes_referencia)}: ${pctPresente.toFixed(0)}% da capacidade plena planeada.`,
      fontSize: 10,
      color: COR_TEXTO_SECUNDARIO,
      margin: [0, 6, 0, 0] as [number, number, number, number],
    })
  }

  return [...seccaoComTitulo('Estado atual', false, linhaResumo), ...linhas]
}

function construirSeccaoHistoria(historia: { paragrafoCarga: string; paragrafoCapacidade: string }): Content[] {
  const paragrafoCarga: Content = { text: historia.paragrafoCarga, fontSize: 10, color: COR_TEXTO_PRINCIPAL, margin: [0, 0, 0, 6] as [number, number, number, number] }
  const paragrafoCapacidade: Content = { text: historia.paragrafoCapacidade, fontSize: 10, color: COR_TEXTO_PRINCIPAL }
  return [...seccaoComTitulo('Leitura da situação', false, paragrafoCarga), paragrafoCapacidade]
}

function construirSeccaoParametros(parametros: HeadcountParametros): Content[] {
  const corpo = CAMPOS_PARAMETROS.map((campo) => [
    { text: campo.rotulo, fontSize: 9, bold: true, color: COR_TEXTO_PRINCIPAL },
    { text: String(parametros[campo.chave]), fontSize: 9, color: COR_TEXTO_PRINCIPAL, alignment: 'right' as const },
    { text: campo.descricao, fontSize: 8.5, color: COR_TEXTO_SECUNDARIO },
  ])

  const nota: Content = { text: 'Valores em vigor no momento da geração deste relatório.', fontSize: 9, italics: true, color: COR_TEXTO_SECUNDARIO, margin: [0, 0, 0, 8] as [number, number, number, number] }

  return [
    ...seccaoComTitulo('Parâmetros', true, nota),
    {
      table: {
        headerRows: 1,
        widths: [140, 55, '*'],
        dontBreakRows: true,
        body: [
          [
            { text: 'Parâmetro', style: 'cabecalhoTabela' },
            { text: 'Valor', style: 'cabecalhoTabela', alignment: 'right' as const },
            { text: 'O que significa', style: 'cabecalhoTabela' },
          ],
          ...corpo,
        ],
      },
      layout: linhasFinas,
    },
  ]
}

function construirSeccaoIdeal(
  mesesJanela: HeadcountMensal[],
  medias: { cargaMedia: number; capacidadeMedia: number },
  idealPorHoras: number,
  parametros: HeadcountParametros,
  idealExato: number
): Content[] {
  const piso = calcularPisoEstrutural(parametros.minimo_turnos_criticos, parametros.garantia_contratual_fracao)
  const pisoVenceu = piso !== null && piso > idealPorHoras

  const corpo = mesesJanela.map((m) => [
    { text: formatarMesAnoDeReferencia(m.mes_referencia), fontSize: 9, color: COR_TEXTO_PRINCIPAL },
    { text: (m.carga_horas ?? 0).toFixed(1), fontSize: 9, color: COR_CARGA, alignment: 'right' as const },
    { text: (m.capacidade_plena_horas_pessoa ?? 0).toFixed(1), fontSize: 9, color: COR_CAPACIDADE, alignment: 'right' as const },
  ])

  const nota: Content = {
    text: 'Média da carga e da capacidade plena por pessoa dos meses fechados mais recentes, comparada com a equipa real de hoje.',
    fontSize: 9,
    italics: true,
    color: COR_TEXTO_SECUNDARIO,
    margin: [0, 0, 0, 8] as [number, number, number, number],
  }
  const tabela: Content = {
    table: {
      headerRows: 1,
      widths: ['*', 100, 140],
      dontBreakRows: true,
      body: [
        [
          { text: 'Mês', style: 'cabecalhoTabela' },
          { text: 'Carga (h)', style: 'cabecalhoTabela', alignment: 'right' as const },
          { text: 'Capacidade plena / pessoa (h)', style: 'cabecalhoTabela', alignment: 'right' as const },
        ],
        ...corpo,
        [
          { text: 'Média', fontSize: 9, bold: true, color: COR_TEXTO_PRINCIPAL },
          { text: medias.cargaMedia.toFixed(1), fontSize: 9, bold: true, color: COR_CARGA, alignment: 'right' as const },
          { text: medias.capacidadeMedia.toFixed(1), fontSize: 9, bold: true, color: COR_CAPACIDADE, alignment: 'right' as const },
        ],
      ],
    },
    layout: linhasFinas,
  }

  return [
    ...seccaoComTitulo('Como se chega ao Ideal', false, nota, tabela),
    {
      text: [
        { text: 'Ideal por horas = Carga média ÷ Capacidade média = ' },
        { text: `${medias.cargaMedia.toFixed(1)} ÷ ${medias.capacidadeMedia.toFixed(1)} = ${idealPorHoras.toFixed(2)} pessoas`, bold: true },
      ],
      fontSize: 9.5,
      color: COR_TEXTO_PRINCIPAL,
      margin: [0, 10, 0, 3] as [number, number, number, number],
    },
    {
      text: [
        { text: 'Piso estrutural = Mínimo turnos críticos ÷ Garantia contratual = ' },
        piso !== null
          ? { text: `${parametros.minimo_turnos_criticos} ÷ ${parametros.garantia_contratual_fracao} = ${piso.toFixed(2)} pessoas`, bold: true }
          : { text: 'não aplicável (garantia contratual inválida)', italics: true },
      ],
      fontSize: 9.5,
      color: COR_TEXTO_PRINCIPAL,
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
    {
      text: [
        { text: 'Ideal exato = maior dos dois = ' },
        { text: `${idealExato.toFixed(1)} pessoas`, bold: true },
        { text: `. Neste caso, ${pisoVenceu ? 'o piso estrutural venceu' : 'o cálculo por horas venceu'}.` },
      ],
      fontSize: 9.5,
      color: COR_TEXTO_PRINCIPAL,
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
    {
      text: 'Os valores acima aparecem arredondados a 1-2 casas decimais para facilitar a leitura; os cálculos usam sempre precisão total, por isso refazer a conta à mão a partir dos números arredondados pode dar um último dígito diferente.',
      fontSize: 8,
      italics: true,
      color: COR_TEXTO_SECUNDARIO,
      margin: [0, 4, 0, 0] as [number, number, number, number],
    },
  ]
}

function construirSeccaoCarga(mesRecente: HeadcountMensal, decomposicao: ReturnType<typeof decomporCalculoMes>): Content[] {
  const corpo = decomposicao.parcelasCarga.map((p) => [
    { text: PARCELAS_CARGA_INFO[p.chave].rotulo, fontSize: 9, color: COR_TEXTO_PRINCIPAL },
    { text: PARCELAS_CARGA_INFO[p.chave].formula(mesRecente, decomposicao.diasCorridos, decomposicao.semanas), fontSize: 8.5, color: COR_TEXTO_SECUNDARIO },
    { text: `${p.valor.toFixed(1)}h`, fontSize: 9, bold: true, color: COR_CARGA, alignment: 'right' as const },
  ])

  const diferenca = Math.abs(decomposicao.somaParcelasCarga - decomposicao.cargaRegistada)

  const tabela: Content = {
    table: {
      headerRows: 1,
      widths: [130, '*', 70],
      dontBreakRows: true,
      body: [
        [
          { text: 'Parcela', style: 'cabecalhoTabela' },
          { text: 'Como se calcula', style: 'cabecalhoTabela' },
          { text: 'Valor', style: 'cabecalhoTabela', alignment: 'right' as const },
        ],
        ...corpo,
      ],
    },
    layout: linhasFinas,
  }

  const conteudo: Content[] = [
    ...seccaoComTitulo(`Como se chega à Carga de ${formatarMesAnoDeReferencia(mesRecente.mes_referencia)}`, false, tabela),
    {
      columns: [
        { text: 'Soma das parcelas', fontSize: 9.5, color: COR_TEXTO_PRINCIPAL },
        { text: `${decomposicao.somaParcelasCarga.toFixed(1)}h`, fontSize: 9.5, bold: true, color: COR_CARGA, alignment: 'right' as const },
      ],
      margin: [0, 8, 0, 2] as [number, number, number, number],
    },
    {
      columns: [
        { text: 'Carga oficial registada', fontSize: 9.5, color: COR_TEXTO_PRINCIPAL },
        { text: `${decomposicao.cargaRegistada.toFixed(1)}h`, fontSize: 9.5, bold: true, color: COR_TEXTO_PRINCIPAL, alignment: 'right' as const },
      ],
    },
    {
      text: 'As parcelas acima aparecem arredondadas a 1 casa decimal; a soma usa sempre os valores com precisão total, por isso pode não bater exatamente com a soma das parcelas arredondadas.',
      fontSize: 8,
      italics: true,
      color: COR_TEXTO_SECUNDARIO,
      margin: [0, 4, 0, 0] as [number, number, number, number],
    },
  ]

  if (diferenca > 0.05) {
    conteudo.push({
      text: `Diferença de arredondamento entre o detalhe calculado aqui e o valor oficial gravado no fecho do mês: ${diferenca.toFixed(2)}h. O valor oficial é sempre o que conta para o Ideal.`,
      fontSize: 8,
      italics: true,
      color: COR_TEXTO_SECUNDARIO,
      margin: [0, 2, 0, 0] as [number, number, number, number],
    })
  }

  return conteudo
}

function construirSeccaoCapacidade(mesRecente: HeadcountMensal, decomposicao: ReturnType<typeof decomporCalculoMes>): Content[] {
  const diferenca = Math.abs(decomposicao.capacidadeCalculada - decomposicao.capacidadeRegistada)

  const formula: Content = {
    columns: [
      {
        text: `${decomposicao.diasUteis} dias úteis (excluindo fins de semana e feriados) × ${mesRecente.capacidade_base_horas ?? 0}h/dia × ${mesRecente.taxa_eficiencia ?? 0} de eficiência × ${mesRecente.taxa_cobertura_ferias ?? 0} de cobertura de férias`,
        fontSize: 9,
        color: COR_TEXTO_PRINCIPAL,
      },
      { text: `${decomposicao.capacidadeCalculada.toFixed(1)}h`, fontSize: 9, bold: true, color: COR_CAPACIDADE, alignment: 'right' as const, width: 70 },
    ],
    margin: [0, 0, 0, 6] as [number, number, number, number],
  }

  const conteudo: Content[] = [
    ...seccaoComTitulo(`Como se chega à Capacidade plena por pessoa de ${formatarMesAnoDeReferencia(mesRecente.mes_referencia)}`, false, formula),
    {
      text: `${decomposicao.diasCorridos} dias no calendário do mês, dos quais ${decomposicao.diasUteis} são dias úteis. Ao fim de semana, só a equipa fixa do turno H3 trabalha; feriados a meio da semana são cobertos por essa mesma equipa, reforçada por mais um elemento em regime de disponibilidade, até ao final do ciclo diário de processamento.`,
      fontSize: 8.5,
      italics: true,
      color: COR_TEXTO_SECUNDARIO,
      margin: [0, 0, 0, 8] as [number, number, number, number],
    },
    {
      columns: [
        { text: 'Capacidade oficial registada', fontSize: 9.5, color: COR_TEXTO_PRINCIPAL },
        { text: `${decomposicao.capacidadeRegistada.toFixed(1)}h`, fontSize: 9.5, bold: true, color: COR_TEXTO_PRINCIPAL, alignment: 'right' as const },
      ],
    },
  ]

  if (diferenca > 0.05) {
    conteudo.push({
      text: `Diferença de arredondamento entre o detalhe calculado aqui e o valor oficial gravado no fecho do mês: ${diferenca.toFixed(2)}h. O valor oficial é sempre o que conta para o Ideal.`,
      fontSize: 8,
      italics: true,
      color: COR_TEXTO_SECUNDARIO,
      margin: [0, 4, 0, 0] as [number, number, number, number],
    })
  }

  return conteudo
}

function construirSeccaoHistorico(mesesFechados: HeadcountMensal[]): Content[] {
  const totalFechados = mesesFechados.length
  const corpo = mesesFechados.slice(0, 5).map((m) => [
    { text: formatarMesAnoDeReferencia(m.mes_referencia), fontSize: 9, color: COR_TEXTO_PRINCIPAL },
    { text: String(m.volume_pedidos ?? '—'), fontSize: 9, color: COR_TEXTO_PRINCIPAL, alignment: 'right' as const },
    { text: m.carga_horas !== null ? m.carga_horas.toFixed(0) : '—', fontSize: 9, color: COR_TEXTO_PRINCIPAL, alignment: 'right' as const },
    { text: String(m.operador_h3_ativo_snapshot ?? '—'), fontSize: 9, color: COR_TEXTO_PRINCIPAL, alignment: 'right' as const },
  ])

  const nota: Content = {
    text:
      totalFechados > 5
        ? `Mostrando os 5 meses mais recentes, de ${totalFechados} meses já fechados no total.`
        : 'Últimos meses já fechados, para referência.',
    fontSize: 9,
    italics: true,
    color: COR_TEXTO_SECUNDARIO,
    margin: [0, 0, 0, 8] as [number, number, number, number],
  }

  return [
    ...seccaoComTitulo('Histórico', true, nota),
    {
      table: {
        headerRows: 1,
        widths: ['*', 70, 80, 70],
        dontBreakRows: true,
        body: [
          [
            { text: 'Mês', style: 'cabecalhoTabela' },
            { text: 'Pedidos', style: 'cabecalhoTabela', alignment: 'right' as const },
            { text: 'Carga (h)', style: 'cabecalhoTabela', alignment: 'right' as const },
            { text: 'Operador H3', style: 'cabecalhoTabela', alignment: 'right' as const },
          ],
          ...corpo,
        ],
      },
      layout: linhasFinas,
    },
  ]
}

const linhasFinas = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => COR_LINHA,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

/**
 * Constrói o documento inteiro do relatório PDF — recalcula tudo a partir
 * dos dados já fechados/parâmetros através de calcularEstadoHeadcountAtual
 * (nunca aceita valores pré-computados de fora, nem duplica essa sequência
 * à parte — fonte única partilhada com HeadcountPage), para nunca produzir
 * "NaN"/"Infinity" nem divergir do veredito mostrado no ecrã.
 */
export function construirDocumentoRelatorioHeadcount(entrada: EntradaRelatorioHeadcount): TDocumentDefinitions | null {
  const { mesesJanela, mesesFechados, parametros, headcountRealHoje, operadorH3AtivoHoje, geradoEm } = entrada

  const estado = calcularEstadoHeadcountAtual(mesesJanela, headcountRealHoje, parametros)
  if (estado.medias === null || estado.idealPorHoras === null || estado.idealExato === null || estado.classificacao === null) return null

  // mesesJanela.length > 0 é garantido pelo guard acima (medias só é null
  // com janela vazia) — decompõe-se aqui, uma única vez, e passa-se adiante
  // para construirHistoriaEquipa em vez de deixá-la recalcular por si.
  const mesRecente = mesesJanela[0]
  const decomposicao = decomporCalculoMes(mesRecente)
  const historia = construirHistoriaEquipa(mesesJanela, headcountRealHoje, decomposicao)
  if (historia === null) return null

  const riscoH3 = avaliarRiscoEscalaH3(operadorH3AtivoHoje)
  const ultimoFechado = mesesFechados[0]
  const pctPresente = ultimoFechado ? calcularPercentagemCapacidadePresente(ultimoFechado) : null

  const cabecalho = `Calculadora de Headcount  |  Operação SSAS Montepio  |  ${formatarDataPT(paraISO(geradoEm))}  |  ${formatarHoraPT(geradoEm)}`

  const content: Content[] = [
    ...construirSeccaoEstadoAtual(estado.classificacao, headcountRealHoje, estado.idealExato, parametros.banda_tolerancia_pessoas, operadorH3AtivoHoje, riscoH3, ultimoFechado, pctPresente),
    ...construirSeccaoHistoria(historia),
    ...construirSeccaoParametros(parametros),
    ...construirSeccaoIdeal(mesesJanela, estado.medias, estado.idealPorHoras, parametros, estado.idealExato),
    ...construirSeccaoCarga(mesRecente, decomposicao),
    ...construirSeccaoCapacidade(mesRecente, decomposicao),
    ...construirSeccaoHistorico(mesesFechados),
  ]

  return {
    pageSize: 'A4',
    pageMargins: [40, 65, 40, 50],
    info: {
      title: `Calculadora de Headcount, ${formatarMesAnoDeReferencia(mesRecente.mes_referencia)}`,
      subject: 'Dimensionamento de equipa, Operação SSAS Montepio',
    },
    header: () => ({
      text: cabecalho,
      fontSize: 8,
      color: COR_TEXTO_SECUNDARIO,
      margin: [40, 22, 40, 0] as [number, number, number, number],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      text: `Página ${currentPage} de ${pageCount}`,
      fontSize: 8,
      color: COR_TEXTO_SECUNDARIO,
      alignment: 'center' as const,
      margin: [40, 0, 40, 0] as [number, number, number, number],
    }),
    content,
    styles: {
      tituloSeccao: { fontSize: 12, bold: true, color: COR_TEXTO_PRINCIPAL },
      cabecalhoTabela: { fontSize: 8.5, bold: true, color: COR_TEXTO_SECUNDARIO },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  }
}
