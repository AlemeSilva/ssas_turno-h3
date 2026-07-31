// Mede o tempo entre uma escrita e a chegada do evento Realtime num
// cliente subscrito — a app depende disto para o requisito de
// "alterações aparecem instantaneamente em todas as sessões abertas,
// sem F5" durante a reunião de planeamento.
//
// Nota: usa admin (service_role) como subscriber para isolar a latência
// de Realtime da complexidade de autenticação JWT. O RLS é testado na
// CAMADA 1; aqui é só medir latência bruta.

import { admin } from './cliente'

async function main() {
  console.log('--- Latência do Supabase Realtime (escrita → evento recebido) ---')

  const EMAIL_GERENTE = 'e2e.stress.realtime.gerente@turnoh3.teste'

  const { data: gerente } = await admin.auth.admin.createUser({
    email: EMAIL_GERENTE,
    password: 'Teste!123456',
    email_confirm: true,
  })
  await admin.from('usuarios').insert({ id: gerente!.user!.id, nome: 'Gerente Realtime', email: EMAIL_GERENTE, perfil: 'GERENTE' })

  const { data: plano } = await admin
    .from('planos')
    .insert({ data_inicio_ciclo: '2027-01-14', criado_por: gerente!.user!.id, observacoes_gerais: 'valor inicial' })
    .select()
    .single()

  const amostras: number[] = []

  await new Promise<void>((resolve, reject) => {
    const timeoutGeral = setTimeout(() => reject(new Error('Timeout à espera de eventos Realtime — verificar se o Realtime está ativado no projeto.')), 20_000)

    let recebidos = 0
    const N_AMOSTRAS = 5
    let inicioEscrita = 0

    const canal = admin
      .channel('latencia-teste')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'planos' }, (payload) => {
        if ((payload.new as { id: number }).id !== plano!.id) return
        amostras.push(Date.now() - inicioEscrita)
        recebidos++
        if (recebidos >= N_AMOSTRAS) {
          clearTimeout(timeoutGeral)
          admin.removeChannel(canal)
          resolve()
        } else {
          disparaProximaEscrita()
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') disparaProximaEscrita()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeoutGeral)
          reject(new Error(`Canal Realtime em estado inesperado: ${status}`))
        }
      })

    function disparaProximaEscrita() {
      inicioEscrita = Date.now()
      admin.from('planos').update({ observacoes_gerais: `escrita ${Date.now()}` }).eq('id', plano!.id).then()
    }
  })

  const media = amostras.reduce((a, b) => a + b, 0) / amostras.length
  const maximo = Math.max(...amostras)
  console.log(`Amostras (ms): ${amostras.join(', ')}`)
  console.log(`Latência média: ${media.toFixed(0)}ms · máxima: ${maximo}ms`)

  if (maximo > 3000) {
    console.warn('AVISO: latência acima de 3s numa amostra — vale a pena investigar antes de confiar na sincronização em reunião.')
  } else {
    console.log('OK: latência do Realtime dentro de um intervalo aceitável para uso em reunião ao vivo.')
  }

  await admin.from('planos').delete().eq('id', plano!.id)
  await admin.from('usuarios').delete().eq('id', gerente!.user!.id)
  await admin.auth.admin.deleteUser(gerente!.user!.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
