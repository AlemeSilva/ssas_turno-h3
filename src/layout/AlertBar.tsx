import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularProximoAlerta, estaHrLimiteEstourado } from '@/lib/alertas'
import { semanaRefDe, paraISO, agora as getNow } from '@/lib/datas'
import { cn } from '@/lib/utils'
import type { TarefaPlano } from '@/types/database'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function AlertBar() {
  const [agora, setAgora] = useState(getNow())
  const [ehManutencao, setEhManutencao] = useState(false)
  const [tarefasExcecionais, setTarefasExcecionais] = useState<TarefaPlano[]>([])

  useEffect(() => {
    const t = setInterval(() => setAgora(getNow()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function carregar() {
      const dataInicioCiclo = paraISO(semanaRefDe(new Date()))
      const { data: planoData } = await supabase
        .from('planos')
        .select('id, tipo_fim_semana')
        .eq('data_inicio_ciclo', dataInicioCiclo)
        .maybeSingle()
      const plano = planoData as { id: number; tipo_fim_semana?: string } | null
      setEhManutencao(plano?.tipo_fim_semana === 'MANUTENCAO')
      if (!plano) {
        setTarefasExcecionais([])
        return
      }
      // Só as candidatas a alertar: com hora-limite definida e ainda
      // por concluir — o cálculo de "já ultrapassada" é feito abaixo,
      // reavaliado a cada 30s junto com o resto da barra.
      const { data: tarefasData } = await supabase
        .from('tarefas_plano')
        .select('*')
        .eq('id_plano', plano.id)
        .eq('origem', 'EXCECIONAL')
        .not('hr_limite', 'is', null)
        .neq('status', 'CONCLUIDO')
      setTarefasExcecionais((tarefasData as TarefaPlano[]) ?? [])
    }
    carregar()
  }, [])

  const proximo = calcularProximoAlerta(agora, ehManutencao)
  const agoraHHMM = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
  const tarefasAtrasadas = tarefasExcecionais.filter((t) => estaHrLimiteEstourado((t.hr_limite ?? '').slice(0, 5), t.status, agoraHHMM))
  const rotuloAtraso =
    tarefasAtrasadas.length === 1 ? '1 tarefa excecional atrasada' : `${tarefasAtrasadas.length} tarefas excecionais atrasadas`

  return (
    <div className="flex items-center border-b border-zinc-100 bg-zinc-50 px-5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
            proximo ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
          )}
        >
          {proximo ? 'Próximo alerta' : 'Sem alertas agendados'}
        </span>
        {proximo && (
          <span className="text-sm text-zinc-600">
            {proximo.rotulo} às {proximo.horario} · em {proximo.minutosRestantes} min
          </span>
        )}
        {tarefasAtrasadas.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center rounded-md border border-red-100 bg-red-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-red-700">
                {rotuloAtraso}
              </span>
            </TooltipTrigger>
            <TooltipContent>Tarefa(s) excecional(is) do Plano de Fim de Semana com a hora-limite ultrapassada, ainda por concluir</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
