import { describe, expect, it } from 'vitest'
import {
  ehSabado,
  escolherOperadorH2,
  escolherOperadorH3,
  janelaDoMesH3,
  mesDaSemanaH3,
  subtrairMeses,
  sugerirSemana,
  type CandidatoH3,
  type EntradaSugestao,
  type UtilizadorAtivo,
} from '../../supabase/functions/sugerir-escala/algoritmo'

const CAIQUE: CandidatoH3 = { id: 'caique', nome: 'Caique Araújo', limite_h3_mensal: 1 }
const BRUNO: CandidatoH3 = { id: 'bruno', nome: 'Bruno Diniz', limite_h3_mensal: null }
const KILSON: CandidatoH3 = { id: 'kilson', nome: 'Kilson Júnior', limite_h3_mensal: null }

describe('escolherOperadorH3', () => {
  it('devolve null sem candidatos elegíveis (ex.: todos de férias)', () => {
    expect(escolherOperadorH3([], new Map(), new Map())).toBeNull()
  })

  it('escolhe quem tem menos turnos nos últimos 3 meses', () => {
    const contagem3Meses = new Map([
      ['caique', 3],
      ['bruno', 5],
      ['kilson', 1],
    ])
    const sugestao = escolherOperadorH3([CAIQUE, BRUNO, KILSON], contagem3Meses, new Map())
    expect(sugestao?.usuario_id).toBe('kilson')
    expect(sugestao?.precisa_override).toBe(false)
  })

  it('um recém-chegado à rotação (0 turnos na janela de 3 meses) é naturalmente priorizado', () => {
    const NOVO: CandidatoH3 = { id: 'novo', nome: 'Novo Elemento', limite_h3_mensal: null }
    const contagem3Meses = new Map([
      ['caique', 2],
      ['bruno', 2],
      // "novo" propositadamente ausente do mapa — equivalente a 0 turnos
    ])
    const sugestao = escolherOperadorH3([CAIQUE, BRUNO, NOVO], contagem3Meses, new Map())
    expect(sugestao?.usuario_id).toBe('novo')
  })

  it('respeita o limite mensal do Caique quando ele já o atingiu, escolhendo outro elegível', () => {
    const contagemMesAtual = new Map([['caique', 1]]) // já atingiu o limite de 1
    const sugestao = escolherOperadorH3([CAIQUE, BRUNO, KILSON], new Map(), contagemMesAtual)
    expect(sugestao?.usuario_id).not.toBe('caique')
    expect(sugestao?.precisa_override).toBe(false)
  })

  it('sinaliza precisa_override quando TODOS os elegíveis já esgotaram o respetivo limite', () => {
    const soCaique: CandidatoH3[] = [CAIQUE]
    const contagemMesAtual = new Map([['caique', 1]])
    const sugestao = escolherOperadorH3(soCaique, new Map(), contagemMesAtual)
    expect(sugestao?.usuario_id).toBe('caique')
    expect(sugestao?.precisa_override).toBe(true)
  })

  it('com o mesmo número de H3 nos 3 meses, desempata por menos no ano e depois pelo id (como o preenchimento anual)', () => {
    const contagemAno = new Map([
      ['bruno', 3],
      ['kilson', 1],
    ])
    expect(escolherOperadorH3([BRUNO, KILSON], new Map(), new Map(), contagemAno)?.usuario_id).toBe('kilson')
    // Sem nenhuma diferença, o id decide — e não a ordem em que a base devolve as linhas.
    expect(escolherOperadorH3([KILSON, BRUNO], new Map(), new Map())?.usuario_id).toBe('bruno')
    expect(escolherOperadorH3([BRUNO, KILSON], new Map(), new Map())?.usuario_id).toBe('bruno')
  })

  it('candidatos sem limite definido (null) nunca bloqueiam a escolha', () => {
    const contagemMesAtual = new Map([
      ['bruno', 50],
      ['kilson', 50],
    ])
    const sugestao = escolherOperadorH3([BRUNO, KILSON], new Map(), contagemMesAtual)
    expect(sugestao?.precisa_override).toBe(false)
  })
})

