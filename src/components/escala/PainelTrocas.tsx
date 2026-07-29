import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import { usuariosH3Ativos } from '../../data/useUsuarios'
import type { TrocaEscala, Usuario } from '../../types/database'
import { formatarDataPT } from '../../lib/datas'

export function PainelTrocas({ usuarios }: { usuarios: Usuario[] }) {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const [trocas, setTrocas] = useState<TrocaEscala[]>([])
  const [semanaRef, setSemanaRef] = useState('')
  const [substitutoId, setSubstitutoId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  const elegiveisH3 = usuariosH3Ativos(usuarios)
  const souOperadorH3 = usuario?.perfil === 'OPERADOR_H3'

  async function carregar() {
    const { data } = await supabase.from('trocas_escala').select('*').eq('status', 'PROPOSTA').order('semana_ref')
    setTrocas((data as TrocaEscala[]) ?? [])
  }

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('trocas-painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trocas_escala' }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  async function propor(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setErro(null)
    setAEnviar(true)
    const { error } = await supabase.from('trocas_escala').insert({
      usuario_proponente: usuario.id,
      usuario_substituto: substitutoId,
      semana_ref: semanaRef,
    })
    setAEnviar(false)
    if (error) {
      setErro(error.message)
    } else {
      setSemanaRef('')
      setSubstitutoId('')
    }
  }

  async function decidir(id: number, status: 'APROVADA' | 'REJEITADA') {
    if (!usuario) return
    await supabase
      .from('trocas_escala')
      .update({ status, aprovado_por: usuario.id, data_aprovacao: new Date().toISOString() })
      .eq('id', id)
  }

  function nomeDe(id: string) {
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Trocas de H3</h3>

      {souOperadorH3 && (
        <form onSubmit={propor} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Semana (Quinta de referência)
            <input type="date" required value={semanaRef} onChange={(e) => setSemanaRef(e.target.value)} style={{ width: '100%', marginTop: '0.2rem' }} />
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Substituto
            <select required value={substitutoId} onChange={(e) => setSubstitutoId(e.target.value)} style={{ width: '100%', marginTop: '0.2rem' }}>
              <option value="">Selecionar…</option>
              {elegiveisH3.filter((u) => u.id !== usuario?.id).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          {erro && <div className="badge badge-vermelho" style={{ display: 'block' }}>{erro}</div>}
          <button className="btn btn-secondary" type="submit" disabled={aEnviar}>
            {aEnviar ? 'A enviar…' : 'Propor troca'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {trocas.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sem trocas propostas.</p>}
        {trocas.map((t) => (
          <div key={t.id} style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span>
              {formatarDataPT(t.semana_ref)}: {nomeDe(t.usuario_proponente)} → {nomeDe(t.usuario_substituto)}
            </span>
            {ehGerenteOuDelegado ? (
              <span style={{ display: 'flex', gap: '0.3rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => decidir(t.id, 'APROVADA')}>
                  Aprovar
                </button>
                <button className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => decidir(t.id, 'REJEITADA')}>
                  Rejeitar
                </button>
              </span>
            ) : (
              <span className="badge badge-amarelo">PROPOSTA</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
