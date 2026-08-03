// Utilitários de datas — âncora semanal = Quinta-feira (semana_ref),
// cobrindo Quinta a Quarta-feira seguinte (7 dias). Locale sempre pt-PT.

// Nunca usar toISOString() aqui — converte para UTC e, com Portugal em
// UTC+1 no horário de verão (que cobre a maior parte da época H3),
// causa erro de "um dia a menos" perto da meia-noite local. Construção
// manual a partir dos componentes locais da data evita o problema.
export function paraISO(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function isoWeekday(d: Date): number {
  const dia = d.getDay()
  return dia === 0 ? 7 : dia
}

// Deslocamento (em dias) até à Quinta-feira do ciclo H3 a que esta
// data pertence. O ciclo é Qui→Seg (5 dias); Terça e Quarta ficam
// "entre ciclos" e apontam para a Quinta seguinte (ainda não há plano
// criado). Nunca usar aritmética modular ingénua aqui — testado
// explicitamente em tests/camada2-regras/datas.test.ts porque uma
// versão anterior tratava Segunda-feira como pertencendo ao ciclo
// seguinte em vez do que estava a terminar.
const DESLOCAMENTO_ATE_QUINTA: Record<number, number> = {
  4: 0, // Quinta
  5: 1, // Sexta
  6: 2, // Sábado
  7: 3, // Domingo
  1: 4, // Segunda — ainda é o fim do ciclo que começou na Quinta anterior
  2: -2, // Terça — aponta para a próxima Quinta
  3: -1, // Quarta — aponta para a próxima Quinta
}

/** Quinta-feira (semana_ref) do ciclo H3 a que a data indicada pertence. */
export function semanaRefDe(d: Date): Date {
  const deslocamento = DESLOCAMENTO_ATE_QUINTA[isoWeekday(d)]
  const resultado = new Date(d)
  resultado.setDate(resultado.getDate() - deslocamento)
  resultado.setHours(0, 0, 0, 0)
  return resultado
}

export function adicionarDias(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/**
 * Conta dias úteis (Segunda a Sexta, ambos inclusive) entre duas datas
 * ISO — espelha exatamente a função SQL dias_uteis() usada pelo
 * trigger do limite anual de 22 dias, para o resumo de férias no
 * frontend mostrar sempre o mesmo número que a base de dados aplica.
 */
export function diasUteis(inicioISO: string, fimISO: string): number {
  let d = new Date(inicioISO + 'T00:00:00')
  const fim = new Date(fimISO + 'T00:00:00')
  let contagem = 0
  while (d <= fim) {
    if (isoWeekday(d) < 6) contagem++
    d = adicionarDias(d, 1)
  }
  return contagem
}

export function formatarDataPT(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatarMesAnoPT(d: Date): string {
  const texto = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Em produção devolve new Date(). Em testes E2E, usa window.__TEST_TIME__ se definido,
 *  evitando que page.clock.setSystemTime() afecte o JWT do Supabase e cause rate-limiting. */
export function agora(): Date {
  if (typeof window !== 'undefined') {
    const t = (window as { __TEST_TIME__?: string }).__TEST_TIME__
    if (t) return new Date(t)
  }
  return new Date()
}

/**
 * Sexta-feira administrativa (início do período semanal real, tal
 * como usado nos emails/relatório) — hoje, se hoje já for sexta,
 * senão a próxima. Deliberadamente diferente de semanaRefDe() (âncora
 * de quinta, ciclo do Plano de Fim de Semana).
 */
export function proximaSextaISO(referencia: Date = agora()): string {
  const diasAteSexta = (5 - referencia.getDay() + 7) % 7
  return paraISO(adicionarDias(referencia, diasAteSexta))
}

/**
 * Quinta-feira da escala (H1-H4) em vigor nesta data — diferente de
 * semanaRefDe(): essa serve o ciclo Qui→Seg do Plano de Fim de Semana
 * e propositadamente avança Terça/Quarta para a quinta seguinte (não
 * há plano a meio da semana). A escala cobre a semana inteira
 * (Qui→Qua seguinte), por isso recua sempre até à quinta mais
 * recente, todos os dias sem exceção — só avança no próprio dia em
 * que o Gerente publica o relatório novo, nunca antes.
 */
export function quintaEscalaDe(d: Date): Date {
  const deslocamento = (isoWeekday(d) - 4 + 7) % 7
  const resultado = new Date(d)
  resultado.setDate(resultado.getDate() - deslocamento)
  resultado.setHours(0, 0, 0, 0)
  return resultado
}

/** Sábado ou Domingo — ao fim de semana só o H3 está escalado. */
export function ehFimDeSemana(diaISO: string): boolean {
  const dia = isoWeekday(new Date(diaISO + 'T00:00:00'))
  return dia === 6 || dia === 7
}
