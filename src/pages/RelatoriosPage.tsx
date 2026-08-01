import { useEffect, useMemo, useState } from 'react'
import { useUsuarios } from '@/data/useUsuarios'
import { supabase } from '@/lib/supabase'
import { adicionarDias, paraISO, formatarDataPT, proximaSextaISO } from '@/lib/datas'
import { gerarTextoRelatorioSemanal } from '@/lib/gerarRelatorioSemanal'
import type { EscalaSemanal, Ferias } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

export function RelatoriosPage() {
  const semanaRef = useMemo(() => proximaSextaISO(), [])
  // escala_semanal ancora ao sábado seguinte à sexta administrativa
  // (ver EscalaPage/valorDoDia) — não é o mesmo valor que semanaRef.
  const semanaRefConsulta = useMemo(
    () => paraISO(adicionarDias(new Date(semanaRef + 'T00:00:00'), 1)),
    [semanaRef]
  )
  const fimSemana = useMemo(
    () => paraISO(adicionarDias(new Date(semanaRef + 'T00:00:00'), 6)),
    [semanaRef]
  )

  const { usuarios } = useUsuarios()
  const [escalas, setEscalas] = useState<EscalaSemanal[]>([])
  const [ferias, setFerias] = useState<Ferias[]>([])
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
          .select('*')
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
          setFerias((dadosFerias as Ferias[]) ?? [])
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

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Relatório Semanal de Escala</CardTitle>
        <div className="text-sm text-zinc-500">Semana de {formatarDataPT(semanaRef)}</div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500">
          Texto pronto a copiar/colar para envio manual por email — publicação semanal às quintas-feiras. As
          alterações que ocorrerem ficam sempre a cargo do Gerente.
        </p>
        {aCarregar ? (
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
  )
}
