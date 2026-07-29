import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import type { ChecklistItem, Usuario } from '../../types/database'

export function ItemChecklistLinha({
  item,
  usuarios,
  recarregar,
}: {
  item: ChecklistItem
  usuarios: Usuario[]
  recarregar: () => void
}) {
  const nomeDe = (id: string | null) => (id ? usuarios.find((u) => u.id === id)?.nome ?? id : '')
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const [aConfirmar, setAConfirmar] = useState(false)
  const [aMostrarDestravar, setAMostrarDestravar] = useState(false)
  const [motivo, setMotivo] = useState('')

  async function confirmarConclusao() {
    if (!usuario) return
    await supabase
      .from('checklist_itens')
      .update({ concluido: true, concluido_por: usuario.id, data_hora_conclusao: new Date().toISOString() })
      .eq('id', item.id)
    setAConfirmar(false)
    recarregar()
  }

  async function destravar() {
    if (!motivo.trim()) return
    await supabase.rpc('destravar_checklist_item', { p_id: item.id, p_motivo: motivo })
    setAMostrarDestravar(false)
    setMotivo('')
    recarregar()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.83rem' }}>{item.item_descricao}</span>

        {item.concluido ? (
          <span className="badge badge-lock">
            <LockIcon /> {item.concluido_por ? 'Concluído' : ''}
          </span>
        ) : aConfirmar ? (
          <span style={{ display: 'flex', gap: '0.3rem' }}>
            <button className="btn btn-primary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }} onClick={confirmarConclusao}>
              Confirmar
            </button>
            <button className="btn btn-ghost" style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }} onClick={() => setAConfirmar(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }} onClick={() => setAConfirmar(true)}>
            Marcar concluído
          </button>
        )}
      </div>

      {item.concluido && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Carimbado por {nomeDe(item.concluido_por)} em {item.data_hora_conclusao && new Date(item.data_hora_conclusao).toLocaleString('pt-PT')}
          {ehGerenteOuDelegado && !aMostrarDestravar && (
            <button className="btn btn-ghost" style={{ marginLeft: '0.6rem', padding: '0.1rem 0.4rem', fontSize: '0.68rem' }} onClick={() => setAMostrarDestravar(true)}>
              Destravar
            </button>
          )}
        </div>
      )}

      {aMostrarDestravar && (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            placeholder="Justificativa do destravar (obrigatória)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            style={{ flex: 1, fontSize: '0.72rem' }}
          />
          <button className="btn btn-danger" style={{ fontSize: '0.72rem' }} disabled={!motivo.trim()} onClick={destravar}>
            Confirmar destravar
          </button>
        </div>
      )}
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 32 32" style={{ marginRight: 2 }}>
      <path d="M11 15v-3a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="9" y="15" width="14" height="11" rx="2.5" fill="currentColor" />
    </svg>
  )
}
