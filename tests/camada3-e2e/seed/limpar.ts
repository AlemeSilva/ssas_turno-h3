// Remove todos os dados semeados pelo seed.ts, incluindo as contas de
// Auth — para a suite poder correr repetidamente sem colisão de email.
// Corre-se com: npx tsx tests/camada3-e2e/seed/limpar.ts

import { createClient } from '@supabase/supabase-js'
import { UTILIZADORES_TESTE } from './dados'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  for (const u of UTILIZADORES_TESTE) {
    const { data } = await admin.from('usuarios').select('id').eq('email', u.email).maybeSingle()
    if (data) {
      // usuarios.id -> auth.users(id) é ON DELETE RESTRICT (de propósito,
      // para nunca se perder o dono de um registo de auditoria) — por
      // isso é preciso apagar a linha de `usuarios` primeiro (via
      // service role, só para limpeza de teste; a app nunca faz isto),
      // e só depois o utilizador de Auth.
      await admin.from('usuarios').delete().eq('id', data.id)
      await admin.auth.admin.deleteUser(data.id)
    }
  }
  console.log('Limpeza de dados E2E concluída.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
