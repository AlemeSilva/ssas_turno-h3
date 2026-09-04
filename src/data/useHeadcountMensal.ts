import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { HeadcountMensal } from '../types/database'

/**
 * Todas as linhas de headcount_mensal, mais recente primeiro. A
 * distinção entre rascunho (fechado=false) e histórico (fechado=true)
 * é feita por quem consome isto, não aqui.
 */
export function useHeadcountMensal() {
  const [meses, setMeses] = useState<HeadcountMensal[]>([])
  const [aCarregar, setACarregar] = useState(true)

  async function carregar() {
    setACarregar(true)
    const { data } = await supabase.from('headcount_mensal').select('*').order('mes_referencia', { ascending: false })
    setMeses((data as HeadcountMensal[]) ?? [])
    setACarregar(false)
  }

  useEffect(() => {
    let cancelado = false

    async function carregarInicial() {
      setACarregar(true)
      const { data } = await supabase.from('headcount_mensal').select('*').order('mes_referencia', { ascending: false })
      if (!cancelado) {
        setMeses((data as HeadcountMensal[]) ?? [])
        setACarregar(false)
      }
    }

    carregarInicial()
    return () => {
      cancelado = true
    }
  }, [])

  return { meses, aCarregar, recarregar: carregar }
}
