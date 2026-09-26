import { describe, expect, it } from 'vitest'
import {
  adicionarDias,
  ativacaoH3DaSemana,
  diasSobrepostos,
  duracaoEmAnosEMeses,
  ehSabadoISO,
  formatarDataPT,
  isoWeekday,
  paraISO,
  quintaEscalaDe,
  sabadoDaSemanaH3,
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

describe('duracaoEmAnosEMeses — tempo de permanência na equipa', () => {
  it('anos e meses completos', () => {
    expect(duracaoEmAnosEMeses('2024-01-15', '2026-08-21')).toBe('2 anos e 7 meses')
  })

  it('só meses, quando ainda não chegou a um ano', () => {
    expect(duracaoEmAnosEMeses('2026-01-15', '2026-08-10')).toBe('6 meses')
  })

  it('mês só conta completo ao chegar ao mesmo dia do mês seguinte', () => {
    // Jan 15 → Ago 15 seriam 7 meses completos; um dia antes (Ago 14) ainda são só 6.
    expect(duracaoEmAnosEMeses('2026-01-15', '2026-08-15')).toBe('7 meses')
    expect(duracaoEmAnosEMeses('2026-01-15', '2026-08-14')).toBe('6 meses')
  })

  it('exatamente um ano, sem meses a mais, não mostra "e 0 meses"', () => {
    expect(duracaoEmAnosEMeses('2026-08-12', '2027-08-12')).toBe('1 ano')
  })

  it('mesmo dia — sem tempo nenhum decorrido', () => {
    expect(duracaoEmAnosEMeses('2026-08-12', '2026-08-12')).toBe('0 meses')
  })

  it('singular vs plural (1 ano / 1 mês) tratado corretamente', () => {
    expect(duracaoEmAnosEMeses('2025-07-12', '2026-08-12')).toBe('1 ano e 1 mês')
  })

  it('aceita timestamps completos (criado_em) e datas simples (data_saida) misturados', () => {
    // Dia 15 (não 1) de propósito — longe de qualquer fronteira de mês
    // que um fuso horário diferente do da máquina de teste pudesse afetar.
    expect(duracaoEmAnosEMeses('2024-03-15T10:15:00.000Z', '2026-03-15')).toBe('2 anos')
  })
})

describe('diasSobrepostos — dias em comum entre dois períodos, para o limiar de 50% do relatório semanal', () => {
  it('sobreposição parcial conta só os dias em comum', () => {
    // Período 1: 18-20/08. Período 2 (semana do relatório): 14-20/08.
    expect(diasSobrepostos('2026-08-18', '2026-08-20', '2026-08-14', '2026-08-20')).toBe(3)
  })

  it('caso real: Bruno ausente um único dia dentro da semana', () => {
    expect(diasSobrepostos('2026-08-19', '2026-08-19', '2026-08-14', '2026-08-20')).toBe(1)
  })

  it('caso real: Caique inicia férias no último dia do período reportado', () => {
    expect(diasSobrepostos('2026-08-20', '2026-08-28', '2026-08-14', '2026-08-20')).toBe(1)
  })

  it('período totalmente dentro do outro conta os seus próprios dias inteiros', () => {
    expect(diasSobrepostos('2026-08-15', '2026-08-17', '2026-08-14', '2026-08-20')).toBe(3)
  })

  it('sem sobreposição nenhuma devolve 0, nunca um número negativo', () => {
    expect(diasSobrepostos('2026-08-01', '2026-08-05', '2026-08-14', '2026-08-20')).toBe(0)
  })

  it('período inteiro dentro da semana conta os 7 dias', () => {
    expect(diasSobrepostos('2026-08-10', '2026-08-25', '2026-08-14', '2026-08-20')).toBe(7)
  })

  it('é simétrica — a ordem dos dois períodos não altera o resultado', () => {
    expect(diasSobrepostos('2026-08-14', '2026-08-20', '2026-08-18', '2026-08-20')).toBe(3)
  })
})

describe('sabadoDaSemanaH3 — a semana H3 ativa-se às 22h de sexta-feira', () => {
  // Sábado 2026-09-26 é o semana_ref da semana que se ativa na sexta 25/09 às 22h.
  const semanaDe = (ano: number, mes: number, dia: number, hora = 12, minuto = 0) =>
    paraISO(sabadoDaSemanaH3(new Date(ano, mes - 1, dia, hora, minuto)))

  it('de sábado a quinta é a semana do último sábado', () => {
    expect(semanaDe(2026, 9, 26, 0, 0)).toBe('2026-09-26') // Sábado, 00h00
    expect(semanaDe(2026, 9, 26, 23, 59)).toBe('2026-09-26')
    expect(semanaDe(2026, 9, 27)).toBe('2026-09-26') // Domingo
    expect(semanaDe(2026, 9, 28)).toBe('2026-09-26') // Segunda
    expect(semanaDe(2026, 10, 1)).toBe('2026-09-26') // Quinta
  })

  it('na sexta-feira, até às 21h59, ainda é a semana do sábado anterior', () => {
    expect(semanaDe(2026, 10, 2, 0, 0)).toBe('2026-09-26')
    expect(semanaDe(2026, 10, 2, 21, 59)).toBe('2026-09-26')
  })

  it('na sexta-feira, a partir das 22h00, já é a semana do sábado seguinte', () => {
    expect(semanaDe(2026, 10, 2, 22, 0)).toBe('2026-10-03')
    expect(semanaDe(2026, 10, 2, 23, 59)).toBe('2026-10-03')
    expect(semanaDe(2026, 10, 3, 0, 0)).toBe('2026-10-03') // já sábado
  })

  it('atravessa a mudança de mês e de ano', () => {
    expect(semanaDe(2026, 12, 31)).toBe('2026-12-26') // Quinta
    expect(semanaDe(2027, 1, 1, 22, 0)).toBe('2027-01-02') // Sexta 22h -> sábado 02/01
    expect(semanaDe(2026, 7, 31, 22, 0)).toBe('2026-08-01') // Sexta 22h -> sábado 01/08
  })
})

describe('ativacaoH3DaSemana — 22h de sexta-feira, véspera do sábado', () => {
  it('a semana de sábado 26/09 ativa-se na sexta 25/09 às 22h00', () => {
    expect(ativacaoH3DaSemana('2026-09-26').getTime()).toBe(new Date(2026, 8, 25, 22, 0).getTime())
  })

  it('atravessa o início do mês e do ano', () => {
    expect(ativacaoH3DaSemana('2026-08-01').getTime()).toBe(new Date(2026, 6, 31, 22, 0).getTime())
    expect(ativacaoH3DaSemana('2028-01-01').getTime()).toBe(new Date(2027, 11, 31, 22, 0).getTime()) // sábado 01/01/2028
  })
})

describe('ehSabadoISO — a semana H3 (semana_ref, troca) começa sempre ao sábado', () => {
  it('sábado é sábado', () => {
    expect(ehSabadoISO('2026-10-17')).toBe(true)
    expect(ehSabadoISO('2028-01-01')).toBe(true) // sábado que abre o ano
  })

  it('a quinta de referência do plano de fim de semana não é uma semana H3 (o caso da troca #59, 15/10/2026)', () => {
    expect(ehSabadoISO('2026-10-15')).toBe(false)
  })

  it('a sexta em que o H3 se ativa (22h) e os outros dias também não', () => {
    expect(ehSabadoISO('2026-10-16')).toBe(false) // sexta
    expect(ehSabadoISO('2026-10-18')).toBe(false) // domingo
    expect(ehSabadoISO('2027-12-31')).toBe(false) // sexta, véspera do sábado 01/01/2028
  })

  it('um campo de data por preencher não é sábado', () => {
    expect(ehSabadoISO('')).toBe(false)
  })
})
