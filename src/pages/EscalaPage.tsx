import { useMemo, useState, type CSSProperties } from 'react'
import { useUsuarios } from '../data/useUsuarios'
import { useEscalaMes } from '../data/useEscalaMes'
import { formatarMesAnoPT, paraISO } from '../lib/datas'
import type { EscalaSemanal, Ferias, TurnoTipo } from '../types/database'
import { PainelFerias } from '../components/escala/PainelFerias'
import { PainelTrocas } from '../components/escala/PainelTrocas'
import { PainelDelegacao } from '../components/escala/PainelDelegacao'
import { useAuth } from '../auth/AuthContext'

const CLASSE_BADGE: Record<TurnoTipo | 'F', string> = {
  H1: 'badge-neutro',
  H2: 'badge-neutro',
  H3: 'badge-lock',
  H4: 'badge-neutro',
  F: 'badge-amarelo',
}

function valorDoDia(
  diaISO: string,
  usuarioId: string,
  escalas: EscalaSemanal[],
  ferias: Ferias[]
): TurnoTipo | 'F' | null {
  const temFerias = ferias.some(
    (f) => f.usuario_id === usuarioId && f.data_inicio <= diaISO && f.data_fim >= diaISO
  )
  if (temFerias) return 'F'

  const linha = escalas.find((e) => {
    if (e.usuario_id !== usuarioId) return false
    const fimJanela = new Date(e.semana_ref)
    fimJanela.setDate(fimJanela.getDate() + 6)
    return e.semana_ref <= diaISO && diaISO <= paraISO(fimJanela)
  })
  return linha?.turno ?? null
}

export function EscalaPage() {
  const [mesRef] = useState(() => new Date())
  const { usuarios, aCarregar: aCarregarUsuarios } = useUsuarios()
  const { escalas, ferias, aCarregar: aCarregarEscala } = useEscalaMes(mesRef)
  const { ehGerenteOuDelegado } = useAuth()

  const dias = useMemo(() => {
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth()
    const totalDias = new Date(ano, mes + 1, 0).getDate()
    return Array.from({ length: totalDias }, (_, i) => {
      const d = new Date(ano, mes, i + 1)
      return { numero: i + 1, iso: paraISO(d) }
    })
  }, [mesRef])

  const pessoasAtivas = usuarios.filter((u) => u.ativo)
  const aCarregar = aCarregarUsuarios || aCarregarEscala

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Escala do Mês</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatarMesAnoPT(mesRef)}</div>
        </div>

        {aCarregar ? (
          <p style={{ color: 'var(--text-muted)' }}>A carregar…</p>
        ) : (
          <div className="scrollbar-thin" style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.72rem' }}>
              <thead>
                <tr>
                  <th style={celulaCabecalho('sticky')}>Nome</th>
                  {dias.map((d) => (
                    <th key={d.iso} style={celulaCabecalho()}>
                      {d.numero}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pessoasAtivas.map((p) => (
                  <tr key={p.id}>
                    <td style={celulaNome()}>
                      {p.nome}
                      {p.perfil === 'OPERADOR_H3' && (
                        <span className="badge badge-lock" style={{ marginLeft: '0.4rem', fontSize: '0.6rem' }}>
                          H3
                        </span>
                      )}
                    </td>
                    {dias.map((d) => {
                      const valor = valorDoDia(d.iso, p.id, escalas, ferias)
                      return (
                        <td key={d.iso} style={celulaDia()}>
                          {valor && (
                            <span className={`badge ${CLASSE_BADGE[valor]}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                              {valor}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <Legenda cor="badge-lock" texto="H3 (restrito a Caique/Bruno/Kilson)" />
          <Legenda cor="badge-neutro" texto="H1 / H2 / H4" />
          <Legenda cor="badge-amarelo" texto="Férias (F)" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <PainelFerias usuarios={pessoasAtivas} />
        <PainelTrocas usuarios={pessoasAtivas} />
        {ehGerenteOuDelegado && <PainelDelegacao usuarios={pessoasAtivas} />}
      </div>
    </div>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span className={`badge ${cor}`} style={{ width: 10, height: 10, padding: 0, borderRadius: '50%' }} />
      {texto}
    </div>
  )
}

function celulaCabecalho(sticky?: 'sticky'): CSSProperties {
  return {
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    background: 'var(--bg-surface)',
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    minWidth: sticky ? 150 : 26,
    textAlign: sticky ? 'left' : 'center',
  }
}

function celulaNome(): CSSProperties {
  return {
    position: 'sticky',
    left: 0,
    background: 'var(--bg-surface)',
    padding: '0.4rem 0.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  }
}

function celulaDia(): CSSProperties {
  return {
    borderBottom: '1px solid var(--border-subtle)',
    borderLeft: '1px solid var(--border-subtle)',
    textAlign: 'center',
    minWidth: 26,
    height: 30,
  }
}
