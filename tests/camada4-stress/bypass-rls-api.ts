// Ataca a API diretamente (PostgREST via anon key), sem passar pela
// UI — exatamente o que um utilizador mal-intencionado, ou só
// curioso com as devtools abertas, tentaria. A UI esconder um botão
// não é segurança; isto é o teste que confirma que a fronteira real
// (RLS) aguenta mesmo sem a UI à frente.

import { admin, clienteAnonimo } from './cliente'

async function main() {
  console.log('--- Tentativas de bypass de RLS via API direta (anon key, sem sessão) ---')
  let falhas = 0

  const anonimo = clienteAnonimo()

  // 1. Ler dados sem sessão nenhuma (nem sequer autenticado)
  const { data: leituraAnonima, error: erroLeitura } = await anonimo.from('usuarios').select('*')
  if (!erroLeitura && leituraAnonima && leituraAnonima.length > 0) {
    console.error('FALHA DE SEGURANÇA: um pedido totalmente anónimo (sem login) conseguiu ler a tabela usuarios.')
    falhas++
  } else {
    console.log('OK: leitura anónima sem sessão é corretamente recusada (política restrita a `authenticated`).')
  }

  // 2. Tentar escrever sem sessão nenhuma
  const { error: erroEscritaAnonima } = await anonimo
    .from('planos')
    .insert({ data_inicio_ciclo: '2027-02-04', criado_por: null })
  if (!erroEscritaAnonima) {
    console.error('FALHA DE SEGURANÇA: um pedido anónimo conseguiu inserir um plano.')
    falhas++
  } else {
    console.log('OK: escrita anónima sem sessão é corretamente recusada.')
  }

  // 3. Um OPERADOR autenticado (login real, sessão válida) a atacar
  //    diretamente a API para tentar aprovar o seu próprio pedido de
  //    férias — coisa que a UI nunca oferece, mas a API tem de recusar
  //    de qualquer forma.
  const { data: operador } = await admin.auth.admin.createUser({
    email: 'e2e.stress.operador@turnoh3.teste',
    password: 'Teste!123456',
    email_confirm: true,
  })
  await admin.from('usuarios').insert({ id: operador!.user!.id, nome: 'Operador Stress', email: operador!.user!.email, perfil: 'OPERADOR' })

  const { data: sessao } = await anonimo.auth.signInWithPassword({
    email: 'e2e.stress.operador@turnoh3.teste',
    password: 'Teste!123456',
  })

  const { data: pedido } = await admin
    .from('ferias')
    .insert({ usuario_id: operador!.user!.id, data_inicio: '2027-03-01', data_fim: '2027-03-02' })
    .select()
    .single()

  const clienteOperador = clienteAnonimo()
  await clienteOperador.auth.setSession({
    access_token: sessao!.session!.access_token,
    refresh_token: sessao!.session!.refresh_token,
  })

  await clienteOperador
    .from('ferias')
    .update({ status: 'APROVADA', aprovado_por: operador!.user!.id })
    .eq('id', pedido!.id)

  const { data: pedidoDepois } = await admin.from('ferias').select('status').eq('id', pedido!.id).single()
  if (pedidoDepois!.status === 'APROVADA') {
    console.error('FALHA DE SEGURANÇA: um OPERADOR conseguiu auto-aprovar o próprio pedido de férias via API direta.')
    falhas++
  } else {
    console.log('OK: um OPERADOR não consegue auto-aprovar férias via API direta, mesmo com sessão válida.')
  }

  // limpeza
  await admin.from('ferias').delete().eq('id', pedido!.id)
  await admin.from('usuarios').delete().eq('id', operador!.user!.id)
  await admin.auth.admin.deleteUser(operador!.user!.id)

  if (falhas > 0) {
    console.error(`${falhas} falha(s) de segurança encontrada(s).`)
    process.exit(1)
  }
  console.log('Nenhuma falha de segurança encontrada nas tentativas de bypass testadas.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
