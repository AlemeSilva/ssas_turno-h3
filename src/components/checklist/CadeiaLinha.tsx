import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import type { CadeiaCatalogo, CadeiaDiaria, StatusCadeia } from '@/types/database'
import { categoriaDaCadeia, INSTRUCAO_ASTERISCO, INSTRUCAO_DUPLO_ASTERISCO } from '@/lib/cadeiasInfo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const PROXIMO_ESTADO: Record<StatusCadeia, StatusCadeia> = {
  PENDENTE: 'EM_ANDAMENTO',
  EM_ANDAMENTO: 'CONCLUIDO_AUTOMATICO',
  CONCLUIDO_AUTOMATICO: 'PENDENTE',
  CONCLUIDO_MANUAL: 'PENDENTE',
  ATRASADO: 'CONCLUIDO_MANUAL',
}

const ESTILO_ESTADO: Record<StatusCadeia, string> = {
  PENDENTE: 'border-zinc-200 bg-zinc-100 text-zinc-500',
  EM_ANDAMENTO: 'border-amber-100 bg-amber-50 text-amber-700',
  CONCLUIDO_AUTOMATICO: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  CONCLUIDO_MANUAL: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  ATRASADO: 'border-red-100 bg-red-50 text-red-700',
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-700">
          {cadeia.nome_cadeia}
          {categoria === 'ASTERISCO' && ' *'}
          {categoria === 'DUPLO_ASTERISCO' && ' **'}
        </span>
        <span className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'inline-flex cursor-pointer items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                  ESTILO_ESTADO[cadeia.status]
                )}
                onClick={avancarEstado}
              >
                {cadeia.status}
              </button>
            </TooltipTrigger>
            <TooltipContent>Clica para avançar para {PROXIMO_ESTADO[cadeia.status].replace(/_/g, ' ')}</TooltipContent>
          </Tooltip>
          {cadeia.status !== 'ATRASADO' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="xs" variant="ghost" onClick={marcarAtraso}>
                  Marcar atraso
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marca esta cadeia como atrasada de imediato, sem passar pelos estados intermédios</TooltipContent>
            </Tooltip>
          )}
        </span>
      </div>

      {aMostrarInstrucao && (
        <div className="rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
          {categoria === 'ASTERISCO' ? INSTRUCAO_ASTERISCO : INSTRUCAO_DUPLO_ASTERISCO}
          <Button size="xs" variant="ghost" className="ml-2" onClick={() => setAMostrarInstrucao(false)}>
            Ok
          </Button>
        </div>
      )}
    </div>
  )
}
