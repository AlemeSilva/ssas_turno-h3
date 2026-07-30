import { useMemo, useState, type FormEvent } from 'react'
import { usePlanoCiclo } from '../data/usePlanoCiclo'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { semanaRefDe, paraISO, formatarDataPT } from '../lib/datas'
import { gerarTextoPlano } from '../lib/exportarPlano'
import type { StatusTarefa } from '../types/database'

const CLASSE_STATUS_TAREFA: Record<StatusTarefa, string> = {
  PENDENTE: 'badge-neutro',
  EM_ANDAMENTO: 'badge-amarelo',
  CONCLUIDO: 'badge-verde',
  ATRASADO: 'badge-vermelho',
}

const ROTULO_STATUS_PLANO: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE_APROVACAO: 'Pendente de aprovação',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
}

export function PlanoPage() {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const dataInicioCiclo = useMemo(() => paraISO(semanaRefDe(new Date())), [])
  const { plano, tarefas, aCarregar, recarregar, criarPlano } = usePlanoCiclo(dataInicioCiclo)

  const [textoExportado, setTextoExportado] = useState<string | null>(null)
  const [novaTarefa, setNovaTarefa] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleCriarPlano() {
    if (!usuario) return
    const { error } = await criarPlano(usuario.id)
    if (error) setErro(error.message)
  }

  async function submeterParaAprovacao() {
    if (!plano) return
    await supabase.from('planos').update({ status: 'PENDENTE_APROVACAO' }).eq('id', plano.id)
    recarregar()
  }

  async function aprovar() {
    if (!plano || !usuario) return
    await supabase
      .from('planos')
      .update({ status: 'APROVADO', aprovado_por: usuario.id, data_aprovacao: new Date().toISOString() })
      .eq('id', plano.id)
    recarregar()
  }

  async function adicionarTarefaExcecional(e: FormEvent) {
    e.preventDefault()
    if (!plano || !novaTarefa.trim()) return
    await supabase.from('tarefas_plano').insert({
      id_plano: plano.id,
      data_execucao: paraISO(new Date()),
      descricao_tarefa: novaTarefa.trim(),
      equipa_responsavel: 'DEOS - Operações',
      origem: 'EXCECIONAL',
    })
    setNovaTarefa('')
    recarregar()
  }

  function exportar(versao: 'DRAFT' | 'DEFINITIVO') {
    if (!plano) return
    setTextoExportado(gerarTextoPlano(plano, tarefas, versao))
  }

  if (aCarregar) return <div className="card">A carregar…</div>

  if (!plano) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Plano de Fim de Semana</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Ainda não existe plano para o ciclo com início em {formatarDataPT(dataInicioCiclo)}.
        </p>
        {erro && <div className="badge badge-vermelho" style={{ display: 'block', marginBottom: '0.75rem' }}>{erro}</div>}
        <button className="btn btn-primary" onClick={handleCriarPlano}>
          Criar plano (pré-popula tarefas fixas)
        </button>
      </div>
    )
  }

  const porDia = new Map<string, typeof tarefas>()
  for (const t of tarefas) {
    const lista = porDia.get(t.data_execucao) ?? []
    lista.push(t)
    porDia.set(t.data_execucao, lista)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>
            Plano de {formatarDataPT(dataInicioCiclo)}{' '}
            {plano.tipo_fim_semana === 'MANUTENCAO' && <span className="badge badge-amarelo">MANUTENÇÃO</span>}
          </h2>
          <div style={{ marginTop: '0.4rem' }}>
            <span className="badge badge-neutro">{ROTULO_STATUS_PLANO[plano.status]}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={() => exportar('DRAFT')}>
            Exportar Draft
          </button>
          <button className="btn btn-ghost" onClick={() => exportar('DEFINITIVO')} disabled={plano.status === 'RASCUNHO'}>
            Exportar Definitivo
          </button>
          {plano.status === 'RASCUNHO' && (
            <button className="btn btn-secondary" onClick={submeterParaAprovacao}>
              Submeter para aprovação
            </button>
          )}
          {plano.status === 'PENDENTE_APROVACAO' && ehGerenteOuDelegado && (
            <button className="btn btn-primary" onClick={aprovar}>
              Aprovar
            </button>
          )}
        </div>
      </div>

      {textoExportado && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ marginTop: 0 }}>Texto pronto a copiar</h3>
            <button className="btn btn-ghost" onClick={() => setTextoExportado(null)}>
              Fechar
            </button>
          </div>
          <textarea readOnly value={textoExportado} style={{ width: '100%', height: 260, fontFamily: 'var(--font-mono)' }} />
        </div>
      )}

      {[...porDia.entries()].sort().map(([dia, lista]) => (
        <div key={dia} className="card">
          <h3 style={{ marginTop: 0 }}>{formatarDataPT(dia)}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {lista.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <div>
                  <strong>{t.hora_arranque ?? '—'}</strong> · {t.descricao_tarefa}
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {t.equipa_responsavel}
                    {t.hr_limite ? ` · HR. LIMITE: ${t.hr_limite}` : ''}
                  </div>
                </div>
                <span className={`badge ${CLASSE_STATUS_TAREFA[t.status]}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <form onSubmit={adicionarTarefaExcecional} className="card" style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          placeholder="Descrição da tarefa excecional"
          value={novaTarefa}
          onChange={(e) => setNovaTarefa(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary" type="submit">
          Adicionar tarefa excecional
        </button>
      </form>
    </div>
  )
}
