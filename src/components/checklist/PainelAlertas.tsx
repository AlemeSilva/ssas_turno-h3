import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthContext'
import type { CadeiaDiaria, TarefaPlano } from '../../types/database'
import { avaliarAlertaReativo, avaliarRiscoGirFl, estaHrLimiteEstourado, isoWeekdayDe } from '../../lib/alertas'

interface Props {
  tarefas: TarefaPlano[]
  cadeias: CadeiaDiaria[]
  dependenciasGirFl: string[]
  ehManutencao: boolean
}

function agoraHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function PainelAlertas({ tarefas, cadeias, dependenciasGirFl: nomesDependenciasGirFl, ehManutencao }: Props) {
  const { usuario } = useAuth()
  const [registados, setRegistados] = useState<Set<string>>(new Set())

  const agora = agoraHHMM()
  const diaSemanaIso = isoWeekdayDe(new Date())

  const tarefasComHrLimiteEstourado = tarefas.filter((t) => estaHrLimiteEstourado(t.hr_limite, t.status, agora))

  const statusDependenciasGirFl = cadeias
    .filter((c) => c.secao === 'BATCH_SAB_DOM' && nomesDependenciasGirFl.includes(c.nome_cadeia))
    .map((c) => c.status)
  const riscoGirFl = avaliarRiscoGirFl(diaSemanaIso, agora, statusDependenciasGirFl)
  const girFlEmRisco = riscoGirFl.aplicavel && riscoGirFl.estado !== 'FUTURO'

  const checagem20hAtiva =
    (diaSemanaIso === 6 || diaSemanaIso === 7) && avaliarAlertaReativo('20:00', agora, 30) !== 'FUTURO'

  const checagem15hAtiva =
    diaSemanaIso === 6 && ehManutencao && avaliarAlertaReativo('15:00', agora, 30) !== 'FUTURO'

  async function registarAcionamento(tipo: string, chave: string, referenciaTipo: string, referenciaId: number | null, descricao: string) {
    if (!usuario) return
    await supabase.from('logs_auditoria').insert({
      referencia_tipo: referenciaTipo,
      referencia_id: referenciaId,
      id_usuario: usuario.id,
      acao: tipo,
      descricao_detalhada: descricao,
    })
    setRegistados((prev) => new Set(prev).add(chave))
  }

  if (tarefasComHrLimiteEstourado.length === 0 && !girFlEmRisco && !checagem20hAtiva && !checagem15hAtiva) {
    return null
  }

  return (
    <div className="card" style={{ borderColor: 'var(--status-vermelho)' }}>
      <h3 style={{ marginTop: 0, color: 'var(--status-vermelho)' }}>Alertas ativos</h3>

      {tarefasComHrLimiteEstourado.map((t) => {
        const chave = `hrlimite-${t.id}`
        return (
          <div key={chave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem' }}>
              <span className="badge badge-vermelho">HR. LIMITE</span> {t.descricao_tarefa} — limite {t.hr_limite}
            </span>
            <button
              className="btn btn-danger"
              disabled={registados.has(chave)}
              onClick={() => registarAcionamento('ESCALONAMENTO_HR_LIMITE', chave, 'TAREFA_PLANO', t.id, `HR.LIMITE estourado: ${t.descricao_tarefa}`)}
            >
              {registados.has(chave) ? 'Acionamento registado' : 'Registar acionamento ao Gerente'}
            </button>
          </div>
        )
      })}

      {girFlEmRisco && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem' }}>
            <span className="badge badge-vermelho">GIR_FL</span> Risco de colisão às 22h — blocos remanescentes de Sábado ainda não concluídos.
          </span>
          <button
            className="btn btn-danger"
            disabled={registados.has('girfl')}
            onClick={() => registarAcionamento('ESCALONAMENTO_GIR_FL', 'girfl', 'CADEIA', null, 'Risco de colisão GIR_FL às 22h')}
          >
            {registados.has('girfl') ? 'Acionamento registado' : 'Registar acionamento ao Gerente'}
          </button>
        </div>
      )}

      {checagem20hAtiva && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem' }}>
            <span className="badge badge-amarelo">Checagem</span> Janela crítica das 20h (Sáb/Dom) em curso.
          </span>
          <button
            className="btn btn-ghost"
            disabled={registados.has('checagem20h')}
            onClick={() => registarAcionamento('ESCALONAMENTO_CHECAGEM_20H', 'checagem20h', 'PLANO', null, 'Checagem das 20h acionada')}
          >
            {registados.has('checagem20h') ? 'Acionamento registado' : 'Registar acionamento ao Gerente'}
          </button>
        </div>
      )}

      {checagem15hAtiva && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem' }}>
            <span className="badge badge-amarelo">Checagem</span> Janela crítica das 15h (Sábado de manutenção) em curso.
          </span>
          <button
            className="btn btn-ghost"
            disabled={registados.has('checagem15h')}
            onClick={() => registarAcionamento('ESCALONAMENTO_CHECAGEM_15H', 'checagem15h', 'PLANO', null, 'Checagem das 15h de manutenção acionada')}
          >
            {registados.has('checagem15h') ? 'Acionamento registado' : 'Registar acionamento ao Gerente'}
          </button>
        </div>
      )}
    </div>
  )
}