describe('ehSabado — a sugestão é por semana H3, que começa ao sábado', () => {
  it('só aceita sábados', () => {
    expect(ehSabado('2026-10-17')).toBe(true)
    expect(ehSabado('2026-10-15')).toBe(false) // a quinta que o painel pedia
    expect(ehSabado('2026-10-16')).toBe(false)
    expect(ehSabado('2026-10-18')).toBe(false)
  })
  it('data inválida ou em falta não é sábado', () => {
    expect(ehSabado('')).toBe(false)
    expect(ehSabado('17/10/2026')).toBe(false)
    expect(ehSabado('2026-10-17T00:00')).toBe(false)
  })
})

describe('mesDaSemanaH3 / janelaDoMesH3 — o limite mensal conta a semana no mês da maioria dos dias (0050)', () => {
  it('uma semana de fronteira pertence ao mês onde caem mais dias: 31/10 a 06/11/2026 é de novembro', () => {
    expect(mesDaSemanaH3('2026-10-31')).toBe('2026-11') // 1 dia em outubro, 6 em novembro
    expect(mesDaSemanaH3('2026-10-24')).toBe('2026-10')
    expect(mesDaSemanaH3('2026-09-26')).toBe('2026-09') // 5 dias em setembro, 2 em outubro
  })

  it('atravessa o fim do ano', () => {
    expect(mesDaSemanaH3('2028-12-30')).toBe('2029-01') // 2 dias em dezembro, 5 em janeiro
    expect(mesDaSemanaH3('2026-12-26')).toBe('2026-12') // 6 dias em dezembro, 1 em janeiro
  })

  it('a janela de outubro/2026 deixa de fora o sábado 26/09 (setembro) e o 31/10 (novembro)', () => {
    expect(janelaDoMesH3('2026-10-17')).toEqual({ inicio: '2026-09-28', fim: '2026-10-29' })
  })

  it('a janela de novembro/2026 começa em 29/10, para incluir a semana de 31/10, e acaba em 28/11', () => {
    expect(janelaDoMesH3('2026-10-31')).toEqual({ inicio: '2026-10-29', fim: '2026-11-28' })
    expect(janelaDoMesH3('2026-11-07')).toEqual({ inicio: '2026-10-29', fim: '2026-11-28' })
  })

  it('a janela atravessa o fim do ano', () => {
    expect(janelaDoMesH3('2026-12-05')).toEqual({ inicio: '2026-11-28', fim: '2026-12-29' })
    expect(janelaDoMesH3('2028-12-30')).toEqual({ inicio: '2028-12-29', fim: '2029-01-29' })
  })

  it('coincide com contar os 7 dias e ficar com o mês onde caem mais, em todos os sábados de 2026 a 2030', () => {
    const DIA = 24 * 60 * 60 * 1000
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    const maioria = (sabadoMs: number) => {
      const contagem = new Map<string, number>()
      for (let i = 0; i < 7; i++) {
        const mes = iso(sabadoMs + i * DIA).slice(0, 7)
        contagem.set(mes, (contagem.get(mes) ?? 0) + 1)
      }
      return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }
    const sabados: number[] = []
    for (let ms = Date.UTC(2026, 0, 3); ms <= Date.UTC(2030, 11, 31); ms += 7 * DIA) sabados.push(ms)
    for (const ms of sabados) {
      expect(ehSabado(iso(ms))).toBe(true)
      expect(mesDaSemanaH3(iso(ms))).toBe(maioria(ms))
      const { inicio, fim } = janelaDoMesH3(iso(ms))
      for (const outro of sabados.filter((o) => Math.abs(o - ms) <= 8 * 7 * DIA)) {
        const dentro = iso(outro) >= inicio && iso(outro) < fim
        expect(dentro).toBe(maioria(outro) === maioria(ms))
      }
    }
  })
})

