// Edge Function: sugerir-escala
// Sugere (não aplica) a atribuição de H1/H2/H3/H4 para uma semana
// (semana_ref = Quinta-feira de referência). A aplicação real na
// escala_semanal é sempre um ato explícito do Gerente/delegado na UI —
// esta função só propõe. A decisão em si (escolherOperadorH3 /
// repetirTurnoAnterior) vive em ./algoritmo.ts, sem I/O, testada em
// tests/camada2-regras/algoritmo-sugestao-h3.test.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { escolherOperadorH3, repetirTurnoAnterior, type CandidatoH3 } from './algoritmo.ts'

interface Payload {
  semana_ref: string // YYYY-MM-DD, Quinta-feira
}

// O browser envia sempre um pré-voo OPTIONS antes de um POST com
// cabeçalho Authorization — sem estes cabeçalhos em todas as respostas
// (incluindo o próprio pré-voo), o browser bloqueia o pedido antes de
// chegar aqui, mesmo que a função em si esteja saudável.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405, headers: corsHeaders })
  }

  const { semana_ref }: Payload = await req.json()
  if (!semana_ref) {
    return new Response(JSON.stringify({ erro: 'semana_ref em falta' }), { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const semanaAnterior = new Date(semana_ref + 'T00:00:00')
  semanaAnterior.setDate(semanaAnterior.getDate() - 7)
  const semanaAnteriorISO = semanaAnterior.toISOString().slice(0, 10)

  const tresMesesAtras = new Date(semana_ref + 'T00:00:00')
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3)
  const tresMesesAtrasISO = tresMesesAtras.toISOString().slice(0, 10)

  const fimSemana = new Date(semana_ref + 'T00:00:00')
  fimSemana.setDate(fimSemana.getDate() + 6)
  const fimSemanaISO = fimSemana.toISOString().slice(0, 10)

  // --- Candidatos a H3 ---
  const { data: candidatosH3 } = await supabase
    .from('usuarios')
    .select('id, nome, limite_h3_mensal')
    .eq('perfil', 'OPERADOR_H3')
    .eq('ativo', true)

  const { data: feriasConflito } = await supabase
    .from('ferias')
    .select('usuario_id')
    .in('status', ['APROVADA', 'PENDENTE'])
    .lte('data_inicio', fimSemanaISO)
    .gte('data_fim', semana_ref)

  const idsComFerias = new Set((feriasConflito ?? []).map((f) => f.usuario_id))
  const elegiveis: CandidatoH3[] = (candidatosH3 ?? []).filter((c) => !idsComFerias.has(c.id))

  const { data: turnosRecentes } = await supabase
    .from('escala_semanal')
    .select('usuario_id, semana_ref')
    .eq('turno', 'H3')
    .gte('semana_ref', tresMesesAtrasISO)
    .lt('semana_ref', semana_ref)

  const contagem3Meses = new Map<string, number>()
  for (const t of turnosRecentes ?? []) {
    contagem3Meses.set(t.usuario_id, (contagem3Meses.get(t.usuario_id) ?? 0) + 1)
  }

  const inicioMes = semana_ref.slice(0, 7) + '-01'
  const { data: turnosMesAtual } = await supabase
    .from('escala_semanal')
    .select('usuario_id')
    .eq('turno', 'H3')
    .gte('semana_ref', inicioMes)
    .lt('semana_ref', semana_ref)

  const contagemMes = new Map<string, number>()
  for (const t of turnosMesAtual ?? []) {
    contagemMes.set(t.usuario_id, (contagemMes.get(t.usuario_id) ?? 0) + 1)
  }

  const sugestaoH3 = escolherOperadorH3(elegiveis, contagem3Meses, contagemMes)

  // --- H1 / H2 / H4: repete a semana anterior ---
  const { data: escalaAnterior } = await supabase
    .from('escala_semanal')
    .select('usuario_id, turno')
    .eq('semana_ref', semanaAnteriorISO)
    .in('turno', ['H1', 'H2', 'H4'])

  const sugestao = {
    semana_ref,
    H3: sugestaoH3,
    H1: repetirTurnoAnterior(escalaAnterior ?? [], 'H1'),
    H2: repetirTurnoAnterior(escalaAnterior ?? [], 'H2'),
    H4: repetirTurnoAnterior(escalaAnterior ?? [], 'H4'),
  }

  return new Response(JSON.stringify(sugestao), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
