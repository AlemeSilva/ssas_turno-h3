import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { EscalaSemanal, Ferias, FeriadoPortugal, PlantaoVoluntario } from '../types/database'
import { adicionarDias, paraISO, semanaRefDe } from '../lib/datas'

interface EscalaDoMes {
  escalas: EscalaSemanal[]
  ferias: Ferias[]
  feriados: FeriadoPortugal[]
  plantoes: PlantaoVoluntario[]
  aCarregar: boolean
}

/**
 * Carrega a escala semanal e as férias que tocam o mês indicado, com
 * subscrição em tempo real (Supabase Realtime) — satisfaz o requisito
 * de as alterações aparecerem instantaneamente em todas as sessões
 * abertas, sem F5.
 */
export function useEscalaMes(mesRef: Date): EscalaDoMes {
  const [escalas, setEscalas] = useState<EscalaSemanal[]>([])
  const [ferias, setFerias] = useState<Ferias[]>([])
  const [feriados, setFeriados] = useState<FeriadoPortugal[]>([])
  const [plantoes, setPlantoes] = useState<PlantaoVoluntario[]>([])
  const [aCarregar, setACarregar] = useState(true)

  const inicioMes = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1)
  const fimMes = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0)
  // Alarga a janela de semana_ref para cobrir semanas que começam antes
  // do mês mas cujos 7 dias ainda tocam o mês em vista.
  const janelaInicio = paraISO(semanaRefDe(adicionarDias(inicioMes, -7)))
  const janelaFim = paraISO(fimMes)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setACarregar(true)
      const [{ data: dadosEscala }, { data: dadosFerias }, { data: dadosFeriados }, { data: dadosPlantoes }] =
        await Promise.all([
          supabase
            .from('escala_semanal')
            .select('*')
            .gte('semana_ref', janelaInicio)
            .lte('semana_ref', janelaFim),
          supabase
            .from('ferias')
            .select('*')
            .eq('status', 'APROVADA')
            .lte('data_inicio', paraISO(fimMes))
            .gte('data_fim', paraISO(inicioMes)),
          supabase.from('feriados_portugal').select('*').gte('data', janelaInicio).lte('data', janelaFim),
          supabase.from('plantao_voluntarios').select('*').gte('data_feriado', janelaInicio).lte('data_feriado', janelaFim),
        ])
      if (!cancelado) {
        setEscalas((dadosEscala as EscalaSemanal[]) ?? [])
        setFerias((dadosFerias as Ferias[]) ?? [])
        setFeriados((dadosFeriados as FeriadoPortugal[]) ?? [])
        setPlantoes((dadosPlantoes as PlantaoVoluntario[]) ?? [])
        setACarregar(false)
      }
    }

    carregar()

    const canal = supabase
      .channel(`escala-mes-${janelaInicio}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_semanal' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ferias' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plantao_voluntarios' }, carregar)
      .subscribe()

    return () => {
      cancelado = true
      supabase.removeChannel(canal)
    }
  }, [janelaInicio, janelaFim])

  return { escalas, ferias, feriados, plantoes, aCarregar }
}
