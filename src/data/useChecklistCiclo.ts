import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CadeiaDiaria, ChecklistItem } from '../types/database'

export function useChecklistCiclo(idPlano: number | undefined) {
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [cadeias, setCadeias] = useState<CadeiaDiaria[]>([])
  const [aCarregar, setACarregar] = useState(true)

  const carregar = useCallback(async () => {
    if (!idPlano) {
      setItens([])
      setCadeias([])
      setACarregar(false)
      return
    }
    setACarregar(true)
    const [{ data: itensData }, { data: cadeiasData }] = await Promise.all([
      supabase.from('checklist_itens').select('*').eq('id_plano', idPlano),
      supabase.from('cadeias_diarias').select('*').eq('id_plano', idPlano),
    ])
    setItens((itensData as ChecklistItem[]) ?? [])
    setCadeias((cadeiasData as CadeiaDiaria[]) ?? [])
    setACarregar(false)
  }, [idPlano])

  useEffect(() => {
    carregar()
    if (!idPlano) return
    const canal = supabase
      .channel(`checklist-${idPlano}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens', filter: `id_plano=eq.${idPlano}` }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadeias_diarias', filter: `id_plano=eq.${idPlano}` }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [idPlano, carregar])

  return { itens, cadeias, aCarregar, recarregar: carregar }
}
