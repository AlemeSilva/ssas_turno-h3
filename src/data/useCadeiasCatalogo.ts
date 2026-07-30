import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CadeiaCatalogo } from '../types/database'

interface DependenciaGirFl {
  nome_cadeia: string
}

/**
 * Fonte única de verdade do catálogo de cadeias — a app nunca deve ter
 * uma lista fixa duplicada no código. Adicionar/desativar uma cadeia
 * aqui reflete-se automaticamente em qualquer novo plano criado e no
 * cálculo do alerta preditivo do GIR_FL.
 */
export function useCadeiasCatalogo() {
  const [catalogo, setCatalogo] = useState<CadeiaCatalogo[]>([])
  const [dependenciasGirFl, setDependenciasGirFl] = useState<string[]>([])
  const [aCarregar, setACarregar] = useState(true)

  const carregar = useCallback(async () => {
    setACarregar(true)
    const [{ data: catalogoData }, { data: depsData }] = await Promise.all([
      supabase.from('cadeias_catalogo').select('*').order('ordem'),
      supabase.from('gir_fl_dependencias').select('nome_cadeia'),
    ])
    setCatalogo((catalogoData as CadeiaCatalogo[]) ?? [])
    setDependenciasGirFl(((depsData as DependenciaGirFl[]) ?? []).map((d) => d.nome_cadeia))
    setACarregar(false)
  }, [])

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('cadeias-catalogo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadeias_catalogo' }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gir_fl_dependencias' }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregar])

  return { catalogo, dependenciasGirFl, aCarregar, recarregar: carregar }
}
