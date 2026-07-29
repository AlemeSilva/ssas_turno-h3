import { describe, expect, it } from 'vitest'
import {
  avaliarAlertaPreditivo,
  avaliarAlertaReativo,
  avaliarRiscoGirFl,
  calcularProximoAlerta,
  estaHrLimiteEstourado,
  isoWeekdayDe,
} from '../../src/lib/alertas'

describe('avaliarAlertaReativo — HR.LIMITE e checagens 20h/15h', () => {
  it('está FUTURO antes da hora de referência', () => {
    expect(avaliarAlertaReativo('20:00', '19:59')).toBe('FUTURO')
  })
  it('entra em ALERTA exatamente à hora de referência', () => {
    expect(avaliarAlertaReativo('20:00', '20:00')).toBe('ALERTA')
  })
  it('mantém-se em ALERTA dentro da janela de tolerância de 30 min', () => {
    expect(avaliarAlertaReativo('20:00', '20:29')).toBe('ALERTA')
  })
  it('passa a ESCALONAR exatamente aos 30 min de tolerância', () => {
    expect(avaliarAlertaReativo('20:00', '20:30')).toBe('ESCALONAR')
  })
  it('aceita uma tolerância diferente da omissão', () => {
    expect(avaliarAlertaReativo('15:00', '15:20', 15)).toBe('ESCALONAR')
    expect(avaliarAlertaReativo('15:00', '15:10', 15)).toBe('ALERTA')
  })
})

describe('avaliarAlertaPreditivo — GIR_FL (aviso antes, não depois)', () => {
  it('está FUTURO fora da janela de antecedência', () => {
    expect(avaliarAlertaPreditivo('22:00', '21:00', 30)).toBe('FUTURO')
  })
  it('entra em ALERTA exatamente na antecedência definida (21h30 para 22h)', () => {
    expect(avaliarAlertaPreditivo('22:00', '21:30', 30)).toBe('ALERTA')
  })
  it('mantém-se em ALERTA até à própria hora de referência', () => {
    expect(avaliarAlertaPreditivo('22:00', '21:59', 30)).toBe('ALERTA')
  })
  it('passa a ESCALONAR na própria hora de referência (não 30 min depois)', () => {
    expect(avaliarAlertaPreditivo('22:00', '22:00', 30)).toBe('ESCALONAR')
  })
})

describe('estaHrLimiteEstourado', () => {
  it('não está estourado sem HR.LIMITE definido (nullable, aceite conscientemente)', () => {
    expect(estaHrLimiteEstourado(null, 'PENDENTE', '23:59')).toBe(false)
  })
  it('não está estourado se a tarefa já foi concluída', () => {
    expect(estaHrLimiteEstourado('14:00', 'CONCLUIDO', '23:59')).toBe(false)
  })
  it('está estourado quando a hora atual atinge o limite e a tarefa não está concluída', () => {
    expect(estaHrLimiteEstourado('14:00', 'PENDENTE', '14:00')).toBe(true)
    expect(estaHrLimiteEstourado('14:00', 'EM_ANDAMENTO', '14:05')).toBe(true)
  })
  it('não está estourado antes do limite', () => {
    expect(estaHrLimiteEstourado('14:00', 'PENDENTE', '13:59')).toBe(false)
  })
})

describe('isoWeekdayDe', () => {
  it('mapeia Domingo (getDay()=0) para 7, não para 0', () => {
    // 2026-08-02 é um Domingo
    expect(isoWeekdayDe(new Date(2026, 7, 2))).toBe(7)
  })
  it('mapeia Sábado para 6', () => {
    // 2026-08-01 é um Sábado
    expect(isoWeekdayDe(new Date(2026, 7, 1))).toBe(6)
  })
  it('mapeia Segunda para 1', () => {
    expect(isoWeekdayDe(new Date(2026, 7, 3))).toBe(1)
  })
})

describe('avaliarRiscoGirFl — só existe na secção Sábado→Domingo', () => {
  it('não é aplicável em dias que não sejam Sábado', () => {
    expect(avaliarRiscoGirFl(7, '22:00', ['PENDENTE']).aplicavel).toBe(false)
    expect(avaliarRiscoGirFl(1, '22:00', ['PENDENTE']).aplicavel).toBe(false)
  })
  it('não é aplicável se todas as dependências já estiverem concluídas', () => {
    const r = avaliarRiscoGirFl(6, '22:00', ['CONCLUIDO_AUTOMATICO', 'CONCLUIDO_MANUAL'])
    expect(r.aplicavel).toBe(false)
  })
  it('é aplicável no Sábado com pelo menos uma dependência pendente, seguindo o padrão preditivo', () => {
    const antes = avaliarRiscoGirFl(6, '21:00', ['PENDENTE'])
    expect(antes).toEqual({ aplicavel: true, estado: 'FUTURO' })

    const aviso = avaliarRiscoGirFl(6, '21:45', ['PENDENTE'])
    expect(aviso).toEqual({ aplicavel: true, estado: 'ALERTA' })

    const escalona = avaliarRiscoGirFl(6, '22:00', ['PENDENTE'])
    expect(escalona).toEqual({ aplicavel: true, estado: 'ESCALONAR' })
  })
  it('MKT e SB_DDS não fazem parte da verificação (excluídos deliberadamente) — o chamador é responsável por já filtrar a lista', () => {
    // avaliarRiscoGirFl só decide com base na lista que recebe; a
    // exclusão de MKT/SB_DDS acontece no catálogo (gir_fl_dependencias),
    // não aqui — este teste documenta a fronteira de responsabilidade.
    const semDependenciasRelevantes = avaliarRiscoGirFl(6, '22:00', [])
    expect(semDependenciasRelevantes.aplicavel).toBe(false)
  })
})

describe('calcularProximoAlerta — regressão dos dois bugs encontrados na extração', () => {
  it('a checagem das 15h só aparece em Sábado de MANUTENÇÃO, nunca num Sábado normal', () => {
    const sabadoDeManha = new Date(2026, 7, 1, 10, 0) // Sábado, 10h00
    expect(calcularProximoAlerta(sabadoDeManha, false)?.rotulo).not.toContain('15h')
    expect(calcularProximoAlerta(sabadoDeManha, true)?.rotulo).toContain('15h')
  })
  it('a checagem das 20h é reativa: ainda não aparece às 19h30 (bug antigo), só a partir das 20h', () => {
    const antesDas20h = new Date(2026, 7, 1, 19, 30)
    const alerta = calcularProximoAlerta(antesDas20h, false)
    // às 19h30 o próximo alerta ainda deve apontar PARA as 20h, faltando 30 min —
    // não deve already estar "ativo"; validado em conjunto com avaliarAlertaReativo.
    expect(alerta?.horario).toBe('20:00')
    expect(alerta?.minutosRestantes).toBe(30)
  })
  it('não sugere nenhum alerta a meio da tarde de uma segunda-feira normal', () => {
    const segundaFeira = new Date(2026, 7, 3, 15, 0)
    expect(calcularProximoAlerta(segundaFeira, false)).toBeNull()
  })
})
