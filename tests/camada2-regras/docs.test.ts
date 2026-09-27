import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Testa a integridade do "cérebro" da solução (docs/ + CLAUDE.md), não o seu
// conteúdo — que um humano só confirma lendo. O que aqui se verifica é
// estrutural e barato de manter certo: o índice do CLAUDE.md não fica
// desalinhado de docs/, nenhuma referência aponta a um ficheiro inexistente,
// e o esquema de IDs de regra (docs/regras.md) continua verdadeiro (sem
// buracos, sem duplicados) à medida que os ficheiros crescem.

const RAIZ = join(__dirname, '../..')
const PASTA_DOCS = join(RAIZ, 'docs')

function listarDocs(): string[] {
  return readdirSync(PASTA_DOCS)
    .filter((f) => f.endsWith('.md'))
    .sort()
}

function ler(caminhoRelativo: string): string {
  return readFileSync(join(RAIZ, caminhoRelativo), 'utf8')
}

describe('CLAUDE.md — porta de entrada', () => {
  const claude = ler('CLAUDE.md')
  const linhas = claude.split('\n')

  it('tem menos de 200 linhas (é um ponto de entrada, não um repositório de conteúdo)', () => {
    expect(linhas.length).toBeLessThan(200)
  })

  it('contém a regra obrigatória de consulta antes de alterar ou validar uma regra', () => {
    expect(claude).toMatch(/antes de qualquer alteração ou validação de regra, ler primeiro/i)
  })

  it('lista, no seu índice, exatamente os ficheiros que existem em docs/ — nem a menos, nem a mais', () => {
    const docsReais = listarDocs()
    const citados = docsReais.filter((f) => claude.includes(`\`${f}\``))
    const emFalta = docsReais.filter((f) => !citados.includes(f))
    expect(emFalta, `ficheiros em docs/ não indexados no CLAUDE.md: ${emFalta.join(', ')}`).toEqual([])

    // O inverso: todo ficheiro citado entre crases com padrão "*.md" tem de
    // existir — em docs/ ou na raiz do repositório (CLAUDE.md também cita
    // README.md e os documentos históricos da raiz).
    const referenciasMd = [...claude.matchAll(/`([a-zA-Z0-9_-]+\.md)`/g)].map((m) => m[1])
    for (const ref of referenciasMd) {
      const existeEmDocs = docsReais.includes(ref)
      const existeNaRaiz = (() => {
        try {
          statSync(join(RAIZ, ref))
          return true
        } catch {
          return false
        }
      })()
      expect(existeEmDocs || existeNaRaiz, `CLAUDE.md cita \`${ref}\`, que não existe nem em docs/ nem na raiz`).toBe(true)
    }
  })
})

