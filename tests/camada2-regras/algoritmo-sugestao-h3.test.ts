import { describe, expect, it } from 'vitest'
import { escolherOperadorH3, repetirTurnoAnterior, type CandidatoH3 } from '../../supabase/functions/sugerir-escala/algoritmo'

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

  it('candidatos sem limite definido (null) nunca bloqueiam a escolha', () => {
    const contagemMesAtual = new Map([
      ['bruno', 50],
      ['kilson', 50],
    ])
    const sugestao = escolherOperadorH3([BRUNO, KILSON], new Map(), contagemMesAtual)
    expect(sugestao?.precisa_override).toBe(false)
  })
})

describe('repetirTurnoAnterior — H1/H2/H4 sem regra própria', () => {
  const escalaAnterior = [
    { usuario_id: 'bruno', turno: 'H1' as const },
    { usuario_id: 'caique', turno: 'H2' as const },
    { usuario_id: 'kilson', turno: 'H3' as const },
  ]

  it('repete quem esteve no turno na semana anterior', () => {
    expect(repetirTurnoAnterior(escalaAnterior, 'H1')).toBe('bruno')
    expect(repetirTurnoAnterior(escalaAnterior, 'H2')).toBe('caique')
  })

  it('devolve null se não houver registo da semana anterior para esse turno (ex.: primeira semana da app)', () => {
    expect(repetirTurnoAnterior([], 'H4')).toBeNull()
  })
})
