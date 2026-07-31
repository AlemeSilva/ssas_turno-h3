import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CadeiaCatalogo, Plano, TarefaPlano } from '../types/database'
import { gerarTarefasTemplate } from '../lib/templateTarefas'
import { gerarChecklistTemplate, DIA_POR_SECAO_BATCH } from '../lib/templateChecklist'
import { adicionarDias, paraISO } from '../lib/datas'

export function usePlanoCiclo(dataInicioCiclo: string) {
  const [plano, setPlano] = useState<Plano | null>(null)
  const [tarefas, setTarefas] = useState<TarefaPlano[]>([])
  const [aCarregar, setACarregar] = useState(true)

  // Ver comentário equivalente em PainelFerias.tsx — descarta respostas
  // de carregar() que resolvam fora de ordem.
  const idCarregamentoRef = useRef(0)

  const carregar = useCallback(async () => {
    const meuId = ++idCarregamentoRef.current
    setACarregar(true)
    const { data: planoData } = await supabase
      .from('planos')
      .select('*')
      .eq('data_inicio_ciclo', dataInicioCiclo)
      .maybeSingle()

    if (idCarregamentoRef.current !== meuId) return

    if (planoData) {
      const { data: tarefasData } = await supabase
        .from('tarefas_plano')
        .select('*')
        .eq('id_plano', (planoData as Plano).id)
        .order('data_execucao')
        .order('hora_arranque')
      if (idCarregamentoRef.current !== meuId) return
      setTarefas((tarefasData as TarefaPlano[]) ?? [])
    } else {
      setTarefas([])
    }
    setPlano((planoData as Plano) ?? null)
    setACarregar(false)
  }, [dataInicioCiclo])

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel(`plano-${dataInicioCiclo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planos', filter: `data_inicio_ciclo=eq.${dataInicioCiclo}` }, carregar)
      // tarefas_plano não referencia data_inicio_ciclo diretamente, só
      // id_plano — sem um plano carregado ainda não há id_plano para
      // filtrar, por isso este handler recarrega tudo (carregar() volta
      // a resolver o id_plano correto); com um plano já carregado, isto
      // continua a recarregar em qualquer alteração a QUALQUER ciclo,
      // não só o deste hook — não corrige dados, só refetches perdidos.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_plano' }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [dataInicioCiclo, carregar])

  async function criarPlano(criadoPor: string) {
    const { data: novoPlano, error } = await supabase
      .from('planos')
      .insert({ data_inicio_ciclo: dataInicioCiclo, criado_por: criadoPor })
      .select()
      .single()

    if (error || !novoPlano) return { error }

    const idPlano = (novoPlano as Plano).id
    const tipo = (novoPlano as Plano).tipo_fim_semana

    const template = gerarTarefasTemplate(dataInicioCiclo, tipo)
    await supabase.from('tarefas_plano').insert(template.map((t) => ({ ...t, id_plano: idPlano })))

    const itensChecklist = gerarChecklistTemplate(tipo)
    await supabase.from('checklist_itens').insert(itensChecklist.map((i) => ({ ...i, id_plano: idPlano })))

    // Catálogo lido da base de dados — nunca uma lista fixa no código,
    // para que adicionar/desativar uma cadeia se reflita de imediato
    // em qualquer plano novo, sem alteração de código.
    const { data: catalogoAtivo } = await supabase
      .from('cadeias_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('ordem')

    const quinta = new Date(dataInicioCiclo + 'T00:00:00')
    const dataPorDia = { SABADO: paraISO(adicionarDias(quinta, 2)), DOMINGO: paraISO(adicionarDias(quinta, 3)), SEGUNDA: paraISO(adicionarDias(quinta, 4)) }
    const linhasCadeias = Object.entries(DIA_POR_SECAO_BATCH).flatMap(([secao, diaChave]) =>
      ((catalogoAtivo as CadeiaCatalogo[]) ?? []).map((c) => ({
        id_plano: idPlano,
        secao,
        data: dataPorDia[diaChave],
        nome_cadeia: c.nome_cadeia,
      }))
    )
    if (linhasCadeias.length > 0) {
      await supabase.from('cadeias_diarias').insert(linhasCadeias)
    }

    await carregar()
    return { error: null }
  }

  return { plano, tarefas, aCarregar, recarregar: carregar, criarPlano }
}
