import { useMemo } from 'react'
import { usePlanoCiclo } from '@/data/usePlanoCiclo'
import { useChecklistCiclo } from '@/data/useChecklistCiclo'
import { useCadeiasCatalogo } from '@/data/useCadeiasCatalogo'
import { useUsuarios } from '@/data/useUsuarios'
import { semanaRefDe, paraISO, formatarDataPT } from '@/lib/datas'
import { ItemChecklistLinha } from '@/components/checklist/ItemChecklistLinha'
import { CadeiaLinha } from '@/components/checklist/CadeiaLinha'
import { PainelAlertas } from '@/components/checklist/PainelAlertas'
import { SECOES_CHECKLIST } from '@/lib/templateTarefas'
import { Card, CardContent, CardTitle } from '@/components/ui/card'

export function ChecklistPage() {
  const dataInicioCiclo = useMemo(() => paraISO(semanaRefDe(new Date())), [])
  const { plano, tarefas, aCarregar: aCarregarPlano } = usePlanoCiclo(dataInicioCiclo)
  const { itens, cadeias, aCarregar: aCarregarChecklist, recarregar } = useChecklistCiclo(plano?.id)
  const { catalogo, dependenciasGirFl } = useCadeiasCatalogo()
  const { usuarios } = useUsuarios()

  if (aCarregarPlano || aCarregarChecklist) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">A carregar…</CardContent>
      </Card>
    )
  }

  if (!plano) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          <CardTitle>Checklist Ativo</CardTitle>
          <p className="text-sm text-zinc-500">
            Ainda não existe plano criado para o ciclo com início em {formatarDataPT(dataInicioCiclo)}. Cria o plano
            primeiro no separador "Plano de Fim de Semana".
          </p>
        </CardContent>
      </Card>
    )
  }

  const itensPendentes = itens.filter((i) => !i.concluido).length
  const cadeiasPendentes = cadeias.filter((c) => c.status === 'PENDENTE').length
  const mostrarResumoFimDeCiclo = new Date().getDay() === 1 && (itensPendentes > 0 || cadeiasPendentes > 0) // Segunda-feira

  return (
    <div className="flex flex-col gap-5">
      <PainelAlertas
        tarefas={tarefas}
        cadeias={cadeias}
        dependenciasGirFl={dependenciasGirFl}
        ehManutencao={plano.tipo_fim_semana === 'MANUTENCAO'}
      />

      {mostrarResumoFimDeCiclo && (
        <Card className="border-amber-200">
          <CardContent className="flex flex-col gap-1 pt-6">
            <CardTitle className="text-amber-600">Resumo de pendências do ciclo</CardTitle>
            <p className="text-sm text-zinc-700">
              {itensPendentes} item(ns) de checklist e {cadeiasPendentes} cadeia(s) ficaram por marcar neste ciclo.
            </p>
          </CardContent>
        </Card>
      )}

      {SECOES_CHECKLIST.map((secao) => {
        const itensSecao = itens.filter((i) => i.secao === secao.id)
        const cadeiasSecao = cadeias.filter((c) => c.secao === secao.id)
        return (
          <Card key={secao.id}>
            <CardContent className="flex flex-col pt-6">
              <CardTitle className="mb-2">{secao.titulo}</CardTitle>

              {itensSecao.map((item) => (
                <ItemChecklistLinha key={item.id} item={item} usuarios={usuarios} recarregar={recarregar} />
              ))}

              {cadeiasSecao.length > 0 && (
                <>
                  <h4 className="mt-4 mb-2 text-xs text-zinc-400">Acompanhamento das cadeias</h4>
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                    {cadeiasSecao
                      .sort((a, b) => a.nome_cadeia.localeCompare(b.nome_cadeia))
                      .map((c) => (
                        <CadeiaLinha key={c.id} cadeia={c} catalogo={catalogo} recarregar={recarregar} />
                      ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
