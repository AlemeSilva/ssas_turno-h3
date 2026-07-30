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
  const emails = UTILIZADORES_TESTE.map((u) => u.email)

  // 1. Obter IDs dos utilizadores de teste (pode não existir na 1.ª corrida)
  const { data: users } = await admin.from('usuarios').select('id').in('email', emails)
  const ids = (users ?? []).map((u) => u.id)

  if (ids.length > 0) {
    // 2. Planos criados pelos utilizadores de teste + dados dependentes com CASCADE
    const { data: planos } = await admin.from('planos').select('id').in('criado_por', ids)
    const idPlanos = (planos ?? []).map((p) => p.id)
    if (idPlanos.length > 0) {
      // cadeias_diarias / checklist_itens / tarefas_plano têm ON DELETE CASCADE
      // mas apagamos explicitamente para ser idempotente mesmo sem CASCADE
      await admin.from('cadeias_diarias').delete().in('id_plano', idPlanos)
      await admin.from('checklist_itens').delete().in('id_plano', idPlanos)
      await admin.from('tarefas_plano').delete().in('id_plano', idPlanos)
      await admin.from('planos').delete().in('id', idPlanos)
    }

    // 3. Escala semanal
    await admin.from('escala_semanal').delete().in('usuario_id', ids)

    // 4. Férias (se houver)
    await admin.from('ferias').delete().in('usuario_id', ids)

    // 5. Logs de auditoria com id_usuario dos testes — FK RESTRICT, bloqueia delete do usuario
    await admin.from('logs_auditoria').delete().in('id_usuario', ids)

    // 6. Apagar linha de usuarios (FK → auth.users ON DELETE RESTRICT: apagar filho primeiro)
    await admin.from('usuarios').delete().in('id', ids)

    // 7. Apagar contas de Auth
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id)
    }
  }

  // 8. Cadeia de catálogo criada pelo teste de gestão (pode existir independentemente)
  await admin.from('cadeias_catalogo').delete().eq('nome_cadeia', 'SD_TESTE_E2E')

  console.log(`Limpeza E2E concluída: ${ids.length} utilizadores removidos.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
