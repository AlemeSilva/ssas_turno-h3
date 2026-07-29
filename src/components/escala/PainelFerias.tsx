import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import type { Ferias, Usuario } from '../../types/database'
import { formatarDataPT } from '../../lib/datas'

export function PainelFerias({ usuarios }: { usuarios: Usuario[] }) {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const [pedidos, setPedidos] = useState<Ferias[]>([])
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  async function carregar() {
    const { data } = await supabase
      .from('ferias')
      .select('*')
      .in('status', ehGerenteOuDelegado ? ['PENDENTE', 'APROVADA'] : ['PENDENTE'])
      .order('data_inicio')
    setPedidos((data as Ferias[]) ?? [])
  }

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('ferias-painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ferias' }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehGerenteOuDelegado])

  async function pedirFerias(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setErro(null)
    setAEnviar(true)
    const { error } = await supabase
      .from('ferias')
      .insert({ usuario_id: usuario.id, data_inicio: dataInicio, data_fim: dataFim })
    setAEnviar(false)
    if (error) {
      setErro(traduzirErro(error.message))
    } else {
      setDataInicio('')
      setDataFim('')
    }
  }

  async function decidir(id: number, status: 'APROVADA' | 'REJEITADA') {
    if (!usuario) return
    await supabase
      .from('ferias')
      .update({ status, aprovado_por: usuario.id, data_aprovacao: new Date().toISOString() })
      .eq('id', id)
  }

  function nomeDe(id: string) {
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Férias</h3>

      <form onSubmit={pedirFerias} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Data de início
          <input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ width: '100%', marginTop: '0.2rem' }} />
        </label>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Data de fim
          <input type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ width: '100%', marginTop: '0.2rem' }} />
        </label>
        {erro && <div className="badge badge-vermelho" style={{ display: 'block' }}>{erro}</div>}
        <button className="btn btn-secondary" type="submit" disabled={aEnviar}>
          {aEnviar ? 'A enviar…' : 'Pedir férias'}
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {pedidos.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sem pedidos pendentes.</p>}
        {pedidos.map((f) => (
          <div key={f.id} style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span>
              {nomeDe(f.usuario_id)} · {formatarDataPT(f.data_inicio)} a {formatarDataPT(f.data_fim)}
            </span>
            {f.status === 'PENDENTE' && ehGerenteOuDelegado ? (
              <span style={{ display: 'flex', gap: '0.3rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => decidir(f.id, 'APROVADA')}>
                  Aprovar
                </button>
                <button className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => decidir(f.id, 'REJEITADA')}>
                  Rejeitar
                </button>
              </span>
            ) : (
              <span className={`badge ${f.status === 'APROVADA' ? 'badge-verde' : 'badge-amarelo'}`}>{f.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('sobrepostas')) return 'Já existem férias pedidas/aprovadas de outro colega neste período.'
  if (mensagem.includes('saldo anual')) return 'Este pedido ultrapassa o saldo anual de 22 dias úteis de férias.'
  if (mensagem.includes('escala atribuída')) return 'Já existe escala atribuída a esta pessoa num período sobreposto.'
  return mensagem
}
