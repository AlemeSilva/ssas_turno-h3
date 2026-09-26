// Edge Function: sugerir-escala
// Sugere (não aplica) a atribuição de H1/H2/H3/H4 para uma semana
// (semana_ref = o sábado em que a semana H3 começa). A aplicação real na
// escala_semanal é sempre um ato explícito do Gerente/delegado na UI —
// esta função só propõe. A decisão em si (as regras de cada turno, as do
// preenchimento automático anual) vive em ./algoritmo.ts, sem I/O, testada em
// tests/camada2-regras/algoritmo-sugestao-h3.test.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  ehSabado,
  janelaDoMesH3,
  somarDias,
  subtrairMeses,
  sugerirSemana,
  type LinhaHistorico,
  type UtilizadorAtivo,
} from './algoritmo.ts'

interface Payload {
  semana_ref: string // YYYY-MM-DD, sábado
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
  // A escala é ao sábado. Uma quinta (o rótulo antigo do painel, ou um ecrã por
  // atualizar) proporia uma semana que não existe e o "Aplicar" gravaria uma linha solta.
  if (!ehSabado(semana_ref)) {
    return new Response(JSON.stringify({ erro: 'semana_ref tem de ser um sábado (AAAA-MM-DD)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Só quem está ativo: quem saiu da equipa nunca é proposto (desativar apaga a
  // escala futura, não a das semanas passadas). Se esta consulta falhar, a lista
  // fica vazia e nada é sugerido (falha para o lado seguro: por decidir, nunca
  // um nome errado).
  const { data: utilizadores } = await supabase
    .from('usuarios')
    .select('id, nome, perfil, limite_h3_mensal, elegivel_h2, turno_fixo, criado_em')
    .eq('ativo', true)

  // Férias (aprovadas ou pendentes) a sobrepor a semana, de sábado a sexta.
  const { data: feriasConflito } = await supabase
    .from('ferias')
    .select('usuario_id')
    .in('status', ['APROVADA', 'PENDENTE'])
    .lte('data_inicio', somarDias(semana_ref, 6))
    .gte('data_fim', semana_ref)

  // Rotação de H3 e de H2: quantas vezes cada pessoa os teve nos últimos 3 meses
  // e no ano. Uma só consulta, desde o início da mais larga das duas janelas.
  const inicioAno = `${semana_ref.slice(0, 4)}-01-01`
  const tresMesesAtras = subtrairMeses(semana_ref, 3)
  const { data: historico } = await supabase
    .from('escala_semanal')
    .select('usuario_id, turno, semana_ref')
    .in('turno', ['H3', 'H2'])
    .gte('semana_ref', inicioAno < tresMesesAtras ? inicioAno : tresMesesAtras)
    .lt('semana_ref', semana_ref)

  // Mesmo critério do limite mensal na base de dados (migração 0050): a semana conta
  // no mês onde cai a maioria dos 7 dias, e o trigger conta todas as semanas H3 desse
  // mês, não só as anteriores a esta.
  const { inicio: inicioMes, fim: fimMes } = janelaDoMesH3(semana_ref)
  const { data: turnosMes } = await supabase
    .from('escala_semanal')
    .select('usuario_id')
    .eq('turno', 'H3')
    .gte('semana_ref', inicioMes)
    .lt('semana_ref', fimMes)
    .neq('semana_ref', semana_ref)

  const sugestao = sugerirSemana({
    semanaRef: semana_ref,
    utilizadores: (utilizadores ?? []) as UtilizadorAtivo[],
    historicoH3H2: (historico ?? []) as LinhaHistorico[],
    h3NoMes: (turnosMes ?? []).map((t) => t.usuario_id as string),
    comFerias: new Set((feriasConflito ?? []).map((f) => f.usuario_id as string)),
  })

  return new Response(JSON.stringify(sugestao), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
