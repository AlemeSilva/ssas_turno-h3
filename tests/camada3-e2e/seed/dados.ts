// Dados de teste partilhados entre o script de seed e os specs —
// única fonte de verdade para não haver credenciais/ids divergentes
// entre quem semeia os dados e quem os usa nos testes.

export const PASSWORD_TESTE = 'Teste!Homologacao2026'

export const UTILIZADORES_TESTE = [
  { chave: 'caique', nome: 'Caique Araújo', email: 'e2e.caique@turnoh3.teste', perfil: 'OPERADOR_H3' as const, limite_h3_mensal: 1 },
  { chave: 'bruno', nome: 'Bruno Diniz', email: 'e2e.bruno@turnoh3.teste', perfil: 'OPERADOR_H3' as const, limite_h3_mensal: null },
  { chave: 'kilson', nome: 'Kilson Júnior', email: 'e2e.kilson@turnoh3.teste', perfil: 'OPERADOR_H3' as const, limite_h3_mensal: null },
  { chave: 'leonardo', nome: 'Leonardo Madruga', email: 'e2e.leonardo@turnoh3.teste', perfil: 'OPERADOR' as const, limite_h3_mensal: null },
  { chave: 'sergio', nome: 'Sérgio Gomes', email: 'e2e.sergio@turnoh3.teste', perfil: 'OPERADOR' as const, limite_h3_mensal: null },
  { chave: 'gerente', nome: 'Gerente Teste', email: 'e2e.gerente@turnoh3.teste', perfil: 'GERENTE' as const, limite_h3_mensal: null },
] as const

function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDias(iso: string, n: number): string {
  // Usa meio-dia UTC para evitar cruzamento de meia-noite por timezone
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * Quinta-feira do ciclo H3 corrente — calculada dinamicamente para que
 * o ChecklistPage (que usa semanaRefDe(new Date())) encontre sempre o
 * plano semeado, independentemente de quando a suite corre.
 * Lógica espelha semanaRefDe() em src/lib/datas.ts.
 */
function quintaCorrentePT(): string {
  const hoje = new Date()
  const isoDay = hoje.getDay() === 0 ? 7 : hoje.getDay()
  const offsets: Record<number, number> = { 4: 0, 5: 1, 6: 2, 7: 3, 1: 4, 2: -2, 3: -1 }
  const quinta = new Date(hoje)
  quinta.setDate(hoje.getDate() - offsets[isoDay])
  return isoLocal(quinta)
}

/** Quinta-feira do ciclo activo no momento em que a suite corre. */
export const CICLO_TESTE = quintaCorrentePT()

/** Sábado do mesmo ciclo (Quinta + 2 dias) — usado em datas de cadeias e testes de alerta. */
export const SABADO_CICLO = addDias(CICLO_TESTE, 2)
