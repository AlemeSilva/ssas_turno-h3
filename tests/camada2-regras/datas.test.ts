import { describe, expect, it } from 'vitest'
import { adicionarDias, formatarDataPT, isoWeekday, paraISO, quintaEscalaDe, semanaRefDe } from '../../src/lib/datas'

describe('semanaRefDe — âncora do ciclo H3 é sempre a Quinta-feira', () => {
  it('devolve a própria data se já for Quinta-feira', () => {
    // 2026-07-30 é uma Quinta-feira
    expect(paraISO(semanaRefDe(new Date(2026, 6, 30)))).toBe('2026-07-30')
  })
  it('uma Sexta-feira pertence à Quinta anterior', () => {
    expect(paraISO(semanaRefDe(new Date(2026, 6, 31)))).toBe('2026-07-30')
  })
  it('um Domingo pertence à Quinta anterior (dentro do mesmo ciclo Qui-Seg)', () => {
    expect(paraISO(semanaRefDe(new Date(2026, 7, 2)))).toBe('2026-07-30')
  })
  it('uma Segunda-feira ainda pertence ao ciclo da Quinta anterior (fim do ciclo Qui-Seg)', () => {
    expect(paraISO(semanaRefDe(new Date(2026, 7, 3)))).toBe('2026-07-30')
  })
  it('uma Terça-feira já pertence à Quinta seguinte (novo ciclo)', () => {
    expect(paraISO(semanaRefDe(new Date(2026, 7, 4)))).toBe('2026-08-06')
  })
})

describe('quintaEscalaDe — âncora da escala (H1-H4) cobre a semana inteira, sem exceção de Terça/Quarta', () => {
  it('devolve a própria data se já for Quinta-feira', () => {
    expect(paraISO(quintaEscalaDe(new Date(2026, 6, 30)))).toBe('2026-07-30')
  })
  it('Sexta a Segunda ainda pertencem à Quinta anterior', () => {
    expect(paraISO(quintaEscalaDe(new Date(2026, 6, 31)))).toBe('2026-07-30') // Sexta
    expect(paraISO(quintaEscalaDe(new Date(2026, 7, 1)))).toBe('2026-07-30') // Sábado
    expect(paraISO(quintaEscalaDe(new Date(2026, 7, 2)))).toBe('2026-07-30') // Domingo
    expect(paraISO(quintaEscalaDe(new Date(2026, 7, 3)))).toBe('2026-07-30') // Segunda
  })
  it('Terça e Quarta AINDA pertencem à Quinta anterior — diferente de semanaRefDe(), que já avançaria', () => {
    expect(paraISO(quintaEscalaDe(new Date(2026, 7, 4)))).toBe('2026-07-30') // Terça
    expect(paraISO(quintaEscalaDe(new Date(2026, 7, 5)))).toBe('2026-07-30') // Quarta
    // semanaRefDe(), com a exceção do ciclo Qui-Seg do Plano, já teria avançado para a quinta seguinte:
    expect(paraISO(semanaRefDe(new Date(2026, 7, 4)))).toBe('2026-08-06')
  })
  it('só avança na própria Quinta-feira seguinte', () => {
    expect(paraISO(quintaEscalaDe(new Date(2026, 7, 6)))).toBe('2026-08-06')
  })
})

describe('isoWeekday', () => {
  it('Domingo é 7, não 0 (ISO 8601)', () => {
    expect(isoWeekday(new Date(2026, 7, 2))).toBe(7)
  })
  it('Quinta-feira é 4', () => {
    expect(isoWeekday(new Date(2026, 6, 30))).toBe(4)
  })
})

describe('adicionarDias / paraISO', () => {
  it('soma dias corretamente através de fronteira de mês', () => {
    const base = new Date(2026, 6, 30) // 30 de julho
    expect(paraISO(adicionarDias(base, 4))).toBe('2026-08-03')
  })
})

describe('formatarDataPT — formato português europeu dd/mm/aaaa', () => {
  it('formata uma data ISO no formato pt-PT', () => {
    expect(formatarDataPT('2026-08-01')).toBe('01/08/2026')
  })
})
