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

  // Versão silenciosa: não activa o estado de carregamento, pelo que os
  // componentes filhos (CadeiaLinha, ItemChecklistLinha) não são desmontados
  // durante actualizações incrementais (ex.: marcar atraso, concluir item).
  const recarregar = useCallback(async () => {
    if (!idPlano) return
    const [{ data: itensData }, { data: cadeiasData }] = await Promise.all([
      supabase.from('checklist_itens').select('*').eq('id_plano', idPlano),
      supabase.from('cadeias_diarias').select('*').eq('id_plano', idPlano),
    ])
    if (itensData) setItens(itensData as ChecklistItem[])
    if (cadeiasData) setCadeias(cadeiasData as CadeiaDiaria[])
  }, [idPlano])

  useEffect(() => {
    carregar()
    if (!idPlano) return
    const canal = supabase
      .channel(`checklist-${idPlano}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_itens', filter: `id_plano=eq.${idPlano}` }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadeias_diarias', filter: `id_plano=eq.${idPlano}` }, recarregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [idPlano, carregar, recarregar])

  return { itens, cadeias, aCarregar, recarregar }
}
