// Edge Function: desactivar-saidos
// Desativa automaticamente utilizadores cuja data_saida já passou.
// Invocada por cron diário (1h00 UTC) via Supabase Scheduled Functions.
// Pode também ser chamada manualmente pelo Gerente via POST.

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const hoje = new Date().toISOString().slice(0, 10)

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
