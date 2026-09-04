import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { HeadcountParametros } from '../types/database'

/** Singleton — leitura aberta a titular+delegado, escrita só ao
 * titular (RLS), imposta na base de dados, não aqui. */
export function useHeadcountParametros() {
  const [parametros, setParametros] = useState<HeadcountParametros | null>(null)
  const [aCarregar, setACarregar] = useState(true)

  async function carregar() {
    setACarregar(true)
    const { data } = await supabase.from('headcount_parametros').select('*').maybeSingle()
    setParametros((data as HeadcountParametros) ?? null)
    setACarregar(false)
  }

  useEffect(() => {
    let cancelado = false

    async function carregarInicial() {
      setACarregar(true)
      const { data } = await supabase.from('headcount_parametros').select('*').maybeSingle()
      if (!cancelado) {
        setParametros((data as HeadcountParametros) ?? null)
        setACarregar(false)
      }
    }

    carregarInicial()
    return () => {
      cancelado = true
    }
  }, [])

  return { parametros, aCarregar, recarregar: carregar }
}
