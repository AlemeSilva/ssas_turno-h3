import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calcularProximoAlerta } from '@/lib/alertas'
import { semanaRefDe, paraISO, agora as getNow } from '@/lib/datas'
import { cn } from '@/lib/utils'

export function AlertBar() {
  const [agora, setAgora] = useState(getNow())
  const [ehManutencao, setEhManutencao] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setAgora(getNow()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const dataInicioCiclo = paraISO(semanaRefDe(new Date()))
    supabase
      .from('planos')
      .select('tipo_fim_semana')
      .eq('data_inicio_ciclo', dataInicioCiclo)
      .maybeSingle()
      .then(({ data }) => setEhManutencao((data as { tipo_fim_semana?: string } | null)?.tipo_fim_semana === 'MANUTENCAO'))
  }, [])

  const proximo = calcularProximoAlerta(agora, ehManutencao)

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
      </div>
    </div>
  )
}
