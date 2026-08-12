// Edge Function: desactivar-saidos
// Desativa automaticamente utilizadores cuja data_saida já passou.
// Invocada por cron diário (1h00 UTC) via Supabase Scheduled Functions.
// Pode também ser chamada manualmente pelo Gerente via POST.

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Nunca usar toISOString() para "hoje" — converte para UTC, e com
// Portugal em UTC+1 no horário de verão isso cria uma janela diária
// (00h-00h59 hora de Lisboa) em que esta função ainda pensa que é
// "ontem". Mesmo anti-padrão documentado em src/lib/datas.ts::paraISO().
// Na prática o cron (01h00 UTC, ver supabase/config.toml) já corre
// depois da meia-noite de Lisboa ter passado, mas a função também pode
// ser chamada manualmente (ver comentário acima) — não depender disso.
function hojeISO(): string {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const hoje = hojeISO()

  const { data: saidos, error: erroBusca } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('ativo', true)
    .not('data_saida', 'is', null)
    .lt('data_saida', hoje)

  if (erroBusca) {
    return new Response(JSON.stringify({ erro: erroBusca.message }), { status: 500 })
  }

  if (!saidos || saidos.length === 0) {
    return new Response(JSON.stringify({ desativados: 0 }), { status: 200 })
  }

  const ids = saidos.map((u) => u.id)

  const { error: erroUpdate } = await supabase
    .from('usuarios')
    .update({ ativo: false })
    .in('id', ids)

  if (erroUpdate) {
    return new Response(JSON.stringify({ erro: erroUpdate.message }), { status: 500 })
  }

  // Remove a escala futura de quem saiu — mesmo comportamento do
  // caminho manual (ver gerir-utilizadores/index.ts) para não deixar
  // turnos atribuídos a alguém que já não está na equipa.
  await supabase.from('escala_semanal').delete().in('usuario_id', ids).gte('semana_ref', hoje)

  // Regista na auditoria (um log por utilizador desativado)
  await supabase.from('logs_auditoria').insert(
    saidos.map((u) => ({
      referencia_tipo: 'USUARIO',
      referencia_id: null,
      id_usuario: null,
      acao: 'DESATIVACAO_AUTOMATICA',
      descricao_detalhada: `Utilizador ${u.nome} desativado automaticamente por data_saida ultrapassada.`,
    }))
  )

  return new Response(
    JSON.stringify({ desativados: saidos.length, nomes: saidos.map((u) => u.nome) }),
    { status: 200 }
  )
})
