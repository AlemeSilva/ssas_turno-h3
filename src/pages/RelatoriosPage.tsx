import { useMemo, useState } from 'react'
import { useUsuarios } from '../data/useUsuarios'
import { useEscalaMes } from '../data/useEscalaMes'
import { semanaRefDe, paraISO, formatarDataPT } from '../lib/datas'
import { gerarTextoRelatorioSemanal } from '../lib/gerarRelatorioSemanal'

export function RelatoriosPage() {
  const semanaRef = useMemo(() => paraISO(semanaRefDe(new Date())), [])
  const mesRef = useMemo(() => new Date(), [])
  const { usuarios } = useUsuarios()
  const { escalas, ferias } = useEscalaMes(mesRef)
  const [copiado, setCopiado] = useState(false)

  const escalasDaSemana = escalas.filter((e) => e.semana_ref === semanaRef)
  const texto = gerarTextoRelatorioSemanal(semanaRef, escalasDaSemana, ferias, usuarios)

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
      <textarea readOnly value={texto} style={{ width: '100%', height: 320, fontFamily: 'var(--font-mono)' }} />
      <button className="btn btn-primary" onClick={copiar} style={{ marginTop: '0.75rem' }}>
        {copiado ? 'Copiado!' : 'Copiar texto'}
      </button>
    </div>
  )
}
