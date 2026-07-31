import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adicionarDias, agora, diasUteis, paraISO, proximaSextaISO } from '../lib/datas'
import type { EscalaSemanal, Ferias, TurnoTipo } from '../types/database'

export const LIMITE_FERIAS_ANUAL = 22

interface ResumoUsuario {
  feriasAprovadasDias: number
  feriasPendentesDias: number
  emFeriasHoje: boolean
  turnoAtual: TurnoTipo | null
  turnoProximaSemana: TurnoTipo | null
  aCarregar: boolean
}

/** Encontra a linha escala_semanal cuja janela [semana_ref, semana_ref+6] cobre diaISO. */
function linhaDoDia(diaISO: string, escalas: EscalaSemanal[]): EscalaSemanal | undefined {
  return escalas.find((e) => {
    const fimJanela = paraISO(adicionarDias(new Date(e.semana_ref + 'T00:00:00'), 6))
    return e.semana_ref <= diaISO && diaISO <= fimJanela
  })
}

/** Resumo pessoal para a página Início: férias do ano corrente + turno atual/próxima semana. */
export function useResumoUsuario(usuarioId: string | undefined): ResumoUsuario {
  const [feriasAprovadasDias, setFeriasAprovadasDias] = useState(0)
  const [feriasPendentesDias, setFeriasPendentesDias] = useState(0)
  const [emFeriasHoje, setEmFeriasHoje] = useState(false)
  const [turnoAtual, setTurnoAtual] = useState<TurnoTipo | null>(null)
  const [turnoProximaSemana, setTurnoProximaSemana] = useState<TurnoTipo | null>(null)
  const [aCarregar, setACarregar] = useState(true)

  // idCarregamentoRef descarta respostas de carregar() que resolvam
  // fora de ordem (a subscrição realtime pode disparar várias vezes em
  // rápida sucessão); cancelado protege contra setState depois do
  // efeito ser desmontado ou de usuarioId mudar.
  const idCarregamentoRef = useRef(0)

  useEffect(() => {
    if (!usuarioId) {
      setACarregar(false)
      return
    }
    let cancelado = false

    async function carregar() {
      const meuId = ++idCarregamentoRef.current
      setACarregar(true)
      const hoje = agora()
      const hojeISO = paraISO(hoje)
      const anoAtual = hoje.getFullYear()
      const inicioAno = `${anoAtual}-01-01`
      const fimAno = `${anoAtual}-12-31`

      const proximaSexta = proximaSextaISO(hoje)
      const semanaRefProxima = paraISO(adicionarDias(new Date(proximaSexta + 'T00:00:00'), 1))
      // Janela larga o suficiente para conter, por baixo, a linha cujo
      // [semana_ref, semana_ref+6] cobre hoje (semana_ref nunca é mais
      // do que 6 dias antes de hoje).
      const janelaEscalaInicio = paraISO(adicionarDias(hoje, -6))

      const [{ data: dadosFerias }, { data: dadosEscala }] = await Promise.all([
        supabase
          .from('ferias')
          .select('*')
          .eq('usuario_id', usuarioId)
          .eq('tipo', 'FERIAS')
          .in('status', ['APROVADA', 'PENDENTE'])
          .gte('data_inicio', inicioAno)
          .lte('data_inicio', fimAno),
        supabase
          .from('escala_semanal')
          .select('*')
          .eq('usuario_id', usuarioId)
          .gte('semana_ref', janelaEscalaInicio)
          .lte('semana_ref', semanaRefProxima),
      ])

      if (cancelado || idCarregamentoRef.current !== meuId) return

      const ferias = (dadosFerias as Ferias[]) ?? []
      const escalas = (dadosEscala as EscalaSemanal[]) ?? []

      setFeriasAprovadasDias(
        ferias.filter((f) => f.status === 'APROVADA').reduce((soma, f) => soma + diasUteis(f.data_inicio, f.data_fim), 0)
      )
      setFeriasPendentesDias(
        ferias.filter((f) => f.status === 'PENDENTE').reduce((soma, f) => soma + diasUteis(f.data_inicio, f.data_fim), 0)
      )
      setEmFeriasHoje(
        ferias.some((f) => f.status === 'APROVADA' && f.data_inicio <= hojeISO && f.data_fim >= hojeISO)
      )
      setTurnoAtual(linhaDoDia(hojeISO, escalas)?.turno ?? null)
      setTurnoProximaSemana(escalas.find((e) => e.semana_ref === semanaRefProxima)?.turno ?? null)
      setACarregar(false)
    }

    carregar()
    const canal = supabase
      .channel(`resumo-usuario-${usuarioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ferias', filter: `usuario_id=eq.${usuarioId}` }, carregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escala_semanal', filter: `usuario_id=eq.${usuarioId}` }, carregar)
      .subscribe()

    return () => {
      cancelado = true
      supabase.removeChannel(canal)
    }
  }, [usuarioId])

  return { feriasAprovadasDias, feriasPendentesDias, emFeriasHoje, turnoAtual, turnoProximaSemana, aCarregar }
}
