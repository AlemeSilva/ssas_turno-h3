// Lógica pura de composição da escala para um operador recém-
// registado — sem I/O, sem Deno, sem Supabase. Importável tanto pela
// Edge Function (Deno) como pelos testes Vitest (Node), mesmo padrão
// de supabase/functions/sugerir-escala/algoritmo.ts.

function isoWeekday(d: Date): number {
  const dia = d.getDay()
  return dia === 0 ? 7 : dia
}

function paraISO(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function adicionarDias(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Primeiro Sábado a partir da data indicada (inclusive). */
function primeiroSabadoApartirDe(d: Date): Date {
  const deslocamento = (6 - isoWeekday(d) + 7) % 7
  return adicionarDias(d, deslocamento)
}

/**
 * Semanas (semana_ref, sempre Sábado — mesma convenção de
 * escala_semanal) a compor para um operador registado na data
 * indicada: do primeiro Sábado a partir do dia seguinte ao registo
 * até 31/12 do ano corrente. Se o registo ocorrer em Novembro ou
 * Dezembro — já depois do preenchimento automático anual de 1 de
 * novembro (ver migração 0015/0019) ter corrido para o ano seguinte
 * sem esta pessoa existir ainda — também compõe o ano seguinte
 * inteiro, para não ficar sem escala a partir de Janeiro.
 */
export function semanasParaNovoOperador(dataRegistoISO: string): string[] {
  const registo = new Date(dataRegistoISO + 'T00:00:00')
  const amanha = adicionarDias(registo, 1)
  const anoRegisto = registo.getFullYear()

  const semanas: string[] = []

  let sabado = primeiroSabadoApartirDe(amanha)
  const fimAnoRegisto = new Date(anoRegisto, 11, 31)
  while (sabado <= fimAnoRegisto) {
    semanas.push(paraISO(sabado))
    sabado = adicionarDias(sabado, 7)
  }

  // Novembro = mês 10 (0-indexado) — registo em Novembro ou Dezembro.
  if (registo.getMonth() >= 10) {
    let sabadoSeguinte = primeiroSabadoApartirDe(new Date(anoRegisto + 1, 0, 1))
    const fimAnoSeguinte = new Date(anoRegisto + 1, 11, 31)
    while (sabadoSeguinte <= fimAnoSeguinte) {
      semanas.push(paraISO(sabadoSeguinte))
      sabadoSeguinte = adicionarDias(sabadoSeguinte, 7)
    }
  }

  return semanas
}