describe('escolherOperadorH2 — rotação entre os elegíveis, com as contagens de H2', () => {
  it('escolhe quem teve menos H2 nos últimos 3 meses, depois no ano, depois o id', () => {
    const elegiveis = [{ id: 'bruno' }, { id: 'caique' }]
    expect(escolherOperadorH2(elegiveis, new Map([['bruno', 2]]), new Map())).toBe('caique')
    expect(escolherOperadorH2(elegiveis, new Map(), new Map([['caique', 4]]))).toBe('bruno')
    expect(escolherOperadorH2([{ id: 'caique' }, { id: 'bruno' }], new Map(), new Map())).toBe('bruno')
  })
  it('sem elegíveis fica por decidir', () => {
    expect(escolherOperadorH2([], new Map(), new Map())).toBeNull()
  })
})

describe('subtrairMeses — como o Postgres: se o dia não existe no mês de chegada, fica o último', () => {
  it('recua 3 meses', () => {
    expect(subtrairMeses('2026-11-07', 3)).toBe('2026-08-07')
    expect(subtrairMeses('2027-01-02', 3)).toBe('2026-10-02')
  })
  it('ajusta ao fim do mês curto, também em ano bissexto', () => {
    expect(subtrairMeses('2026-05-30', 3)).toBe('2026-02-28')
    expect(subtrairMeses('2028-05-30', 3)).toBe('2028-02-29')
  })
})

