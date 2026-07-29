// Lógica pura do algoritmo de sugestão — sem I/O, sem Deno, sem
// Supabase. Importável tanto pela Edge Function (Deno) como pelos
// testes Vitest (Node), para nunca haver duas versões da mesma regra.

export interface CandidatoH3 {
  id: string
  nome: string
  limite_h3_mensal: number | null
}

export interface SugestaoH3 {
  usuario_id: string
  nome: string
  precisa_override: boolean
}

/**
 * Escolhe o candidato a H3: menor contagem nos últimos 3 meses
 * (janela recente, não histórico completo — para não penalizar quem
 * acabou de entrar na rotação); respeita limite_h3_mensal por pessoa,
 * mas de forma suave — se ninguém elegível estiver dentro do limite,
 * sugere-se mesmo assim, sinalizado como precisa_override (decisão do
 * Gerente, com justificativa, tal como as férias/licenças).
 */
export function escolherOperadorH3(
  candidatos: CandidatoH3[],
  contagem3Meses: Map<string, number>,
  contagemMesAtual: Map<string, number>
): SugestaoH3 | null {
  if (candidatos.length === 0) return null

  const ordenados = [...candidatos].sort(
    (a, b) => (contagem3Meses.get(a.id) ?? 0) - (contagem3Meses.get(b.id) ?? 0)
  )

  const dentroDoLimite = ordenados.filter(
    (c) => c.limite_h3_mensal == null || (contagemMesAtual.get(c.id) ?? 0) < c.limite_h3_mensal
  )

  const escolhido = dentroDoLimite[0] ?? ordenados[0]
  const precisaOverride = dentroDoLimite.length === 0

  return { usuario_id: escolhido.id, nome: escolhido.nome, precisa_override: precisaOverride }
}

export interface AtribuicaoAnterior {
  usuario_id: string
  turno: 'H1' | 'H2' | 'H3' | 'H4'
}

/** H1/H2/H4: sem regra própria — repete a atribuição da semana anterior. */
export function repetirTurnoAnterior(escalaAnterior: AtribuicaoAnterior[], turno: 'H1' | 'H2' | 'H4'): string | null {
  return escalaAnterior.find((e) => e.turno === turno)?.usuario_id ?? null
}
