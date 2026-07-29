// Dispara N pedidos de férias verdadeiramente simultâneos, de pessoas
// diferentes, com datas sobrepostas — para confirmar que a exclusion
// constraint (migração 0004) impede qualquer sobreposição sobreviver,
// mesmo sob concorrência real (Promise.all, não sequencial).

import { admin } from './cliente'

const PREFIXO = 'e2e.stress.ferias'

async function criarUtilizador(chave: string) {
  const email = `${PREFIXO}.${chave}@turnoh3.teste`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'Teste!123456', email_confirm: true })
  if (error) throw error
  await admin.from('usuarios').insert({ id: data.user.id, nome: chave, email, perfil: 'OPERADOR' })
  return data.user.id
}

async function limpar(ids: string[]) {
  for (const id of ids) {
    await admin.from('usuarios').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
}

async function main() {
  console.log('--- Concorrência: pedidos de férias sobrepostos de pessoas diferentes ---')

  const N = 8
  const ids = await Promise.all(Array.from({ length: N }, (_, i) => criarUtilizador(`p${i}`)))

  // Todos pedem exatamente o mesmo período — só UM deve sobreviver.
  const resultados = await Promise.allSettled(
    ids.map((id) =>
      admin.from('ferias').insert({ usuario_id: id, data_inicio: '2027-01-04', data_fim: '2027-01-08' }).select().single()
    )
  )

  const sucesso = resultados.filter((r) => r.status === 'fulfilled' && r.value.error === null)
  const falha = resultados.length - sucesso.length

  console.log(`${sucesso.length} pedido(s) aceite(s) de ${N} disparados em simultâneo (esperado: exatamente 1).`)
  console.log(`${falha} rejeitado(s) pela exclusion constraint / trigger.`)

  if (sucesso.length !== 1) {
    console.error('FALHA: mais do que um pedido sobreposto sobreviveu — verificar a migração 0004.')
    await limpar(ids)
    process.exit(1)
  }

  console.log('OK: a exclusion constraint impediu a corrida, mesmo com 8 pedidos verdadeiramente simultâneos.')
  await limpar(ids)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
