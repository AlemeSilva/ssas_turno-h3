import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useUsuarios } from '../data/useUsuarios'
import type { CadeiaDiaria, EscalaSemanal, LogAuditoria, Plano, StatusPlano } from '../types/database'
import { formatarDataPT } from '../lib/datas'

type Separador = 'ESCALA' | 'PLANO' | 'CADEIAS' | 'AUDITORIA'

const TABS: { id: Separador; label: string }[] = [
  { id: 'ESCALA', label: 'Escala' },
  { id: 'PLANO', label: 'Plano' },
  { id: 'CADEIAS', label: 'Cadeias' },
  { id: 'AUDITORIA', label: 'Auditoria' },
]

export function HistoricoPage() {
  const [separador, setSeparador] = useState<Separador>('ESCALA')
  const { usuarios } = useUsuarios()

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Histórico / Consulta</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={separador === t.id ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setSeparador(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {separador === 'ESCALA' && <FiltroEscala usuarios={usuarios} />}
      {separador === 'PLANO' && <FiltroPlano />}
      {separador === 'CADEIAS' && <FiltroCadeias />}
      {separador === 'AUDITORIA' && <FiltroAuditoria usuarios={usuarios} />}
    </div>
  )
}

function FiltroEscala({ usuarios }: { usuarios: { id: string; nome: string }[] }) {
  const [usuarioId, setUsuarioId] = useState('')
  const [turno, setTurno] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [resultados, setResultados] = useState<EscalaSemanal[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('escala_semanal').select('*').order('semana_ref', { ascending: false })
    if (usuarioId) query = query.eq('usuario_id', usuarioId)
    if (turno) query = query.eq('turno', turno)
    if (de) query = query.gte('semana_ref', de)
    if (ate) query = query.lte('semana_ref', ate)
    const { data } = await query
    setResultados((data as EscalaSemanal[]) ?? [])
  }

  function nomeDe(id: string) {
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  return (
    <div>
      <form onSubmit={pesquisar} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Campo label="Pessoa">
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Todas</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Turno">
          <select value={turno} onChange={(e) => setTurno(e.target.value)}>
            <option value="">Todos</option>
            <option value="H1">H1</option>
            <option value="H2">H2</option>
            <option value="H3">H3</option>
            <option value="H4">H4</option>
          </select>
        </Campo>
        <Campo label="De">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <button className="btn btn-primary" type="submit">
          Pesquisar
        </button>
      </form>

      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th()}>Semana</th>
            <th style={th()}>Pessoa</th>
            <th style={th()}>Turno</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <td style={td()}>{formatarDataPT(r.semana_ref)}</td>
              <td style={td()}>{nomeDe(r.usuario_id)}</td>
              <td style={td()}>
                <span className="badge badge-neutro">{r.turno}</span>
              </td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr>
              <td style={td()} colSpan={3}>
                Sem resultados — ajusta os filtros e pesquisa.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FiltroAuditoria({ usuarios }: { usuarios: { id: string; nome: string }[] }) {
  const [usuarioId, setUsuarioId] = useState('')
  const [acao, setAcao] = useState('')
  const [resultados, setResultados] = useState<LogAuditoria[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('logs_auditoria').select('*').order('data_hora', { ascending: false }).limit(200)
    if (usuarioId) query = query.eq('id_usuario', usuarioId)
    if (acao) query = query.ilike('acao', `%${acao}%`)
    const { data } = await query
    setResultados((data as LogAuditoria[]) ?? [])
  }

  function nomeDe(id: string | null) {
    if (!id) return '—'
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  return (
    <div>
      <form onSubmit={pesquisar} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Campo label="Pessoa">
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Todas</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Tipo de ação (texto)">
          <input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="ex.: ESCALONAMENTO" />
        </Campo>
        <button className="btn btn-primary" type="submit">
          Pesquisar
        </button>
      </form>

      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th()}>Data/hora</th>
            <th style={th()}>Ação</th>
            <th style={th()}>Utilizador</th>
            <th style={th()}>Descrição</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <td style={td()}>{new Date(r.data_hora).toLocaleString('pt-PT')}</td>
              <td style={td()}>{r.acao}</td>
              <td style={td()}>{nomeDe(r.id_usuario)}</td>
              <td style={td()}>{r.descricao_detalhada}</td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr>
              <td style={td()} colSpan={4}>
                Sem resultados — ajusta os filtros e pesquisa.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const STATUS_PLANO_LABELS: Record<StatusPlano, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE_APROVACAO: 'Pendente',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
}

function FiltroPlano() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [status, setStatus] = useState<StatusPlano | ''>('')
  const [resultados, setResultados] = useState<Plano[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('planos').select('*').order('data_inicio_ciclo', { ascending: false })
    if (de) query = query.gte('data_inicio_ciclo', de)
    if (ate) query = query.lte('data_inicio_ciclo', ate)
    if (status) query = query.eq('status', status)
    const { data } = await query
    setResultados((data as Plano[]) ?? [])
  }

  return (
    <div>
      <form onSubmit={pesquisar} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Campo label="Início do ciclo — De">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Campo label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusPlano | '')}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_PLANO_LABELS) as StatusPlano[]).map((s) => (
              <option key={s} value={s}>{STATUS_PLANO_LABELS[s]}</option>
            ))}
          </select>
        </Campo>
        <button className="btn btn-primary" type="submit">Pesquisar</button>
      </form>

      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th()}>Ciclo</th>
            <th style={th()}>Tipo F. Semana</th>
            <th style={th()}>Estado</th>
            <th style={th()}>Criado em</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <td style={td()}>{formatarDataPT(r.data_inicio_ciclo)}</td>
              <td style={td()}>{r.tipo_fim_semana}</td>
              <td style={td()}>
                <span className={`badge ${r.status === 'APROVADO' || r.status === 'CONCLUIDO' ? 'badge-verde' : r.status === 'EM_EXECUCAO' ? 'badge-lock' : 'badge-amarelo'}`}>
                  {STATUS_PLANO_LABELS[r.status]}
                </span>
              </td>
              <td style={td()}>{formatarDataPT(r.data_criacao)}</td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr><td style={td()} colSpan={4}>Sem resultados — ajusta os filtros e pesquisa.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FiltroCadeias() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [nomeCadeia, setNomeCadeia] = useState('')
  const [resultados, setResultados] = useState<CadeiaDiaria[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('cadeias_diarias').select('*').order('data', { ascending: false }).limit(300)
    if (de) query = query.gte('data', de)
    if (ate) query = query.lte('data', ate)
    if (nomeCadeia) query = query.ilike('nome_cadeia', `%${nomeCadeia}%`)
    const { data } = await query
    setResultados((data as CadeiaDiaria[]) ?? [])
  }

  return (
    <div>
      <form onSubmit={pesquisar} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Campo label="Data — De">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Campo label="Nome da cadeia">
          <input value={nomeCadeia} onChange={(e) => setNomeCadeia(e.target.value)} placeholder="ex.: GIR_FL" />
        </Campo>
        <button className="btn btn-primary" type="submit">Pesquisar</button>
      </form>

      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th()}>Data</th>
            <th style={th()}>Cadeia</th>
            <th style={th()}>Secção</th>
            <th style={th()}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <td style={td()}>{formatarDataPT(r.data)}</td>
              <td style={td()}>{r.nome_cadeia}</td>
              <td style={td()} >{r.secao}</td>
              <td style={td()}>
                <span className={`badge ${r.status === 'CONCLUIDO_AUTOMATICO' || r.status === 'CONCLUIDO_MANUAL' ? 'badge-verde' : r.status === 'ATRASADO' ? 'badge-vermelho' : r.status === 'EM_ANDAMENTO' ? 'badge-lock' : 'badge-neutro'}`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
              </td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr><td style={td()} colSpan={4}>Sem resultados — ajusta os filtros e pesquisa.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      {label}
      {children}
    </label>
  )
}

function th(): CSSProperties {
  return { textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }
}

function td(): CSSProperties {
  return { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)' }
}
