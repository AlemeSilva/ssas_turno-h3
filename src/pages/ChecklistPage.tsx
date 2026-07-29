import { useMemo } from 'react'
import { usePlanoCiclo } from '../data/usePlanoCiclo'
import { useChecklistCiclo } from '../data/useChecklistCiclo'
import { useCadeiasCatalogo } from '../data/useCadeiasCatalogo'
import { useUsuarios } from '../data/useUsuarios'
import { semanaRefDe, paraISO, formatarDataPT } from '../lib/datas'
import { ItemChecklistLinha } from '../components/checklist/ItemChecklistLinha'
import { CadeiaLinha } from '../components/checklist/CadeiaLinha'
import { PainelAlertas } from '../components/checklist/PainelAlertas'
import { SECOES_CHECKLIST } from '../lib/templateTarefas'

export function ChecklistPage() {
  const dataInicioCiclo = useMemo(() => paraISO(semanaRefDe(new Date())), [])
  const { plano, tarefas, aCarregar: aCarregarPlano } = usePlanoCiclo(dataInicioCiclo)
  const { itens, cadeias, aCarregar: aCarregarChecklist, recarregar } = useChecklistCiclo(plano?.id)
  const { catalogo, dependenciasGirFl } = useCadeiasCatalogo()
  const { usuarios } = useUsuarios()

  if (aCarregarPlano || aCarregarChecklist) return <div className="card">A carregar…</div>

  if (!plano) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Checklist Ativo</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Ainda não existe plano criado para o ciclo com início em {formatarDataPT(dataInicioCiclo)}. Cria o plano
          primeiro no separador "Plano de Fim de Semana".
        </p>
      </div>
    )
  }

  const itensPendentes = itens.filter((i) => !i.concluido).length
  const cadeiasPendentes = cadeias.filter((c) => c.status === 'PENDENTE').length
  const mostrarResumoFimDeCiclo = new Date().getDay() === 1 && (itensPendentes > 0 || cadeiasPendentes > 0) // Segunda-feira

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PainelAlertas
        tarefas={tarefas}
        cadeias={cadeias}
        dependenciasGirFl={dependenciasGirFl}
        ehManutencao={plano.tipo_fim_semana === 'MANUTENCAO'}
      />

      {mostrarResumoFimDeCiclo && (
        <div className="card" style={{ borderColor: 'var(--status-amarelo)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--status-amarelo)' }}>Resumo de pendências do ciclo</h3>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            {itensPendentes} item(ns) de checklist e {cadeiasPendentes} cadeia(s) ficaram por marcar neste ciclo.
          </p>
        </div>
      )}

      {SECOES_CHECKLIST.map((secao) => {
        const itensSecao = itens.filter((i) => i.secao === secao.id)
        const cadeiasSecao = cadeias.filter((c) => c.secao === secao.id)
        return (
          <div key={secao.id} className="card">
            <h3 style={{ marginTop: 0 }}>{secao.titulo}</h3>

            {itensSecao.map((item) => (
              <ItemChecklistLinha key={item.id} item={item} usuarios={usuarios} recarregar={recarregar} />
            ))}

            {cadeiasSecao.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1rem', marginBottom: '0.5rem' }}>
                  Acompanhamento das cadeias
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem 1.5rem' }}>
                  {cadeiasSecao
                    .sort((a, b) => a.nome_cadeia.localeCompare(b.nome_cadeia))
                    .map((c) => (
                      <CadeiaLinha key={c.id} cadeia={c} catalogo={catalogo} recarregar={recarregar} />
                    ))}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
