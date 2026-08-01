import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adicionarDias, agora, diasUteis, paraISO, proximaSextaISO } from '../lib/datas'
import type { Ferias } from '../types/database'

export interface FeriadoSemPlantao {
  data: string
  nome: string
  tipo: string
}

export type PeriodoFeriasEquipe = Pick<Ferias, 'id' | 'usuario_id' | 'status' | 'data_inicio' | 'data_fim'>

interface ResumoGerente {
  feriadosSemPlantao: FeriadoSemPlantao[]
  ausenciasHoje: Ferias[]
  ausenciasProximaSemana: Ferias[]
  feriasAprovadasPorPessoa: Map<string, number>
  feriasPendentesPorPessoa: Map<string, number>
  feriasEquipeAno: PeriodoFeriasEquipe[]
  aCarregar: boolean
  confirmarSubstituto: (feriasId: number, substitutoId: string, confirmadoPor: string) => Promise<{ error: string | null }>
  confirmarPlantonista: (dataFeriado: string, usuarioId: string) => Promise<{ error: string | null }>
}

/**
 * Resumo global para a página Início do Gerente: feriados nacionais/
 * municipais sem ninguém confirmado para plantão, e quem da equipa
 * está ou vai estar ausente (hoje / próxima semana administrativa),
 * com a ação de escolher quem cobre a ausência — escolher o
 * substituto é o próprio ato de confirmar (ver migração 0009).
 *
 * `ativo` evita consultas desnecessárias quando quem vê a página
 * Início não é Gerente/delegado.
 */
export function useResumoGerente(ativo: boolean): ResumoGerente {
  const [feriadosSemPlantao, setFeriadosSemPlantao] = useState<FeriadoSemPlantao[]>([])
  const [ausenciasHoje, setAusenciasHoje] = useState<Ferias[]>([])
  const [ausenciasProximaSemana, setAusenciasProximaSemana] = useState<Ferias[]>([])
  const [feriasAprovadasPorPessoa, setFeriasAprovadasPorPessoa] = useState<Map<string, number>>(new Map())
  const [feriasPendentesPorPessoa, setFeriasPendentesPorPessoa] = useState<Map<string, number>>(new Map())
  const [feriasEquipeAno, setFeriasEquipeAno] = useState<PeriodoFeriasEquipe[]>([])
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
      const inicioAno = `${hoje.getFullYear()}-01-01`
      const fimAno = `${hoje.getFullYear()}-12-31`

      const [{ data: dadosFeriados }, { data: dadosAusencias }, { data: dadosFeriasEquipe }] = await Promise.all([
        supabase.from('feriados_sem_plantao').select('data, nome, tipo').order('data'),
        supabase
          .from('ferias')
          .select('*')
          .eq('status', 'APROVADA')
          .lte('data_inicio', proximaQuinta)
          .gte('data_fim', hojeISO),
        supabase
          .from('ferias')
          .select('id, usuario_id, status, data_inicio, data_fim')
          .eq('tipo', 'FERIAS')
          .in('status', ['APROVADA', 'PENDENTE'])
          .gte('data_inicio', inicioAno)
          .lte('data_inicio', fimAno),
      ])

      if (cancelado || idCarregamentoRef.current !== meuId) return

      setFeriadosSemPlantao((dadosFeriados as FeriadoSemPlantao[]) ?? [])

      const ausencias = (dadosAusencias as Ferias[]) ?? []
      setAusenciasHoje(ausencias.filter((f) => f.data_inicio <= hojeISO && f.data_fim >= hojeISO))
      setAusenciasProximaSemana(
        ausencias.filter((f) => f.data_inicio <= proximaQuinta && f.data_fim >= proximaSexta)
      )

      // Total de dias úteis de férias por pessoa este ano, aprovadas e
      // por aprovar em separado — para o cockpit do Gerente na Início.
      // Mesma contagem (dias_uteis, ano corrente) que useResumoUsuario
      // usa para o resumo pessoal, só que agregada por toda a equipa.
      // feriasEquipeAno fica com os períodos individuais (não só o
      // total), para o popup de detalhe por pessoa.
      const feriasEquipe = (dadosFeriasEquipe as PeriodoFeriasEquipe[]) ?? []
      const aprovadas = new Map<string, number>()
      const pendentes = new Map<string, number>()
      for (const f of feriasEquipe) {
        const mapa = f.status === 'APROVADA' ? aprovadas : pendentes
        mapa.set(f.usuario_id, (mapa.get(f.usuario_id) ?? 0) + diasUteis(f.data_inicio, f.data_fim))
      }
      setFeriasAprovadasPorPessoa(aprovadas)
      setFeriasPendentesPorPessoa(pendentes)
      setFeriasEquipeAno(feriasEquipe)

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

  async function confirmarSubstituto(feriasId: number, substitutoId: string, confirmadoPor: string) {
    const { error } = await supabase
      .from('ferias')
      .update({
        substituto_id: substitutoId,
        substituicao_confirmada: true,
        confirmado_por: confirmadoPor,
        confirmado_em: new Date().toISOString(),
      })
      .eq('id', feriasId)
    return { error: error?.message ?? null }
  }

  // feriados_sem_plantao só considera o feriado resolvido quando existe
  // uma linha com voluntario = true (ver definição da view) — a escolha
  // do Gerente entra nesse mesmo balde, independentemente de a pessoa
  // se ter oferecido ou ter sido designada.
  async function confirmarPlantonista(dataFeriado: string, usuarioId: string) {
    const { error } = await supabase.from('plantao_voluntarios').insert({
      data_feriado: dataFeriado,
      usuario_id: usuarioId,
      voluntario: true,
      confirmado_em: new Date().toISOString(),
    })
    if (error?.code === '23505') {
      return { error: 'Este feriado já foi confirmado por outra pessoa entretanto.' }
    }
    return { error: error?.message ?? null }
  }

  return {
    feriadosSemPlantao,
    ausenciasHoje,
    ausenciasProximaSemana,
    feriasAprovadasPorPessoa,
    feriasPendentesPorPessoa,
    feriasEquipeAno,
    aCarregar,
    confirmarSubstituto,
    confirmarPlantonista,
  }
}
