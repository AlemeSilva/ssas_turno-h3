import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import type { DelegacaoAprovacao, Usuario } from '../../types/database'
import { formatarDataPT } from '../../lib/datas'

export function PainelDelegacao({ usuarios }: { usuarios: Usuario[] }) {
  const { usuario } = useAuth()
  const [delegacoes, setDelegacoes] = useState<DelegacaoAprovacao[]>([])
  const [substitutoId, setSubstitutoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  const souGerenteTitular = usuario?.perfil === 'GERENTE'

  async function carregar() {
    const { data } = await supabase
      .from('delegacoes_aprovacao')
      .select('*')
      .gte('data_fim', new Date().toISOString().slice(0, 10))
      .order('data_inicio')
    setDelegacoes((data as DelegacaoAprovacao[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setErro(null)
    setAEnviar(true)
    const { error } = await supabase.from('delegacoes_aprovacao').insert({
      gerente_titular: usuario.id,
      substituto: substitutoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
    })
    setAEnviar(false)
    if (error) {
      setErro(error.message.includes('já existe') ? 'Já existe uma delegação ativa nesse período.' : error.message)
    } else {
      setSubstitutoId('')
      setDataInicio('')
      setDataFim('')
      carregar()
    }
  }

  function nomeDe(id: string) {
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  if (!souGerenteTitular) return null

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Delegação de Aprovação</h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0 }}>
        Aditiva — mantém sempre o teu próprio poder de aprovar durante a janela.
      </p>

      <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Substituto
          <select required value={substitutoId} onChange={(e) => setSubstitutoId(e.target.value)} style={{ width: '100%', marginTop: '0.2rem' }}>
            <option value="">Selecionar…</option>
            {usuarios.filter((u) => u.id !== usuario?.id).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          De
          <input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ width: '100%', marginTop: '0.2rem' }} />
        </label>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Até
          <input type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ width: '100%', marginTop: '0.2rem' }} />
        </label>
        {erro && <div className="badge badge-vermelho" style={{ display: 'block' }}>{erro}</div>}
        <button className="btn btn-secondary" type="submit" disabled={aEnviar}>
          {aEnviar ? 'A criar…' : 'Criar delegação'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {delegacoes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sem delegações ativas.</p>}
        {delegacoes.map((d) => (
          <div key={d.id} style={{ fontSize: '0.78rem' }}>
            {nomeDe(d.substituto)} · {formatarDataPT(d.data_inicio)} a {formatarDataPT(d.data_fim)}
          </div>
        ))}
      </div>
    </div>
  )
}
