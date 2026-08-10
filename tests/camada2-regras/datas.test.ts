import { describe, expect, it } from 'vitest'
import {
  adicionarDias,
  formatarDataPT,
  isoWeekday,
  paraISO,
  quintaEscalaDe,
  segundaDaSemanaDe,
  semanaRefDe,
  semanasTocadas,
} from '../../src/lib/datas'

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

describe('segundaDaSemanaDe — segunda-feira da semana civil (Segunda a Sexta)', () => {
  // Semana de referência: 17/08 (Segunda) a 23/08 (Domingo) de 2026.
  it('devolve a própria data se já for Segunda-feira', () => {
    expect(paraISO(segundaDaSemanaDe(new Date(2026, 7, 17)))).toBe('2026-08-17')
  })
  it('Terça a Sexta pertencem à mesma Segunda', () => {
    expect(paraISO(segundaDaSemanaDe(new Date(2026, 7, 18)))).toBe('2026-08-17') // Terça
    expect(paraISO(segundaDaSemanaDe(new Date(2026, 7, 19)))).toBe('2026-08-17') // Quarta
    expect(paraISO(segundaDaSemanaDe(new Date(2026, 7, 20)))).toBe('2026-08-17') // Quinta
    expect(paraISO(segundaDaSemanaDe(new Date(2026, 7, 21)))).toBe('2026-08-17') // Sexta
  })
  it('Sábado e Domingo ainda pertencem à Segunda que está a terminar essa semana', () => {
    expect(paraISO(segundaDaSemanaDe(new Date(2026, 7, 22)))).toBe('2026-08-17') // Sábado
    expect(paraISO(segundaDaSemanaDe(new Date(2026, 7, 23)))).toBe('2026-08-17') // Domingo
  })
})

describe('semanasTocadas — decompõe um período em semanas civis, para substituto de férias por semana', () => {
  it('período dentro de uma só semana devolve uma única semana, com a sobreposição real', () => {
    // Terça 18/08 a Quinta 20/08 — tudo dentro da semana de 17/08.
    expect(semanasTocadas('2026-08-18', '2026-08-20')).toEqual([
      { semanaInicio: '2026-08-17', inicio: '2026-08-18', fim: '2026-08-20' },
    ])
  })

  it('caso real: férias de 20/08 (Quinta) a 28/08 (Sexta) tocam 2 semanas civis distintas', () => {
    // Caique: só a ponta da semana em curso (Qui/Sex) e depois a semana seguinte inteira.
    expect(semanasTocadas('2026-08-20', '2026-08-28')).toEqual([
      { semanaInicio: '2026-08-17', inicio: '2026-08-20', fim: '2026-08-21' },
      { semanaInicio: '2026-08-24', inicio: '2026-08-24', fim: '2026-08-28' },
    ])
  })

  it('período que começa ao fim de semana não gera uma semana fantasma sem sobreposição real', () => {
    // Sábado 22/08 a Terça 25/08 — a "semana de 17/08" só teria Sáb/Dom
    // dentro do período, mas Segunda a Sexta dessa semana (17-21/08)
    // não tem nenhum dia em comum com o período — não deve aparecer.
    expect(semanasTocadas('2026-08-22', '2026-08-25')).toEqual([
      { semanaInicio: '2026-08-24', inicio: '2026-08-24', fim: '2026-08-25' },
    ])
  })

  it('período de um único dia devolve uma única semana com o mesmo dia em início e fim', () => {
    expect(semanasTocadas('2026-08-19', '2026-08-19')).toEqual([
      { semanaInicio: '2026-08-17', inicio: '2026-08-19', fim: '2026-08-19' },
    ])
  })
})
