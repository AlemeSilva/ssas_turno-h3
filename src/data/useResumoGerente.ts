import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adicionarDias, agora, paraISO, proximaSextaISO } from '../lib/datas'
import type { Ferias } from '../types/database'

export interface FeriadoSemPlantao {
  data: string
  nome: string
  tipo: string
}

interface ResumoGerente {
  feriadosSemPlantao: FeriadoSemPlantao[]
  ausenciasHoje: Ferias[]
  ausenciasProximaSemana: Ferias[]
  aCarregar: boolean
  confirmarSubstituicao: (feriasId: number, confirmadoPor: string) => Promise<{ error: string | null }>
}

/**
 * Resumo global para a página Início do Gerente: feriados nacionais/
 * municipais sem ninguém confirmado para plantão, e quem da equipa
 * está ou vai estar ausente (hoje / próxima semana administrativa),
 * com a ação de confirmar que a substituição foi tratada.
 *
 * `ativo` evita consultas desnecessárias quando quem vê a página
 * Início não é Gerente/delegado.
 */
export function useResumoGerente(ativo: boolean): ResumoGerente {
  const [feriadosSemPlantao, setFeriadosSemPlantao] = useState<FeriadoSemPlantao[]>([])
  const [ausenciasHoje, setAusenciasHoje] = useState<Ferias[]>([])
  const [ausenciasProximaSemana, setAusenciasProximaSemana] = useState<Ferias[]>([])
  const [aCarregar, setACarregar] = useState(true)

  const idCarregamentoRef = useRef(0)

  useEffect(() => {
    if (!ativo) {
      setACarregar(false)
      return
    }
    let cancelado = false

    async function carregar() {
      const meuId = ++idCarregamentoRef.current
      setACarregar(true)

      const hoje = agora()
      const hojeISO = paraISO(hoje)
      const proximaSexta = proximaSextaISO(hoje)
      const proximaQuinta = paraISO(adicionarDias(new Date(proximaSexta + 'T00:00:00'), 6))

      const [{ data: dadosFeriados }, { data: dadosAusencias }] = await Promise.all([
        supabase.from('feriados_sem_plantao').select('data, nome, tipo').order('data'),
        supabase
          .from('ferias')
          .select('*')
          .eq('status', 'APROVADA')
          .lte('data_inicio', proximaQuinta)
          .gte('data_fim', hojeISO),
      ])

      if (cancelado || idCarregamentoRef.current !== meuId) return

      setFeriadosSemPlantao((dadosFeriados as FeriadoSemPlantao[]) ?? [])

      const ausencias = (dadosAusencias as Ferias[]) ?? []
      setAusenciasHoje(ausencias.filter((f) => f.data_inicio <= hojeISO && f.data_fim >= hojeISO))
      setAusenciasProximaSemana(
        ausencias.filter((f) => f.data_inicio <= proximaQuinta && f.data_fim >= proximaSexta)
      )
      setACarregar(false)
    }

    carregar()
    const canal = supabase
      .channel('resumo-gerente')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ferias' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plantao_voluntarios' }, carregar)
      .subscribe()

    return () => {
      cancelado = true
      supabase.removeChannel(canal)
    }
  }, [ativo])

  async function confirmarSubstituicao(feriasId: number, confirmadoPor: string) {
    const { error } = await supabase
      .from('ferias')
      .update({ substituicao_confirmada: true, confirmado_por: confirmadoPor, confirmado_em: new Date().toISOString() })
      .eq('id', feriasId)
    return { error: error?.message ?? null }
  }

  return { feriadosSemPlantao, ausenciasHoje, ausenciasProximaSemana, aCarregar, confirmarSubstituicao }
}
