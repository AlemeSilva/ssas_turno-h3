// Edge Function: gerir-utilizadores
// Regista nova conta, repõe password de outra pessoa, e desativa (com
// invalidação de sessão) — operações que exigem a chave de serviço,
// nunca exposta ao browser. Chamada pela interface em /utilizadores.
//
// Autorização: verifica o chamador através do próprio token da
// requisição (cliente "anon", respeita RLS) antes de usar o cliente
// de administração — nunca confia no que o browser diz sobre si
// próprio.

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface PedidoCriar {
  acao: 'criar'
  nome: string
  email: string
  password: string
  perfil: 'GERENTE' | 'OPERADOR' | 'OPERADOR_H3'
  empresa: string
  limite_h3_mensal: number | null
}

interface PedidoResetPassword {
  acao: 'reset_password'
  usuario_id: string
  nova_password: string
}

interface PedidoDesativar {
  acao: 'desativar'
  usuario_id: string
}

type Pedido = PedidoCriar | PedidoResetPassword | PedidoDesativar

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'Método não permitido' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ erro: 'Não autenticado' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Cliente com o token de quem chamou — só para confirmar quem é e
  // se tem permissão. Nunca usado para as operações privilegiadas.
  const clienteChamador = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: erroUser } = await clienteChamador.auth.getUser()
  if (erroUser || !userData.user) {
    return new Response(JSON.stringify({ erro: 'Sessão inválida' }), { status: 401 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: chamador } = await admin
    .from('usuarios')
    .select('id, perfil, ativo')
    .eq('id', userData.user.id)
    .single()

  const { data: souGerenteOuDelegado } = await clienteChamador.rpc('is_gerente_ou_delegado')

  if (!chamador?.ativo || !souGerenteOuDelegado) {
    return new Response(JSON.stringify({ erro: 'Sem permissão — reservado ao Gerente/delegado.' }), { status: 403 })
  }

  const ehGerenteTitular = chamador.perfil === 'GERENTE'

  const pedido = (await req.json()) as Pedido

  try {
    if (pedido.acao === 'criar') {
      const { nome, email, password, perfil, empresa, limite_h3_mensal } = pedido
      if (!nome || !email || !password || !perfil || !empresa) {
        return new Response(JSON.stringify({ erro: 'Faltam campos obrigatórios.' }), { status: 400 })
      }

      const { data: novoAuth, error: erroCriar } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (erroCriar || !novoAuth.user) {
        return new Response(JSON.stringify({ erro: erroCriar?.message ?? 'Falha ao criar conta.' }), { status: 400 })
      }

      const { error: erroPerfil } = await admin.from('usuarios').insert({
        id: novoAuth.user.id,
        nome,
        email,
        perfil,
        empresa,
        ativo: true,
        limite_h3_mensal: perfil === 'OPERADOR_H3' ? limite_h3_mensal : null,
        data_saida: null,
      })
      if (erroPerfil) {
        // Sem o perfil em usuarios a conta fica inutilizável — remove a
        // conta de autenticação para não deixar um utilizador "fantasma".
        // Se esta limpeza também falhar, regista-se para não desaparecer
        // sem rasto nenhum — fica uma conta de login sem perfil, a
        // precisar de remoção manual.
        const { error: erroLimpeza } = await admin.auth.admin.deleteUser(novoAuth.user.id)
        if (erroLimpeza) {
          await admin.from('logs_auditoria').insert({
            referencia_tipo: 'USUARIO',
            id_usuario: userData.user.id,
            acao: 'UTILIZADOR_FANTASMA',
            descricao_detalhada: `Falha a criar perfil (${erroPerfil.message}) E a limpar a conta de autenticação ${novoAuth.user.id} (${email}): ${erroLimpeza.message}. Requer remoção manual no Supabase.`,
          })
        }
        return new Response(JSON.stringify({ erro: erroPerfil.message }), { status: 400 })
      }

      await admin.from('logs_auditoria').insert({
        referencia_tipo: 'USUARIO',
        id_usuario: userData.user.id,
        acao: 'UTILIZADOR_CRIADO',
        descricao_detalhada: `${nome} (${email}, ${perfil}) registado por ${chamador.id}.`,
      })

      return new Response(JSON.stringify({ id: novoAuth.user.id }), { status: 200 })
    }

    if (pedido.acao === 'reset_password') {
      const { usuario_id, nova_password } = pedido
      if (!usuario_id || !nova_password) {
        return new Response(JSON.stringify({ erro: 'Faltam campos obrigatórios.' }), { status: 400 })
      }

      const { data: alvo } = await admin.from('usuarios').select('nome, perfil').eq('id', usuario_id).single()
      if (!alvo) {
        return new Response(JSON.stringify({ erro: 'Utilizador não encontrado.' }), { status: 404 })
      }
      if (alvo.perfil === 'GERENTE' && !ehGerenteTitular) {
        return new Response(JSON.stringify({ erro: 'Um delegado não pode repor a password do Gerente titular.' }), { status: 403 })
      }

      const { error: erroReset } = await admin.auth.admin.updateUserById(usuario_id, { password: nova_password })
      if (erroReset) {
        return new Response(JSON.stringify({ erro: erroReset.message }), { status: 400 })
      }

      await admin.from('logs_auditoria').insert({
        referencia_tipo: 'USUARIO',
        id_usuario: userData.user.id,
        acao: 'PASSWORD_REPOSTA',
        descricao_detalhada: `Password de ${alvo.nome} reposta por ${chamador.id}.`,
      })

      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (pedido.acao === 'desativar') {
      const { usuario_id } = pedido
      if (!usuario_id) {
        return new Response(JSON.stringify({ erro: 'Falta usuario_id.' }), { status: 400 })
      }

      const { data: alvo } = await admin.from('usuarios').select('nome, perfil').eq('id', usuario_id).single()
      if (!alvo) {
        return new Response(JSON.stringify({ erro: 'Utilizador não encontrado.' }), { status: 404 })
      }
      if (alvo.perfil === 'GERENTE' && !ehGerenteTitular) {
        return new Response(JSON.stringify({ erro: 'Um delegado não pode desativar o Gerente titular.' }), { status: 403 })
      }

      const { error: erroDesativar } = await admin.from('usuarios').update({ ativo: false }).eq('id', usuario_id)
      if (erroDesativar) {
        return new Response(JSON.stringify({ erro: erroDesativar.message }), { status: 400 })
      }

      // Invalida sessões já abertas — supabase-js não expõe um método
      // de admin para "sign out por user id" (só por access token). O
      // schema auth também não costuma estar exposto via REST, por
      // isso a chamada passa por uma função SQL (security definer,
      // ver migração 0018) em vez de aceder a auth.sessions direto.
      const { error: erroRevogar } = await admin.rpc('revogar_sessoes_utilizador', { p_usuario_id: usuario_id })
      if (erroRevogar) {
        return new Response(JSON.stringify({ erro: erroRevogar.message }), { status: 500 })
      }

      await admin.from('logs_auditoria').insert({
        referencia_tipo: 'USUARIO',
        id_usuario: userData.user.id,
        acao: 'UTILIZADOR_DESATIVADO',
        descricao_detalhada: `${alvo.nome} desativado por ${chamador.id}; sessões ativas terminadas.`,
      })

      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ erro: 'Ação desconhecida.' }), { status: 400 })
  } catch (e) {
    return new Response(JSON.stringify({ erro: e instanceof Error ? e.message : 'Erro inesperado.' }), { status: 500 })
  }
})