describe('sugerirSemana — a semana inteira, com as regras de cada turno em vigor', () => {
  const U = (id: string, perfil: string, extra: Partial<UtilizadorAtivo> = {}): UtilizadorAtivo => ({
    id,
    nome: id,
    perfil,
    limite_h3_mensal: null,
    elegivel_h2: false,
    turno_fixo: null,
    criado_em: '2025-01-01T00:00:00+00:00',
    ...extra,
  })
  // A equipa tal como está: três OPERADOR_H3 (dois elegíveis para H2, um com limite de 1 H3/mês),
  // um H1 fixo, um H4 fixo e o Gerente.
  const EQUIPA: UtilizadorAtivo[] = [
    U('bruno', 'OPERADOR_H3', { elegivel_h2: true }),
    U('caique', 'OPERADOR_H3', { elegivel_h2: true, limite_h3_mensal: 1 }),
    U('kilson', 'OPERADOR_H3'),
    U('sergio', 'OPERADOR', { turno_fixo: 'H1' }),
    U('leonardo', 'OPERADOR', { turno_fixo: 'H4' }),
    U('alessandro', 'GERENTE'),
  ]
  const entrada = (extra: Partial<EntradaSugestao> = {}): EntradaSugestao => ({
    semanaRef: '2026-10-17',
    utilizadores: EQUIPA,
    historicoH3H2: [],
    h3NoMes: [],
    comFerias: new Set(),
    ...extra,
  })

  it('monta os seis lugares: H1 e H4 fixos, H3 e H2 em rotação, o resto dos OPERADOR_H3 em H4', () => {
    const s = sugerirSemana(entrada())
    expect(s.H3?.usuario_id).toBe('bruno')
    expect(s.H2).toBe('caique') // elegível e não é o H3 da semana
    expect(s.H1).toEqual(['sergio'])
    expect([...s.H4].sort()).toEqual(['alessandro', 'kilson', 'leonardo'])
  })

  it('quem é H3 nunca é H2 na mesma semana, e quem não é elegível para H2 fica em H4', () => {
    const s = sugerirSemana(entrada({ historicoH3H2: [{ usuario_id: 'bruno', turno: 'H3', semana_ref: '2026-09-26' }] }))
    expect(s.H3?.usuario_id).toBe('caique')
    expect(s.H2).toBe('bruno')
    expect(s.H4).toContain('kilson')
  })

  it('o H2 roda: passa para quem teve menos H2 recentemente', () => {
    const s = sugerirSemana(
      entrada({
        historicoH3H2: [
          { usuario_id: 'bruno', turno: 'H3', semana_ref: '2026-09-05' },
          { usuario_id: 'caique', turno: 'H2', semana_ref: '2026-09-05' },
          { usuario_id: 'caique', turno: 'H3', semana_ref: '2026-09-12' },
          { usuario_id: 'bruno', turno: 'H2', semana_ref: '2026-09-12' },
          { usuario_id: 'caique', turno: 'H3', semana_ref: '2026-09-19' },
          { usuario_id: 'bruno', turno: 'H2', semana_ref: '2026-09-19' },
        ],
      })
    )
    // O Kilson ainda não teve nenhum H3: é o H3. Entre os elegíveis para H2, o Bruno teve 2 e o Caique 1.
    expect(s.H3?.usuario_id).toBe('kilson')
    expect(s.H2).toBe('caique')
  })

  it('só conta o histórico anterior à semana, e só os 3 meses para a rotação principal', () => {
    const s = sugerirSemana(
      entrada({
        historicoH3H2: [
          { usuario_id: 'bruno', turno: 'H3', semana_ref: '2026-01-10' }, // fora dos 3 meses, dentro do ano
          { usuario_id: 'bruno', turno: 'H3', semana_ref: '2026-02-07' },
          { usuario_id: 'kilson', turno: 'H3', semana_ref: '2026-09-05' }, // dentro dos 3 meses
        ],
      })
    )
    // Bruno e Caique têm 0 H3 nos 3 meses; o Kilson tem 1. Entre os dois, Bruno tem 2 no ano: sai o Caique.
    expect(s.H3?.usuario_id).toBe('caique')
  })

  it('respeita o limite mensal contando as semanas do mês pela maioria dos dias, e sinaliza override se ninguém couber', () => {
    const comLimite = sugerirSemana(entrada({ historicoH3H2: [{ usuario_id: 'bruno', turno: 'H3', semana_ref: '2026-10-10' }], h3NoMes: ['caique'] }))
    expect(comLimite.H3?.usuario_id).toBe('kilson') // o Caique (limite 1) já tem o do mês; o Bruno tem 1 e o Kilson 0
    expect(comLimite.H3?.precisa_override).toBe(false)

    const soCaique = sugerirSemana(entrada({ utilizadores: [U('caique', 'OPERADOR_H3', { limite_h3_mensal: 1 })], h3NoMes: ['caique'] }))
    expect(soCaique.H3).toEqual({ usuario_id: 'caique', nome: 'caique', precisa_override: true })
  })

  it('quem tem férias na semana não é proposto para H3, mas continua a poder ser H2 ou H4', () => {
    const s = sugerirSemana(entrada({ comFerias: new Set(['bruno']) }))
    expect(s.H3?.usuario_id).toBe('caique')
    expect(s.H2).toBe('bruno')
    const todosDeFerias = sugerirSemana(entrada({ comFerias: new Set(['bruno', 'caique', 'kilson']) }))
    expect(todosDeFerias.H3).toBeNull()
  })

  it('só entra quem foi recebido: quem saiu da equipa nunca aparece (caso real: Pedro, 2026-08-21)', () => {
    const semPedro = sugerirSemana(entrada({ utilizadores: EQUIPA.filter((u) => u.id !== 'sergio') }))
    expect(semPedro.H1).toEqual([]) // o H1 fixo saiu: fica por decidir, não se propõe um nome errado
  })

  it('só o Gerente ativo mais antigo é H4', () => {
    const doisGerentes = [...EQUIPA, U('novo', 'GERENTE', { criado_em: '2026-09-01T00:00:00+00:00' })]
    const s = sugerirSemana(entrada({ utilizadores: doisGerentes }))
    expect(s.H4).toContain('alessandro')
    expect(s.H4).not.toContain('novo')
  })

  it('sem nenhum elegível para H2, o H2 fica por decidir e todos os outros OPERADOR_H3 vão para H4', () => {
    const semElegiveis = EQUIPA.map((u) => ({ ...u, elegivel_h2: false }))
    const s = sugerirSemana(entrada({ utilizadores: semElegiveis }))
    expect(s.H2).toBeNull()
    expect(s.H4).toEqual(expect.arrayContaining(['caique', 'kilson']))
  })
})
