import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { avaliarAvisoAutomacaoAnual, avaliarSaudeAutomacaoAnual } from '../lib/alertas'

interface SaudeAutomacaoAnual {
  escalaFalhou: boolean
  escalaDetalhe: string | null
  escalaAviso: boolean
  feriadosFalhou: boolean
  feriadosDetalhe: string | null
}

const ESTADO_INICIAL: SaudeAutomacaoAnual = {
  escalaFalhou: false,
  escalaDetalhe: null,
  escalaAviso: false,
  feriadosFalhou: false,
  feriadosDetalhe: null,
}

/**
 * Olha só para a ação mais recente de cada preenchimento automático
 * anual (escala e feriados, ambos correm no cron de 1 de Novembro) —
 * ver avaliarSaudeAutomacaoAnual() para o porquê de não filtrar por
 * ano. RLS de logs_auditoria já permite leitura a qualquer utilizador
 * autenticado (logs_select_all); o filtro de quem vê isto é feito no
 * componente que usa este hook, não aqui.
 */
export function useSaudeAutomacaoAnual(): SaudeAutomacaoAnual {
  const [estado, setEstado] = useState<SaudeAutomacaoAnual>(ESTADO_INICIAL)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      const [{ data: escala }, { data: feriados }] = await Promise.all([
        supabase
          .from('logs_auditoria')
          .select('acao, descricao_detalhada')
          .eq('referencia_tipo', 'ESCALA_ANUAL')
          .order('data_hora', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('logs_auditoria')
          .select('acao, descricao_detalhada')
          .eq('referencia_tipo', 'FERIADOS_ANUAL')
          .order('data_hora', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelado) return
      const linhaEscala = escala as { acao: string; descricao_detalhada: string | null } | null
      const linhaFeriados = feriados as { acao: string; descricao_detalhada: string | null } | null
      setEstado({
        escalaFalhou: avaliarSaudeAutomacaoAnual(linhaEscala?.acao ?? null),
        escalaDetalhe: linhaEscala?.descricao_detalhada ?? null,
        escalaAviso: avaliarAvisoAutomacaoAnual(linhaEscala?.acao ?? null),
        feriadosFalhou: avaliarSaudeAutomacaoAnual(linhaFeriados?.acao ?? null),
        feriadosDetalhe: linhaFeriados?.descricao_detalhada ?? null,
      })
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [])

  return estado
}
