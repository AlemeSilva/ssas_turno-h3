// Semeia utilizadores + escala + plano + checklist + cadeias para um
// ciclo H3 fixo e conhecido (CICLO_TESTE), antes de correr a suite
// Playwright. Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no
// ambiente — a service role bypassa RLS deliberadamente, só para
// preparar o cenário de teste (nunca é usada pela app em produção).
//
// Corre-se com: npx tsx tests/camada3-e2e/seed/seed.ts

import { createClient } from '@supabase/supabase-js'
import { CICLO_TESTE, SABADO_CICLO, PASSWORD_TESTE, UTILIZADORES_TESTE } from './dados'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para semear dados de teste.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const ids: Record<string, string> = {}

  for (const u of UTILIZADORES_TESTE) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD_TESTE,
      email_confirm: true,
    })
    if (error) throw new Error(`Falha ao criar ${u.email}: ${error.message}`)
    ids[u.chave] = data.user.id

    const { error: erroPerfil } = await admin.from('usuarios').insert({
      id: data.user.id,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      limite_h3_mensal: u.limite_h3_mensal,
    })
    if (erroPerfil) throw new Error(`Falha ao criar perfil de ${u.email}: ${erroPerfil.message}`)
  }

  await admin.from('escala_semanal').insert([
    { semana_ref: CICLO_TESTE, usuario_id: ids.kilson, turno: 'H3' },
    { semana_ref: CICLO_TESTE, usuario_id: ids.bruno, turno: 'H1' },
    { semana_ref: CICLO_TESTE, usuario_id: ids.leonardo, turno: 'H2' },
    { semana_ref: CICLO_TESTE, usuario_id: ids.sergio, turno: 'H4' },
  ])

  const { data: plano, error: erroPlano } = await admin
    .from('planos')
    .insert({ data_inicio_ciclo: CICLO_TESTE, criado_por: ids.kilson, status: 'EM_EXECUCAO' })
    .select()
    .single()
  if (erroPlano) throw new Error(`Falha ao criar plano: ${erroPlano.message}`)

  // Uma tarefa com HR.LIMITE já ultrapassado, para os testes de
  // alerta condicional/escalonamento não dependerem da hora real.
  await admin.from('tarefas_plano').insert({
    id_plano: plano.id,
    data_execucao: CICLO_TESTE,
    descricao_tarefa: 'Tarefa de teste E2E com HR.LIMITE estourado',
    equipa_responsavel: 'DEOS - Operações',
    hora_arranque: '00:00',
    hr_limite: '00:01',
    origem: 'EXCECIONAL',
  })

  await admin.from('checklist_itens').insert([
    { id_plano: plano.id, secao: 'PREPARACAO', item_descricao: 'Item de teste E2E — Preparação' },
    { id_plano: plano.id, secao: 'BATCH_SAB_DOM', item_descricao: 'Item de teste E2E — Batch Sáb-Dom' },
  ])

  // Estado PENDENTE de propósito (não ATRASADO): os testes de alerta
  // condicional (CAMADA 3) clicam em "Marcar atraso" eles próprios,
  // para verificar que é essa ação que dispara o popup de instrução —
  // não bastaria semear já como ATRASADO, porque o popup é estado
  // efémero da UI, não algo persistido.
  await admin.from('cadeias_diarias').insert([
    { id_plano: plano.id, secao: 'BATCH_SAB_DOM', data: SABADO_CICLO, nome_cadeia: 'SD', status: 'PENDENTE' },
    { id_plano: plano.id, secao: 'BATCH_SAB_DOM', data: SABADO_CICLO, nome_cadeia: 'SD_FL', status: 'PENDENTE' },
    { id_plano: plano.id, secao: 'BATCH_SAB_DOM', data: SABADO_CICLO, nome_cadeia: 'EP_DDS', status: 'PENDENTE' },
    { id_plano: plano.id, secao: 'BATCH_SAB_DOM', data: SABADO_CICLO, nome_cadeia: 'GIR_FL', status: 'PENDENTE' },
  ])

  console.log('Seed E2E concluído. IDs:', ids, 'plano:', plano.id)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
