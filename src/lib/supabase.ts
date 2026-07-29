import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Falha cedo e de forma clara — sem isto a app não tem como autenticar
  // nem ler dados; preferível a erros silenciosos mais tarde no ecrã.
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY em falta. Copie .env.example para .env.local e preencha.'
  )
}

// Sem generic de Database: ainda não existe projeto Supabase real para
// gerar tipos (`supabase gen types typescript`). As respostas das
// queries são tipadas manualmente com as interfaces em src/types/database.ts
// no ponto de uso.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 5 },
  },
})
