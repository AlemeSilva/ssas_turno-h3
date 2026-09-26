// Lógica pura do algoritmo de sugestão — sem I/O, sem Deno, sem
// Supabase. Importável tanto pela Edge Function (Deno) como pelos
// testes Vitest (Node), para nunca haver duas versões da mesma regra.
//
// As regras de cada turno são as que estão em prática: as do preenchimento
// automático anual da escala (preencher_escala_anual(), migração 0050).
//  - H3: rotação entre os OPERADOR_H3 ativos. Menos H3 nos últimos 3 meses,
//    depois menos no ano, depois o id. Respeita limite_h3_mensal, contando a
//    semana no mês onde cai a maioria dos 7 dias (mesDaSemanaH3).
//  - H2: rotação entre os OPERADOR_H3 ativos com elegivel_h2, sem o H3 da
//    semana; as mesmas contagens, de H2.
//  - H4: os OPERADOR_H3 que nessa semana não são H3 nem H2, os OPERADOR com
//    turno_fixo H4 e o Gerente ativo mais antigo.
//  - H1: os OPERADOR com turno_fixo H1.

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

/** Menos turnos na janela de 3 meses, depois menos no ano, depois o id (desempate estável). */
function ordenarPorRotacao<T extends { id: string }>(
  candidatos: T[],
  contagem3Meses: Map<string, number>,
  contagemAno: Map<string, number>
): T[] {
  return [...candidatos].sort(
    (a, b) =>
      (contagem3Meses.get(a.id) ?? 0) - (contagem3Meses.get(b.id) ?? 0) ||
      (contagemAno.get(a.id) ?? 0) - (contagemAno.get(b.id) ?? 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
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
  contagemMesAtual: Map<string, number>,
  contagemAno: Map<string, number> = new Map()
): SugestaoH3 | null {
  if (candidatos.length === 0) return null

  const ordenados = ordenarPorRotacao(candidatos, contagem3Meses, contagemAno)

  const dentroDoLimite = ordenados.filter(
    (c) => c.limite_h3_mensal == null || (contagemMesAtual.get(c.id) ?? 0) < c.limite_h3_mensal
  )

  const escolhido = dentroDoLimite[0] ?? ordenados[0]
  const precisaOverride = dentroDoLimite.length === 0

  return { usuario_id: escolhido.id, nome: escolhido.nome, precisa_override: precisaOverride }
}

/** H2: o elegível com menos H2 nos últimos 3 meses, depois no ano, depois o id; null se não houver elegíveis. */
export function escolherOperadorH2(
  elegiveis: { id: string }[],
  contagem3Meses: Map<string, number>,
  contagemAno: Map<string, number>
): string | null {
  return ordenarPorRotacao(elegiveis, contagem3Meses, contagemAno)[0]?.id ?? null
}

/** `true` se a data ISO (AAAA-MM-DD) é um sábado: a escala e a sugestão são por semana H3, que começa ao sábado. */
export function ehSabado(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(iso + 'T00:00:00Z').getUTCDay() === 6
}

/** Soma dias a uma data ISO (AAAA-MM-DD) em UTC, sem depender do fuso de quem corre. */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

/** Recua meses a uma data ISO como o Postgres (`data - interval '3 months'`): se o dia não existir no mês de chegada, fica no último. */
export function subtrairMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const primeiroDoMes = new Date(Date.UTC(ano, mes - 1 - meses, 1))
  const ultimoDia = new Date(Date.UTC(primeiroDoMes.getUTCFullYear(), primeiroDoMes.getUTCMonth() + 1, 0)).getUTCDate()
  primeiroDoMes.setUTCDate(Math.min(dia, ultimoDia))
  return primeiroDoMes.toISOString().slice(0, 10)
}

/**
 * Mês ("AAAA-MM") a que pertence a semana H3 que começa no sábado `semanaRef`: o
 * do 4.º dia (semana_ref + 3), onde cai a maioria dos 7 dias. É o critério do
 * limite mensal na base de dados (migração 0050); a sugestão tem de o seguir para
 * não propor o que o trigger depois recusa.
 */
export function mesDaSemanaH3(semanaRef: string): string {
  return somarDias(semanaRef, 3).slice(0, 7)
}

/**
 * Intervalo [inicio, fim) de semana_ref das semanas que pertencem ao mesmo mês
 * que a semana `semanaRef`, pelo critério de mesDaSemanaH3.
 */
export function janelaDoMesH3(semanaRef: string): { inicio: string; fim: string } {
  const mes = mesDaSemanaH3(semanaRef)
  const [ano, mesNum] = mes.split('-').map(Number)
  // mesNum é de 1 a 12, por isso Date.UTC(ano, mesNum, 1) já é o 1.º dia do mês seguinte.
  const primeiroDoSeguinte = new Date(Date.UTC(ano, mesNum, 1)).toISOString().slice(0, 10)
  return { inicio: somarDias(`${mes}-01`, -3), fim: somarDias(primeiroDoSeguinte, -3) }
}

export interface UtilizadorAtivo {
  id: string
  nome: string
  perfil: string
  limite_h3_mensal: number | null
  /** Só conta para OPERADOR_H3: pode ocupar H2 na rotação. */
  elegivel_h2: boolean
  /** Só conta para OPERADOR: H1 ou H4 todas as semanas. */
  turno_fixo: 'H1' | 'H4' | null
  criado_em: string
}

export interface LinhaHistorico {
  usuario_id: string
  turno: string
  semana_ref: string
}

export interface EntradaSugestao {
  /** O sábado em que a semana H3 começa. */
  semanaRef: string
  /** Só quem está ativo: quem saiu da equipa nunca entra na sugestão. */
  utilizadores: UtilizadorAtivo[]
  /** Linhas H3 e H2 da escala desde o início da janela de contagem (3 meses ou 1 de janeiro, o que vier primeiro). */
  historicoH3H2: LinhaHistorico[]
  /** Um id por cada H3 nas outras semanas do mesmo mês (janelaDoMesH3), as anteriores e as seguintes. */
  h3NoMes: string[]
  /** Quem tem férias (aprovadas ou pendentes) a sobrepor a semana: não é proposto para H3. */
  comFerias: ReadonlySet<string>
}

export interface SugestaoSemana {
  semana_ref: string
  H3: SugestaoH3 | null
  H2: string | null
  H1: string[]
  H4: string[]
}

/** A semana inteira, com as regras de cada turno (ver o cabeçalho deste ficheiro). */
export function sugerirSemana(e: EntradaSugestao): SugestaoSemana {
  const inicio3Meses = subtrairMeses(e.semanaRef, 3)
  const inicioAno = `${e.semanaRef.slice(0, 4)}-01-01`
  const contar = (turno: 'H3' | 'H2', desde: string) => {
    const contagem = new Map<string, number>()
    for (const l of e.historicoH3H2) {
      if (l.turno === turno && l.semana_ref >= desde && l.semana_ref < e.semanaRef) {
        contagem.set(l.usuario_id, (contagem.get(l.usuario_id) ?? 0) + 1)
      }
    }
    return contagem
  }
  const contagemMes = new Map<string, number>()
  for (const id of e.h3NoMes) contagemMes.set(id, (contagemMes.get(id) ?? 0) + 1)

  const operadoresH3 = e.utilizadores.filter((u) => u.perfil === 'OPERADOR_H3')

  const h3 = escolherOperadorH3(
    operadoresH3.filter((u) => !e.comFerias.has(u.id)),
    contar('H3', inicio3Meses),
    contagemMes,
    contar('H3', inicioAno)
  )
  const h2 = escolherOperadorH2(
    operadoresH3.filter((u) => u.elegivel_h2 && u.id !== h3?.usuario_id),
    contar('H2', inicio3Meses),
    contar('H2', inicioAno)
  )
  const gerenteTitular = e.utilizadores
    .filter((u) => u.perfil === 'GERENTE')
    .sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em) || (a.id < b.id ? -1 : 1))[0]

  return {
    semana_ref: e.semanaRef,
    H3: h3,
    H2: h2,
    H1: e.utilizadores.filter((u) => u.perfil === 'OPERADOR' && u.turno_fixo === 'H1').map((u) => u.id),
    H4: [
      ...operadoresH3.filter((u) => u.id !== h3?.usuario_id && u.id !== h2).map((u) => u.id),
      ...e.utilizadores.filter((u) => u.perfil === 'OPERADOR' && u.turno_fixo === 'H4').map((u) => u.id),
      ...(gerenteTitular ? [gerenteTitular.id] : []),
    ],
  }
}
