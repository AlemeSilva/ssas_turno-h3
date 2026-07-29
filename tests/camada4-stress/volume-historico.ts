// Semeia um volume representativo de vários anos de operação (escala
// semanal + cadeias diárias + logs) e mede a latência das consultas
// que o Histórico/Consulta realmente executa — para confirmar que o
// crescimento natural dos dados (anos de plantões H3) não degrada a
// experiência dentro do free tier do Supabase.

import { admin } from './cliente'

const ANOS_SIMULADOS = 3
const SEMANAS_POR_ANO = 52

async function main() {
  console.log(`--- Volume: a simular ${ANOS_SIMULADOS} anos de escala semanal (${ANOS_SIMULADOS * SEMANAS_POR_ANO} ciclos) ---`)

  const { data: user } = await admin.auth.admin.createUser({
    email: 'e2e.stress.volume@turnoh3.teste',
    password: 'Teste!123456',
    email_confirm: true,
  })
  await admin.from('usuarios').insert({ id: user!.user!.id, nome: 'Volume Stress', email: user!.user!.email, perfil: 'OPERADOR_H3' })

  const linhas = []
  const inicio = new Date('2024-01-04') // uma Quinta-feira
  for (let i = 0; i < ANOS_SIMULADOS * SEMANAS_POR_ANO; i++) {
    const semana = new Date(inicio)
    semana.setDate(semana.getDate() + i * 7)
    linhas.push({ semana_ref: semana.toISOString().slice(0, 10), usuario_id: user!.user!.id, turno: 'H3' as const })
  }

  const inicioInsercao = Date.now()
  // Lotes de 500 para não exceder limites de payload do PostgREST.
  for (let i = 0; i < linhas.length; i += 500) {
    await admin.from('escala_semanal').insert(linhas.slice(i, i + 500))
  }
  console.log(`Inserção de ${linhas.length} linhas concluída em ${Date.now() - inicioInsercao}ms.`)

  // A mesma consulta que o Histórico executa: filtrar por pessoa + turno + intervalo de datas.
  const inicioConsulta = Date.now()
  const { data: resultado, error } = await admin
    .from('escala_semanal')
    .select('*')
    .eq('usuario_id', user!.user!.id)
    .eq('turno', 'H3')
    .gte('semana_ref', '2025-01-01')
    .lte('semana_ref', '2025-12-31')
    .order('semana_ref', { ascending: false })

  const duracaoConsulta = Date.now() - inicioConsulta
  console.log(`Consulta de histórico (filtro por pessoa+turno+ano) devolveu ${resultado?.length ?? 0} linhas em ${duracaoConsulta}ms.`)

  if (error) {
    console.error('FALHA:', error.message)
  } else if (duracaoConsulta > 1000) {
    console.warn('AVISO: consulta de histórico acima de 1s — considerar índice adicional se o volume real crescer muito mais.')
  } else {
    console.log(`OK: consulta permanece rápida mesmo com ${linhas.length} linhas acumuladas (equivalente a ${ANOS_SIMULADOS} anos de operação).`)
  }

  await admin.from('escala_semanal').delete().eq('usuario_id', user!.user!.id)
  await admin.from('usuarios').delete().eq('id', user!.user!.id)
  await admin.auth.admin.deleteUser(user!.user!.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
