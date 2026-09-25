import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { avaliarSemanasSemH3, type AlertaSemanasSemH3 } from '../lib/alertas'
import { adicionarDias, agora, paraISO } from '../lib/datas'

const ESTADO_INICIAL: AlertaSemanasSemH3 = { semanas: [], urgente: false }

// A lista de utilizadores não está no realtime, e desativar um H3 a meio
// da semana não mexe em escala_semanal (a linha da semana em curso fica,
// só as futuras são apagadas). Além de reagir às mudanças da escala,
// recarrega de vez em quando para apanhar esse caso.
const INTERVALO_RECARGA_MS = 5 * 60_000

/** ativo: só interroga a base para quem realmente vê o aviso (titular e
 * delegado) — quem não pode mexer na escala não tem o que fazer com ele. */
export function useAlertaSemanasSemH3(ativo: boolean): AlertaSemanasSemH3 {
  const [estado, setEstado] = useState<AlertaSemanasSemH3>(ESTADO_INICIAL)

  useEffect(() => {
    if (!ativo) {
      setEstado(ESTADO_INICIAL)
      return
    }
    let cancelado = false
    let ultimoPedido = 0

    async function carregar() {
      const meuPedido = ++ultimoPedido
      const hoje = agora()
      const [{ data: dadosEscala, error: erroEscala }, { data: dadosH3, error: erroH3 }] = await Promise.all([
        // Lê com folga (a semana em curso começa, no máximo, 6 dias antes de hoje); quem decide o que conta é avaliarSemanasSemH3.
        supabase.from('escala_semanal').select('semana_ref, usuario_id, turno').gte('semana_ref', paraISO(adicionarDias(hoje, -6))),
        supabase.from('usuarios').select('id').eq('perfil', 'OPERADOR_H3').eq('ativo', true),
      ])
      // Uma falha de rede não pode apagar um aviso que estava certo —
      // mantém o estado anterior. Respostas antigas que chegam fora de
      // ordem também são descartadas.
      if (cancelado || meuPedido !== ultimoPedido || erroEscala || erroH3) return
      const idsH3Ativos = new Set(((dadosH3 as { id: string }[]) ?? []).map((u) => u.id))
      setEstado(
        avaliarSemanasSemH3((dadosEscala as { semana_ref: string; usuario_id: string; turno: string }[]) ?? [], idsH3Ativos, hoje)
      )
    }

    carregar()
    const canal = supabase
      .channel('alerta-semanas-sem-h3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_semanal' }, carregar)
      .subscribe()
    const relogio = setInterval(carregar, INTERVALO_RECARGA_MS)

    return () => {
      cancelado = true
      clearInterval(relogio)
      supabase.removeChannel(canal)
    }
  }, [ativo])

  return estado
}
