import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useUsuarios } from '@/data/useUsuarios'
import { supabase } from '@/lib/supabase'
import { adicionarDias, paraISO, formatarDataPT, quintaEscalaDe } from '@/lib/datas'
import { gerarTextoRelatorioSemanal } from '@/lib/gerarRelatorioSemanal'
import type { AusenciaComSemanas, EscalaSemanal } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export function RelatoriosPage() {
  const { ehGerenteOuDelegado } = useAuth()

  // Ancora à quinta-feira do ciclo em curso (mesma âncora do Plano de
  // Fim de Semana) — só avança para o ciclo seguinte a partir de
  // quinta-feira, quando o Gerente de facto publica o novo relatório.
  // proximaSextaISO() avançava logo no sábado anterior, 4 dias cedo
  // demais.
  const quintaCiclo = useMemo(() => paraISO(quintaEscalaDe(new Date())), [])
  const semanaRef = useMemo(
    () => paraISO(adicionarDias(new Date(quintaCiclo + 'T00:00:00'), 1)),
    [quintaCiclo]
  )
  // escala_semanal ancora ao sábado seguinte à sexta administrativa
  // (ver EscalaPage/valorDoDia) — não é o mesmo valor que semanaRef.
  const semanaRefConsulta = useMemo(
    () => paraISO(adicionarDias(new Date(quintaCiclo + 'T00:00:00'), 2)),
    [quintaCiclo]
  )
  const fimSemana = useMemo(
    () => paraISO(adicionarDias(new Date(quintaCiclo + 'T00:00:00'), 7)),
    [quintaCiclo]
  )

  // Sem a lista de utilizadores carregada o gerador não sabe quem já
  // saiu da equipa — durante esse instante o texto mostraria nomes em
  // bruto e gente que já não devia constar, por isso espera-se por ela.
  const { usuarios, aCarregar: aCarregarUsuarios } = useUsuarios()
  const [escalas, setEscalas] = useState<EscalaSemanal[]>([])
  const [ferias, setFerias] = useState<AusenciaComSemanas[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      setACarregar(true)
      setErroCarregar(null)
      const [
        { data: dadosEscala, error: erroEscala },
        { data: dadosFerias, error: erroFerias },
      ] = await Promise.all([
        supabase.from('escala_semanal').select('*').eq('semana_ref', semanaRefConsulta),
        supabase
          .from('ferias')
          .select('*, ferias_semanas(*)')
          .eq('status', 'APROVADA')
          .lte('data_inicio', fimSemana)
          .gte('data_fim', semanaRef),
      ])
      if (!cancelado) {
        const erro = erroEscala ?? erroFerias
        if (erro) {
          setErroCarregar(erro.message)
        } else {
          setEscalas((dadosEscala as EscalaSemanal[]) ?? [])
          setFerias((dadosFerias as AusenciaComSemanas[]) ?? [])
        }
        setACarregar(false)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [semanaRefConsulta, semanaRef, fimSemana])

  const texto = useMemo(
    () => gerarTextoRelatorioSemanal(semanaRef, escalas, ferias, usuarios),
    [semanaRef, escalas, ferias, usuarios]
  )

  if (!ehGerenteOuDelegado) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">Esta área é reservada ao Gerente.</CardContent>
      </Card>
    )
  }

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
    <header className="page-heading flex items-end justify-between gap-6">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-amber-strong)]">Comunicação de gestão</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-plum)]">Relatório Semanal de Escala</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Texto operacional preparado para revisão e envio.</p>
      </div>
      <div className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">Semana de {formatarDataPT(semanaRef)}</div>
    </header>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pré-visualização do conteúdo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500">
          Texto pronto a copiar/colar para envio manual por email — publicação semanal às quintas-feiras. As
          alterações que ocorrerem ficam sempre a cargo do Gerente.
        </p>
        {aCarregar || aCarregarUsuarios ? (
          <p className="text-sm text-zinc-400">A carregar…</p>
        ) : erroCarregar ? (
          <p className="text-sm text-red-600">
            Não foi possível carregar os dados da escala/férias: {erroCarregar}. Não copies um relatório gerado sem
            estes dados — tenta recarregar a página.
          </p>
        ) : (
          <>
            <Textarea readOnly value={texto} className="h-80 font-mono text-xs" />
            <Button onClick={copiar} className="self-start">
              {copiado ? 'Copiado!' : 'Copiar texto'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  )
}
