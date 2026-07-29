// Cliente partilhado pelos scripts de stress — usa a service role só
// para preparar/limpar cenários; os próprios testes de concorrência e
// bypass usam sessões autenticadas normais (anon key + login), para
// serem representativos do que um utilizador ou atacante real veria.

import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = requerEnv('SUPABASE_URL')
export const SUPABASE_ANON_KEY = requerEnv('SUPABASE_ANON_KEY')
export const SUPABASE_SERVICE_ROLE_KEY = requerEnv('SUPABASE_SERVICE_ROLE_KEY')

function requerEnv(nome: string): string {
  const valor = process.env[nome]
  if (!valor) {
    console.error(`Variável de ambiente ${nome} em falta — necessária para os testes da CAMADA 4.`)
    process.exit(1)
  }
  return valor
}

export const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export function clienteAnonimo() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
