import { describe, expect, it } from 'vitest'
import { semanasParaNovoOperador } from '../../supabase/functions/gerir-utilizadores/composicaoEscala'
import { semanasParaNovoOperador as semanasParaNovoOperadorFrontend } from '../../src/lib/composicaoEscala'

function ehSabado(iso: string): boolean {
  return new Date(iso + 'T00:00:00').getDay() === 6
}

// Conta Sábados em [inicioISO, fimISO], inclusive — implementação
// independente da função testada (só para verificação cruzada, não
// partilha nenhum código com composicaoEscala.ts).
function contarSabados(inicioISO: string, fimISO: string): number {
  const d = new Date(inicioISO + 'T00:00:00')
  const fim = new Date(fimISO + 'T00:00:00')
  let n = 0
  while (d <= fim) {
    if (d.getDay() === 6) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}

describe('semanasParaNovoOperador — composição da escala de um operador recém-registado', () => {
  it('todas as datas devolvidas são Sábados', () => {
    for (const iso of semanasParaNovoOperador('2026-03-10')) {
      expect(ehSabado(iso)).toBe(true)
    }
  })

  it('primeira semana é o primeiro Sábado a partir do dia seguinte ao registo', () => {
    // 2026-03-10 é Terça — dia seguinte é Quarta 11/03; primeiro Sábado a partir daí é 14/03.
    expect(semanasParaNovoOperador('2026-03-10')[0]).toBe('2026-03-14')
  })

  it('registo fora de Novembro/Dezembro só cobre até 31/12 do próprio ano', () => {
    const semanas = semanasParaNovoOperador('2026-03-10')
    expect(semanas.every((s) => s >= '2026-01-01' && s <= '2026-12-31')).toBe(true)
    expect(semanas.length).toBe(contarSabados('2026-03-11', '2026-12-31'))
  })

  it('caso real: registo a 15/11/2026 começa em 21/11 e inclui também o ano seguinte inteiro', () => {
    const semanas = semanasParaNovoOperador('2026-11-15')
    expect(semanas[0]).toBe('2026-11-21')
    expect(semanas).toContain('2026-12-26') // última semana de 2026
    expect(semanas).toContain('2027-01-02') // primeira semana de 2027

    const de2026 = semanas.filter((s) => s.startsWith('2026'))
    const de2027 = semanas.filter((s) => s.startsWith('2027'))
    expect(de2026.length).toBe(contarSabados('2026-11-21', '2026-12-31'))
    expect(de2027.length).toBe(contarSabados('2027-01-01', '2027-12-31'))
  })

  it('registo em Dezembro também inclui o ano seguinte inteiro', () => {
    const semanas = semanasParaNovoOperador('2026-12-01')
    const de2027 = semanas.filter((s) => s.startsWith('2027'))
    expect(de2027.length).toBe(contarSabados('2027-01-01', '2027-12-31'))
  })

  it('registo em Outubro não inclui o ano seguinte — só passa a incluir a partir de Novembro', () => {
    const semanas = semanasParaNovoOperador('2026-10-15')
    expect(semanas.some((s) => s.startsWith('2027'))).toBe(false)
  })

  it('registo no próprio dia 1 de Novembro já conta como "posterior a Novembro" (inclui o ano seguinte)', () => {
    const semanas = semanasParaNovoOperador('2026-11-01')
    expect(semanas.some((s) => s.startsWith('2027'))).toBe(true)
  })

  it('registo a 31 de Dezembro ainda gera pelo menos a semana do ano seguinte (sem semanas do próprio ano, já não há nenhuma)', () => {
    const semanas = semanasParaNovoOperador('2026-12-31')
    expect(semanas.some((s) => s.startsWith('2026'))).toBe(false)
    expect(semanas.length).toBe(contarSabados('2027-01-01', '2027-12-31'))
  })
})

// src/lib/composicaoEscala.ts é uma cópia deliberada desta função (usada
// pela reativação em UtilizadoresPage.tsx — mesmo padrão de duplicação
// de sugerir-escala/algoritmo.ts, nunca cross-import entre Deno e Vite).
// Sem isto, as duas cópias podiam divergir silenciosamente com o tempo.
describe('src/lib/composicaoEscala.ts — cópia usada na reativação mantém-se idêntica ao original', () => {
  it.each(['2026-03-10', '2026-11-15', '2026-12-01', '2026-10-15', '2026-11-01', '2026-12-31'])(
    'produz exatamente as mesmas semanas que a cópia da Edge Function para %s',
    (dataISO) => {
      expect(semanasParaNovoOperadorFrontend(dataISO)).toEqual(semanasParaNovoOperador(dataISO))
    }
  )
})
