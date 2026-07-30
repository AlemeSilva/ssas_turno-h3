import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import type { CadeiaCatalogo, CadeiaDiaria, StatusCadeia } from '../../types/database'
import { categoriaDaCadeia, INSTRUCAO_ASTERISCO, INSTRUCAO_DUPLO_ASTERISCO } from '../../lib/cadeiasInfo'

const PROXIMO_ESTADO: Record<StatusCadeia, StatusCadeia> = {
  PENDENTE: 'EM_ANDAMENTO',
  EM_ANDAMENTO: 'CONCLUIDO_AUTOMATICO',
  CONCLUIDO_AUTOMATICO: 'PENDENTE',
  CONCLUIDO_MANUAL: 'PENDENTE',
  ATRASADO: 'CONCLUIDO_MANUAL',
}

const CLASSE_ESTADO: Record<StatusCadeia, string> = {
  PENDENTE: 'badge-neutro',
  EM_ANDAMENTO: 'badge-amarelo',
  CONCLUIDO_AUTOMATICO: 'badge-verde',
  CONCLUIDO_MANUAL: 'badge-verde',
  ATRASADO: 'badge-vermelho',
}

export function CadeiaLinha({
  cadeia,
  catalogo,
  recarregar,
}: {
  cadeia: CadeiaDiaria
  catalogo: CadeiaCatalogo[]
  recarregar: () => void
}) {
  const { usuario } = useAuth()
  const [aMostrarInstrucao, setAMostrarInstrucao] = useState(false)
  const categoria = categoriaDaCadeia(cadeia.nome_cadeia, catalogo)

  async function avancarEstado() {
    const novoEstado = PROXIMO_ESTADO[cadeia.status]
    await supabase
      .from('cadeias_diarias')
      .update({
        status: novoEstado,
        concluido_por: novoEstado.startsWith('CONCLUIDO') ? usuario?.id : null,
        data_hora_conclusao: novoEstado.startsWith('CONCLUIDO') ? new Date().toISOString() : null,
      })
      .eq('id', cadeia.id)
    recarregar()
  }

  async function marcarAtraso() {
    await supabase.from('cadeias_diarias').update({ status: 'ATRASADO' }).eq('id', cadeia.id)
    if (categoria !== 'NORMAL') setAMostrarInstrucao(true)
    recarregar()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
        <span>
          {cadeia.nome_cadeia}
          {categoria === 'ASTERISCO' && ' *'}
          {categoria === 'DUPLO_ASTERISCO' && ' **'}
        </span>
        <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <span className={`badge ${CLASSE_ESTADO[cadeia.status]}`} style={{ cursor: 'pointer' }} onClick={avancarEstado}>
            {cadeia.status}
          </span>
          {cadeia.status !== 'ATRASADO' && (
            <button className="btn btn-ghost" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }} onClick={marcarAtraso}>
              Marcar atraso
            </button>
          )}
        </span>
      </div>

      {aMostrarInstrucao && (
        <div className="badge badge-amarelo" style={{ display: 'block', fontWeight: 400, textTransform: 'none', fontSize: '0.72rem', padding: '0.4rem 0.6rem' }}>
          {categoria === 'ASTERISCO' ? INSTRUCAO_ASTERISCO : INSTRUCAO_DUPLO_ASTERISCO}
          <button className="btn btn-ghost" style={{ marginLeft: '0.6rem', padding: '0.1rem 0.4rem' }} onClick={() => setAMostrarInstrucao(false)}>
            Ok
          </button>
        </div>
      )}
    </div>
  )
}
