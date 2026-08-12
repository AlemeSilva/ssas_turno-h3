// Lógica pura de composição da escala para um operador — usada tanto
// ao registar como ao reativar (mesma necessidade: escala vazia a
// preencher até ao fim do ano). Espelho literal de
// supabase/functions/gerir-utilizadores/composicaoEscala.ts —
// deliberadamente duplicado, não importado por cross-tree, mesmo
// padrão já usado por supabase/functions/sugerir-escala/algoritmo.ts
// (cada lado do Deno/Vite mantém a sua própria cópia autossuficiente).

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
 * escala_semanal) a compor para um operador a partir da data indicada
 * (registo ou reativação): do primeiro Sábado a partir do dia seguinte
 * até 31/12 do ano corrente. Se a data cair em Novembro ou Dezembro —
 * já depois do preenchimento automático anual de 1 de novembro (ver
 * migração 0015/0019) ter corrido para o ano seguinte sem esta pessoa
 * ativa — também compõe o ano seguinte inteiro, para não ficar sem
 * escala a partir de Janeiro.
 */
export function semanasParaNovoOperador(dataReferenciaISO: string): string[] {
  const referencia = new Date(dataReferenciaISO + 'T00:00:00')
  const amanha = adicionarDias(referencia, 1)
  const anoReferencia = referencia.getFullYear()

  const semanas: string[] = []

  let sabado = primeiroSabadoApartirDe(amanha)
  const fimAnoReferencia = new Date(anoReferencia, 11, 31)
  while (sabado <= fimAnoReferencia) {
    semanas.push(paraISO(sabado))
    sabado = adicionarDias(sabado, 7)
  }

  // Novembro = mês 10 (0-indexado).
  if (referencia.getMonth() >= 10) {
    let sabadoSeguinte = primeiroSabadoApartirDe(new Date(anoReferencia + 1, 0, 1))
    const fimAnoSeguinte = new Date(anoReferencia + 1, 11, 31)
    while (sabadoSeguinte <= fimAnoSeguinte) {
      semanas.push(paraISO(sabadoSeguinte))
      sabadoSeguinte = adicionarDias(sabadoSeguinte, 7)
    }
  }

  return semanas
}