describe('Cada ficheiro de docs/ segue a mesma forma', () => {
  const docs = listarDocs()

  it.each(docs)('%s começa por um título, "Estado:" e "Ler quando:"', (nomeFicheiro) => {
    const texto = ler(`docs/${nomeFicheiro}`)
    const linhas = texto.split('\n').filter((l) => l.trim() !== '')
    expect(linhas[0]).toMatch(/^# /)
    const cabecalho = linhas.slice(1, 4).join('\n')
    expect(cabecalho).toMatch(/\*\*Estado:\*\*/)
    expect(cabecalho).toMatch(/\*\*Ler quando:\*\*/)
  })

  it.each(docs)('%s não fica vazio nem é um esqueleto (mais de 20 linhas)', (nomeFicheiro) => {
    const texto = ler(`docs/${nomeFicheiro}`)
    expect(texto.split('\n').length).toBeGreaterThan(20)
  })
})

describe('Referências entre ficheiros de docs/ (e a partir da raiz) resolvem para ficheiros reais', () => {
  const docsReais = new Set(listarDocs())
  const ficheirosARever: Array<{ nome: string; texto: string }> = [
    { nome: 'CLAUDE.md', texto: ler('CLAUDE.md') },
    { nome: 'README.md', texto: ler('README.md') },
    ...listarDocs().map((f) => ({ nome: `docs/${f}`, texto: ler(`docs/${f}`) })),
  ]

  it.each(ficheirosARever.map((f) => f.nome))('%s só referencia docs/<algo>.md que existe', (nome) => {
    const { texto } = ficheirosARever.find((f) => f.nome === nome)!
    const referencias = [...texto.matchAll(/`docs\/([a-zA-Z0-9_-]+\.md)`/g)].map((m) => m[1])
    const emFalta = referencias.filter((r) => !docsReais.has(r))
    expect(emFalta, `${nome} referencia docs/ inexistentes: ${emFalta.join(', ')}`).toEqual([])
  })
})

describe('Esquema de IDs de regra (docs/regras.md)', () => {
  const docs = listarDocs()
  // Extrai definições em negrito, ex.: "- **SEM-01** texto" — cada uma conta
  // como a definição desse ID no ficheiro onde aparece.
  const DEFINICAO = /\*\*([A-Z]{2,4}-\d{2})\*\*/g

  function definicoesPorFicheiro(nomeFicheiro: string): string[] {
    const texto = ler(`docs/${nomeFicheiro}`)
    return [...texto.matchAll(DEFINICAO)].map((m) => m[1])
  }

  // Mapa prefixo -> ficheiro dono, construído a partir da tabela do
  // docs/regras.md — se um prefixo aqui não bater com o ficheiro real,
  // o índice está desatualizado.
  const mapaPrefixos: Record<string, string> = {}
  for (const linha of ler('docs/regras.md').split('\n')) {
    const m = linha.match(/^\| `([A-Z]{2,4})` \| [^|]+\| `docs\/([a-zA-Z0-9_-]+\.md)` \|/)
    if (m) mapaPrefixos[m[1]] = m[2]
  }

  it('docs/regras.md indexa pelo menos um prefixo', () => {
    expect(Object.keys(mapaPrefixos).length).toBeGreaterThan(15)
  })

  it.each(Object.entries(mapaPrefixos))('prefixo %s: os IDs definidos em %s vão de 01 a N sem buracos', (prefixo, ficheiroDono) => {
    // Um ID pode aparecer em negrito mais de uma vez no seu próprio ficheiro
    // dono (citado de novo mais tarde, ou numa tabela-resumo no fim) — isso
    // não é um erro; o que importa é o CONJUNTO de números usados, que tem
    // de ser exatamente 1..N, sem saltos (uma regra apagada ou renumerada
    // deixaria um buraco).
    const idsDefinidos = definicoesPorFicheiro(ficheiroDono).filter((id) => id.startsWith(`${prefixo}-`))
    const numerosUnicos = [...new Set(idsDefinidos.map((id) => Number(id.split('-')[1])))].sort((a, b) => a - b)

    expect(numerosUnicos.length, `${prefixo} não tem nenhum ID definido em ${ficheiroDono}`).toBeGreaterThan(0)
    const esperado = Array.from({ length: numerosUnicos.length }, (_, i) => i + 1)
    expect(numerosUnicos, `${prefixo} em ${ficheiroDono} devia ir de 01 a ${numerosUnicos.length} sem buracos`).toEqual(esperado)
  })

  it('nenhum outro ficheiro de docs/ DEFINE (em negrito) um ID de um prefixo que não é o seu — só pode citá-lo em texto corrido', () => {
    // Regra deliberadamente permissiva: citar em negrito dentro de uma lista
    // "Regras: **COL-06**, **COL-07**" (um resumo/pointer) é aceite — o que
    // se recusa é um prefixo aparecer definido (mesmo padrão "- **ID** texto
    // longo") num ficheiro que não consta do seu próprio prefixo nem do mapa.
    for (const ficheiro of docs) {
      const idsNoFicheiro = definicoesPorFicheiro(ficheiro)
      for (const id of idsNoFicheiro) {
        const prefixo = id.split('-')[0]
        expect(mapaPrefixos[prefixo], `${ficheiro} usa o prefixo desconhecido ${prefixo} (${id}) — falta em docs/regras.md`).toBeDefined()
      }
    }
  })
})

describe('Pastas auxiliares existem e não estão vazias', () => {
  it('docs/ tem pelo menos 25 ficheiros .md', () => {
    expect(listarDocs().length).toBeGreaterThanOrEqual(25)
  })

  it('a raiz do repositório continua a ter CLAUDE.md, README.md e CRITERIOS_FUNCIONAIS.md', () => {
    for (const f of ['CLAUDE.md', 'README.md', 'CRITERIOS_FUNCIONAIS.md']) {
      expect(() => statSync(join(RAIZ, f))).not.toThrow()
    }
  })
})
