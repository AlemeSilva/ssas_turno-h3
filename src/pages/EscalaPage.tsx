import { useMemo, useState, type CSSProperties } from 'react'
import { useUsuarios } from '../data/useUsuarios'
import { useEscalaMes } from '../data/useEscalaMes'
import { formatarMesAnoPT, paraISO } from '../lib/datas'
import type { EscalaSemanal, Ferias, TurnoTipo, Usuario } from '../types/database'
import { PainelFerias } from '../components/escala/PainelFerias'
import { PainelTrocas } from '../components/escala/PainelTrocas'
import { PainelDelegacao } from '../components/escala/PainelDelegacao'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'

interface RespostaSugestao {
  semana_ref: string
  H3: { usuario_id: string; nome: string; precisa_override: boolean } | null
  H1: string | null
  H2: string | null
  H4: string | null
}

function proximaQuinta(): string {
  const hoje = new Date()
  const diff = (4 - hoje.getDay() + 7) % 7 || 7
  const quinta = new Date(hoje)
  quinta.setDate(hoje.getDate() + diff)
  return paraISO(quinta)
}

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
  const mesRef = useMemo(() => new Date(), [])
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatarMesAnoPT(mesRef)}</div>
            {ehGerenteOuDelegado && (
              <PainelSugestao usuarios={pessoasAtivas} />
            )}
          </div>
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

function PainelSugestao({ usuarios }: { usuarios: Pick<Usuario, 'id' | 'nome'>[] }) {
  const [aberto, setAberto] = useState(false)
  const [semanaRef, setSemanaRef] = useState(proximaQuinta)
  const [sugestao, setSugestao] = useState<RespostaSugestao | null>(null)
  const [aCarregar, setACarregar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState(false)

  function nomePorId(id: string | null): string {
    if (!id) return '—'
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  async function calcular() {
    setACarregar(true)
    setErro(null)
    setSugestao(null)
    setAplicado(false)
    const { data, error } = await supabase.functions.invoke('sugerir-escala', {
      body: { semana_ref: semanaRef },
    })
    if (error) setErro(error.message)
    else setSugestao(data as RespostaSugestao)
    setACarregar(false)
  }

  async function aplicar() {
    if (!sugestao) return
    const linhas: { usuario_id: string; semana_ref: string; turno: string }[] = []
    if (sugestao.H3) linhas.push({ usuario_id: sugestao.H3.usuario_id, semana_ref: sugestao.semana_ref, turno: 'H3' })
    if (sugestao.H1) linhas.push({ usuario_id: sugestao.H1, semana_ref: sugestao.semana_ref, turno: 'H1' })
    if (sugestao.H2) linhas.push({ usuario_id: sugestao.H2, semana_ref: sugestao.semana_ref, turno: 'H2' })
    if (sugestao.H4) linhas.push({ usuario_id: sugestao.H4, semana_ref: sugestao.semana_ref, turno: 'H4' })
    const { error } = await supabase.from('escala_semanal').upsert(linhas, { onConflict: 'usuario_id,semana_ref' })
    if (!error) setAplicado(true)
  }

  if (!aberto) {
    return (
      <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => setAberto(true)}>
        Sugerir automaticamente
      </button>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '100%', right: 0, zIndex: 10,
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: '0.5rem', padding: '1rem', minWidth: 280, marginTop: '0.25rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '0.8rem' }}>Sugestão automática</strong>
          <button className="btn btn-ghost" style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }} onClick={() => { setAberto(false); setSugestao(null) }}>✕</button>
        </div>

        <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
          Semana (Quinta-feira de referência)
          <input type="date" value={semanaRef} onChange={(e) => { setSemanaRef(e.target.value); setSugestao(null) }} />
        </label>

        <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem' }} onClick={calcular} disabled={aCarregar}>
          {aCarregar ? 'A calcular…' : 'Calcular sugestão'}
        </button>

        {erro && <p style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{erro}</p>}

        {sugestao && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {(['H1', 'H2', 'H4'] as const).map((t) => (
                  <tr key={t}>
                    <td style={{ padding: '0.25rem 0', color: 'var(--text-muted)', width: 32 }}>
                      <span className="badge badge-neutro" style={{ fontSize: '0.65rem' }}>{t}</span>
                    </td>
                    <td style={{ padding: '0.25rem 0' }}>{nomePorId(sugestao[t])}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '0.25rem 0', color: 'var(--text-muted)', width: 32 }}>
                    <span className="badge badge-lock" style={{ fontSize: '0.65rem' }}>H3</span>
                  </td>
                  <td style={{ padding: '0.25rem 0' }}>
                    {sugestao.H3 ? (
                      <span>
                        {sugestao.H3.nome}
                        {sugestao.H3.precisa_override && (
                          <span style={{ color: 'var(--color-warning)', marginLeft: '0.4rem', fontSize: '0.7rem' }}>⚠ override</span>
                        )}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>

            {aplicado ? (
              <p style={{ color: 'var(--color-success)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Aplicado à escala.</p>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.8rem' }} onClick={aplicar}>
                Aplicar à escala
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
