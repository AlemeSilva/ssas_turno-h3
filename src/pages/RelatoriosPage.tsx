import { useEffect, useMemo, useState } from 'react'
import { useUsuarios } from '../data/useUsuarios'
import { supabase } from '../lib/supabase'
import { adicionarDias, agora, paraISO, formatarDataPT } from '../lib/datas'
import { gerarTextoRelatorioSemanal } from '../lib/gerarRelatorioSemanal'
import type { EscalaSemanal, Ferias } from '../types/database'

// Sexta-feira administrativa (início do período do relatório) — hoje
// se hoje já for sexta, senão a próxima. Deliberadamente diferente de
// semanaRefDe() (âncora de quinta, usada pelo ciclo do Plano de Fim de
// Semana): o relatório de escala segue a convenção real dos emails
// enviados ao Gerente, sexta a quinta seguinte.
function proximaSextaISO(): string {
  const hoje = agora()
  const diasAteSexta = (5 - hoje.getDay() + 7) % 7
  return paraISO(adicionarDias(hoje, diasAteSexta))
}

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
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Relatório Semanal de Escala</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Semana de {formatarDataPT(semanaRef)}
        </div>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Texto pronto a copiar/colar para envio manual por email — publicação semanal às
        quintas-feiras. As alterações que ocorrerem ficam sempre a cargo do Gerente.
      </p>
      {aCarregar ? (
        <p style={{ color: 'var(--text-muted)' }}>A carregar…</p>
      ) : erroCarregar ? (
        <p style={{ color: 'var(--status-vermelho)', fontSize: '0.85rem' }}>
          Não foi possível carregar os dados da escala/férias: {erroCarregar}. Não copies um
          relatório gerado sem estes dados — tenta recarregar a página.
        </p>
      ) : (
        <>
          <textarea readOnly value={texto} style={{ width: '100%', height: 320, fontFamily: 'var(--font-mono)' }} />
          <button className="btn btn-primary" onClick={copiar} style={{ marginTop: '0.75rem' }}>
            {copiado ? 'Copiado!' : 'Copiar texto'}
          </button>
        </>
      )}
    </div>
  )
}
