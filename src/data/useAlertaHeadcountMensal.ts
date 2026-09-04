import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { avaliarAlertaHeadcountMensal, type AlertaHeadcountMensal } from '../lib/alertas'
import { agora } from '../lib/datas'

const ESTADO_INICIAL: AlertaHeadcountMensal = { avisoAmbar: false, avisoVermelho: false, mesesPendentes: [] }

/** ativo: só interroga headcount_mensal para quem realmente vê o
 * badge (titular+delegado) — para os outros a RLS devolveria vazio
 * na mesma, mas evita o pedido desnecessário. */
export function useAlertaHeadcountMensal(ativo: boolean): AlertaHeadcountMensal {
  const [estado, setEstado] = useState<AlertaHeadcountMensal>(ESTADO_INICIAL)

  useEffect(() => {
    if (!ativo) {
      setEstado(ESTADO_INICIAL)
      return
    }
    let cancelado = false

    async function carregar() {
      const { data } = await supabase.from('headcount_mensal').select('mes_referencia').eq('fechado', false)
      if (cancelado) return
      const mesesAbertos = ((data as { mes_referencia: string }[]) ?? []).map((m) => m.mes_referencia)
      setEstado(avaliarAlertaHeadcountMensal(mesesAbertos, agora()))
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [ativo])

  return estado
}
