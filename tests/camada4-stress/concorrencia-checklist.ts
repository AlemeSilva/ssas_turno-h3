// N tentativas simultâneas de marcar o MESMO item de checklist como
// concluído — todas devem convergir para um estado consistente e
// único (um só concluido_por "vence"), sem duplicar carimbos nem
// deixar o item num estado contraditório.

import { admin } from './cliente'

async function main() {
  console.log('--- Concorrência: marcar o mesmo item de checklist em simultâneo ---')

  const { data: gerente, error: erroGerente } = await admin.auth.admin.createUser({
    email: 'e2e.stress.gerente@turnoh3.teste',
    password: 'Teste!123456',
    email_confirm: true,
  })
  if (erroGerente) throw erroGerente
  await admin.from('usuarios').insert({ id: gerente.user.id, nome: 'Gerente Stress', email: gerente.user.email, perfil: 'GERENTE' })

  const { data: plano } = await admin
    .from('planos')
    .insert({ data_inicio_ciclo: '2027-01-07', criado_por: gerente.user.id })
    .select()
    .single()

  const { data: item } = await admin
    .from('checklist_itens')
    .insert({ id_plano: plano!.id, secao: 'PREPARACAO', item_descricao: 'Item de stress' })
    .select()
    .single()

  const N = 10
  await Promise.allSettled(
    Array.from({ length: N }, () =>
      admin
        .from('checklist_itens')
        .update({ concluido: true, concluido_por: gerente.user.id, data_hora_conclusao: new Date().toISOString() })
        .eq('id', item!.id)
    )
  )

  const { data: estadoFinal } = await admin.from('checklist_itens').select('*').eq('id', item!.id).single()
  console.log('Estado final após 10 escritas concorrentes:', {
    concluido: estadoFinal!.concluido,
    concluido_por: estadoFinal!.concluido_por,
    data_hora_conclusao: estadoFinal!.data_hora_conclusao,
  })

  if (estadoFinal!.concluido !== true || !estadoFinal!.data_hora_conclusao) {
    console.error('FALHA: estado final inconsistente após escrita concorrente.')
    process.exit(1)
  }

  console.log('OK: 10 escritas concorrentes ao mesmo item convergem para um único estado consistente (last-write-wins seguro).')

  await admin.from('planos').delete().eq('id', plano!.id)
  await admin.from('usuarios').delete().eq('id', gerente.user.id)
  await admin.auth.admin.deleteUser(gerente.user.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
