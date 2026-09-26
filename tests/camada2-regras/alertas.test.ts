import { describe, expect, it } from 'vitest'
import {
  avaliarAlertaHeadcountMensal,
  avaliarAlertaPreditivo,
  avaliarAlertaReativo,
  avaliarAvisoAutomacaoAnual,
  avaliarRiscoGirFl,
  avaliarSaudeAutomacaoAnual,
  avaliarSemanasSemH3,
  calcularProximoAlerta,
  estaHrLimiteEstourado,
  isoWeekdayDe,
  type TarefaComHrLimite,
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

describe('estaHrLimiteEstourado — a HR. LIMITE conta no dia e na hora', () => {
  // Sábado 17/10/2026, 14h00. Datas locais, como o alarme as usa.
  const tarefa = (extra: Partial<TarefaComHrLimite> = {}): TarefaComHrLimite => ({
    hr_limite: '14:00',
    dt_previsao: null,
    data_execucao: '2026-10-17',
    status: 'PENDENTE',
    ...extra,
  })
  const em = (dia: number, hora: number, minuto = 0) => new Date(2026, 9, dia, hora, minuto) // outubro

  it('não está estourado sem HR.LIMITE definido (nullable, aceite conscientemente)', () => {
    expect(estaHrLimiteEstourado(tarefa({ hr_limite: null }), em(19, 23, 59))).toBe(false)
  })
  it('não está estourado se a tarefa já foi concluída', () => {
    expect(estaHrLimiteEstourado(tarefa({ status: 'CONCLUIDO' }), em(19, 23, 59))).toBe(false)
  })
  it('está estourado quando o momento atinge o limite e a tarefa não está concluída', () => {
    expect(estaHrLimiteEstourado(tarefa(), em(17, 14, 0))).toBe(true)
    expect(estaHrLimiteEstourado(tarefa({ status: 'EM_ANDAMENTO' }), em(17, 14, 5))).toBe(true)
  })
  it('não está estourado antes do limite', () => {
    expect(estaHrLimiteEstourado(tarefa(), em(17, 13, 59))).toBe(false)
  })

  it('o dia conta: um limite de sábado às 14h não dispara na quinta às 15h nem na sexta à noite', () => {
    // Antes só se comparava a hora: "15:00" >= "14:00" dava atrasada logo na quinta.
    expect(estaHrLimiteEstourado(tarefa(), em(15, 15, 0))).toBe(false) // quinta
    expect(estaHrLimiteEstourado(tarefa(), em(16, 22, 30))).toBe(false) // sexta
  })
  it('depois do dia do limite, a tarefa por concluir continua atrasada (não basta filtrar por hoje)', () => {
    expect(estaHrLimiteEstourado(tarefa(), em(18, 9, 0))).toBe(true) // domingo
    expect(estaHrLimiteEstourado(tarefa(), em(19, 9, 0))).toBe(true) // segunda
  })

  it('o dia previsto (dt_previsao) prevalece sobre o dia marcado: limite às 02h00 de domingo', () => {
    // Turno H3 (22h00 a 07h00): a tarefa é marcada para sábado, o fim previsto
    // é domingo. Antes disparava no sábado às 22h30 ("22:30" >= "02:00").
    const passadaAMeiaNoite = tarefa({ hr_limite: '02:00', dt_previsao: '2026-10-18' })
    expect(estaHrLimiteEstourado(passadaAMeiaNoite, em(17, 22, 30))).toBe(false)
    expect(estaHrLimiteEstourado(passadaAMeiaNoite, em(18, 1, 59))).toBe(false)
    expect(estaHrLimiteEstourado(passadaAMeiaNoite, em(18, 2, 0))).toBe(true)
  })

  it('a hora-limite vem da base com segundos (14:00:00) e conta como 14:00', () => {
    expect(estaHrLimiteEstourado(tarefa({ hr_limite: '14:00:00' }), em(17, 14, 0))).toBe(true)
    expect(estaHrLimiteEstourado(tarefa({ hr_limite: '14:00:00' }), em(17, 13, 59))).toBe(false)
  })
  it('valores inválidos nunca alarmam', () => {
    expect(estaHrLimiteEstourado(tarefa({ hr_limite: 'abc' }), em(19, 23, 59))).toBe(false)
    expect(estaHrLimiteEstourado(tarefa({ data_execucao: '' }), em(19, 23, 59))).toBe(false)
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

describe('avaliarSaudeAutomacaoAnual — preenchimento automático anual (cron 1 Nov) falhar em silêncio, achado real 2026-08-27', () => {
  it('sinaliza falha quando a ação mais recente é FALHOU (ex.: trio de H3 incompleto)', () => {
    expect(avaliarSaudeAutomacaoAnual('PREENCHIMENTO_AUTOMATICO_FALHOU')).toBe(true)
  })
  it('sinaliza falha quando a ação mais recente é ERRO (ex.: uma semana bloqueada por trigger)', () => {
    expect(avaliarSaudeAutomacaoAnual('PREENCHIMENTO_AUTOMATICO_ERRO')).toBe(true)
  })
  it('não sinaliza nada quando a ação mais recente foi um sucesso', () => {
    expect(avaliarSaudeAutomacaoAnual('PREENCHIMENTO_AUTOMATICO')).toBe(false)
  })
  it('não sinaliza nada quando a ação mais recente foi ignorada (já existiam dados)', () => {
    expect(avaliarSaudeAutomacaoAnual('PREENCHIMENTO_AUTOMATICO_IGNORADO')).toBe(false)
  })
  it('não sinaliza nada sem nenhum histórico ainda', () => {
    expect(avaliarSaudeAutomacaoAnual(null)).toBe(false)
  })
})

describe('avaliarAvisoAutomacaoAnual — pool de candidatos vazio (ex.: ninguém com turno_fixo=H1) é aviso, não falha', () => {
  it('sinaliza aviso quando a ação mais recente é AVISO', () => {
    expect(avaliarAvisoAutomacaoAnual('PREENCHIMENTO_AUTOMATICO_AVISO')).toBe(true)
  })
  it('não sinaliza aviso para uma falha real (é vermelho, não âmbar — ver avaliarSaudeAutomacaoAnual)', () => {
    expect(avaliarAvisoAutomacaoAnual('PREENCHIMENTO_AUTOMATICO_FALHOU')).toBe(false)
    expect(avaliarAvisoAutomacaoAnual('PREENCHIMENTO_AUTOMATICO_ERRO')).toBe(false)
  })
  it('não sinaliza aviso para um sucesso limpo', () => {
    expect(avaliarAvisoAutomacaoAnual('PREENCHIMENTO_AUTOMATICO')).toBe(false)
  })
  it('não sinaliza nada sem nenhum histórico ainda', () => {
    expect(avaliarAvisoAutomacaoAnual(null)).toBe(false)
  })
})

describe('avaliarAlertaHeadcountMensal — o mês anterior fica pendente até ao dia 5', () => {
  it('não dispara antes do dia 5, mesmo com o mês anterior pendente', () => {
    const hoje = new Date(2026, 8, 4) // 2026-09-04, dia 4
    const r = avaliarAlertaHeadcountMensal(['2026-08-01'], hoje)
    expect(r.avisoAmbar).toBe(false)
  })
  it('dispara âmbar exatamente a partir do dia 5 se o mês anterior ainda está pendente', () => {
    const hoje = new Date(2026, 8, 5) // 2026-09-05
    const r = avaliarAlertaHeadcountMensal(['2026-08-01'], hoje)
    expect(r.avisoAmbar).toBe(true)
    expect(r.avisoVermelho).toBe(false)
  })
  it('não dispara nada se o mês anterior já não está na lista de pendentes (já foi fechado)', () => {
    const hoje = new Date(2026, 8, 10)
    const r = avaliarAlertaHeadcountMensal([], hoje)
    expect(r.avisoAmbar).toBe(false)
    expect(r.avisoVermelho).toBe(false)
  })
  it('dispara vermelho quando há um mês mais antigo que o anterior ainda por fechar', () => {
    const hoje = new Date(2026, 8, 10)
    const r = avaliarAlertaHeadcountMensal(['2026-07-01', '2026-08-01'], hoje)
    expect(r.avisoVermelho).toBe(true)
  })
  it('não dispara vermelho só com o mês anterior pendente (isso é só âmbar)', () => {
    const hoje = new Date(2026, 8, 10)
    const r = avaliarAlertaHeadcountMensal(['2026-08-01'], hoje)
    expect(r.avisoVermelho).toBe(false)
  })
  it('mesesPendentes nunca inclui o mês corrente, mesmo que apareça na lista de entrada', () => {
    const hoje = new Date(2026, 8, 10)
    const r = avaliarAlertaHeadcountMensal(['2026-07-01', '2026-09-01'], hoje)
    expect(r.mesesPendentes).toEqual(['2026-07-01'])
  })
})

describe('avaliarSemanasSemH3 — aviso quando uma semana da escala fica sem H3', () => {
  // Sexta 2026-09-25: a semana em curso é a de Sábado 2026-09-19 (19 a 25).
  const hoje = new Date('2026-09-25T10:00:00')
  const h3Ativos = new Set(['bruno', 'caique', 'kilson'])
  const linha = (semana_ref: string, usuario_id: string, turno: string) => ({ semana_ref, usuario_id, turno })

  it('sem nenhuma semana sem H3, não avisa', () => {
    const escalas = [linha('2026-09-19', 'caique', 'H3'), linha('2026-09-26', 'bruno', 'H3'), linha('2026-10-03', 'kilson', 'H3')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje)).toEqual({ semanas: [], urgente: false })
  })

  it('uma semana futura em que só há outros turnos (o H3 saiu e a escala dele foi apagada) é apontada', () => {
    const escalas = [
      linha('2026-09-19', 'caique', 'H3'),
      linha('2026-09-26', 'caique', 'H3'),
      linha('2026-10-10', 'sergio', 'H1'), // semana com escala, mas ninguém em H3
      linha('2026-10-17', 'caique', 'H3'),
    ]
    const r = avaliarSemanasSemH3(escalas, h3Ativos, hoje)
    expect(r.semanas).toEqual(['2026-10-10'])
    expect(r.urgente).toBe(false)
  })

  it('a semana em curso cujo único H3 já saiu (a linha dele não é apagada) conta, e é urgente', () => {
    const escalas = [linha('2026-09-19', 'rui-que-saiu', 'H3'), linha('2026-09-19', 'sergio', 'H1'), linha('2026-09-26', 'caique', 'H3')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje)).toEqual({ semanas: ['2026-09-19'], urgente: true })
  })

  it('a semana seguinte, que se ativa daqui a 12 horas (sexta às 22h), também é urgente; uma que só se ativa daqui a mais de 14 dias não', () => {
    const seguinte = avaliarSemanasSemH3([linha('2026-09-26', 'sergio', 'H1')], h3Ativos, hoje)
    expect(seguinte).toEqual({ semanas: ['2026-09-26'], urgente: true })
    const daquiA15 = avaliarSemanasSemH3([linha('2026-10-10', 'sergio', 'H1')], h3Ativos, hoje)
    expect(daquiA15).toEqual({ semanas: ['2026-10-10'], urgente: false })
  })

  it('a semana muda às 22h de sexta-feira: às 21h59 ainda conta a que acaba, às 22h00 já não', () => {
    // A semana de 19/09 ficou sem H3 (o dele saiu) e a de 26/09 tem H3.
    const escalas = [linha('2026-09-19', 'rui-que-saiu', 'H3'), linha('2026-09-19', 'sergio', 'H1'), linha('2026-09-26', 'caique', 'H3')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, new Date('2026-09-25T21:59:00'))).toEqual({ semanas: ['2026-09-19'], urgente: true })
    expect(avaliarSemanasSemH3(escalas, h3Ativos, new Date('2026-09-25T22:00:00'))).toEqual({ semanas: [], urgente: false })
  })

  it('"urgente" mede-se até à ativação do H3 (22h de sexta-feira): a exatamente 7 dias já é, um minuto antes não', () => {
    // Semana de 03/10 sem H3: ativa-se na sexta 02/10 às 22h00.
    const escalas = [linha('2026-10-03', 'sergio', 'H1')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, new Date('2026-09-25T21:59:00'))).toEqual({ semanas: ['2026-10-03'], urgente: false })
    expect(avaliarSemanasSemH3(escalas, h3Ativos, new Date('2026-09-25T22:00:00'))).toEqual({ semanas: ['2026-10-03'], urgente: true })
  })

  it('semanas já terminadas não contam', () => {
    const escalas = [linha('2026-09-12', 'sergio', 'H1'), linha('2026-09-05', 'sergio', 'H1')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje)).toEqual({ semanas: [], urgente: false })
  })

  it('não inventa semanas: sem nenhuma linha de escala para lá do que já foi preenchido, não há aviso', () => {
    const escalas = [linha('2026-09-19', 'caique', 'H3'), linha('2026-09-26', 'caique', 'H3')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje).semanas).toEqual([])
  })

  it('só conta como H3 quem é OPERADOR_H3 ativo: um turno H3 de alguém fora desse conjunto não cobre a semana', () => {
    const escalas = [linha('2026-10-03', 'operador-normal', 'H3')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje).semanas).toEqual(['2026-10-03'])
  })

  it('uma linha que não é de sábado (uma troca gravada numa quinta-feira) não é uma semana e não gera aviso', () => {
    // Caso real de 2026-09-25: a troca Caique -> Bruno foi aprovada com a data 15/10 (quinta-feira) e deixou uma
    // linha H2 nesse dia; as semanas de sábado (10/10 e 17/10) têm H3.
    const escalas = [
      linha('2026-10-10', 'bruno', 'H3'),
      linha('2026-10-15', 'bruno', 'H2'),
      linha('2026-10-17', 'caique', 'H3'),
    ]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje)).toEqual({ semanas: [], urgente: false })
  })

  it('uma linha H3 fora de sábado também não cobre a semana de sábado que continua sem H3', () => {
    const escalas = [linha('2026-10-10', 'sergio', 'H1'), linha('2026-10-15', 'caique', 'H3')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje).semanas).toEqual(['2026-10-10'])
  })

  it('caso real de 2026-09-25: todas as semanas de sábado até dezembro têm H3 e há uma linha solta numa quinta-feira', () => {
    const h3PorSabado: Record<string, string> = {
      '2026-09-19': 'kilson', '2026-09-26': 'bruno', '2026-10-03': 'kilson', '2026-10-10': 'bruno', '2026-10-17': 'caique',
      '2026-10-24': 'kilson', '2026-10-31': 'caique', '2026-11-07': 'kilson', '2026-11-14': 'bruno', '2026-11-21': 'kilson',
      '2026-11-28': 'bruno', '2026-12-05': 'caique', '2026-12-12': 'bruno', '2026-12-19': 'kilson', '2026-12-26': 'bruno',
    }
    const escalas = [
      ...Object.entries(h3PorSabado).flatMap(([sabado, h3]) => [linha(sabado, h3, 'H3'), linha(sabado, 'sergio', 'H1')]),
      linha('2026-10-15', 'bruno', 'H2'),
    ]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje)).toEqual({ semanas: [], urgente: false })
  })

  it('devolve as semanas ordenadas da mais próxima para a mais distante', () => {
    const escalas = [linha('2026-11-07', 'sergio', 'H1'), linha('2026-10-03', 'sergio', 'H1'), linha('2026-10-24', 'sergio', 'H1')]
    expect(avaliarSemanasSemH3(escalas, h3Ativos, hoje).semanas).toEqual(['2026-10-03', '2026-10-24', '2026-11-07'])
  })
})
