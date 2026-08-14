import { useState } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { formatarDataPT } from '@/lib/datas'
import type { TarefaPlano, Usuario } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function TarefaExcecionalLinha({
  tarefa,
  usuarios,
  recarregar,
}: {
  tarefa: TarefaPlano
  usuarios: Usuario[]
  recarregar: () => void
}) {
  const nomeDe = (id: string | null) => (id ? usuarios.find((u) => u.id === id)?.nome ?? id : '')
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const [aConfirmar, setAConfirmar] = useState(false)
  const [aMostrarDestravar, setAMostrarDestravar] = useState(false)
  const [motivo, setMotivo] = useState('')

  const concluida = tarefa.status === 'CONCLUIDO'

  async function confirmarConclusao() {
    if (!usuario) return
    await supabase
      .from('tarefas_plano')
      .update({ status: 'CONCLUIDO', executado_por: usuario.id, dt_hr_conclusao_real: new Date().toISOString() })
      .eq('id', tarefa.id)
    setAConfirmar(false)
    recarregar()
  }

  async function destravar() {
    if (!motivo.trim()) return
    await supabase.rpc('destravar_tarefa_plano', { p_id: tarefa.id, p_motivo: motivo })
    setAMostrarDestravar(false)
    setMotivo('')
    recarregar()
  }

  return (
    <div className="flex flex-col gap-1 border-b border-zinc-100 py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-zinc-700">
          <strong className="font-semibold text-zinc-900">{formatarDataPT(tarefa.data_execucao)}</strong>
          {tarefa.hora_arranque ? ` · ${tarefa.hora_arranque.slice(0, 5)}` : ''} · {tarefa.descricao_tarefa}
          <div className="text-xs text-zinc-400">
            {tarefa.equipa_responsavel}
            {tarefa.hr_limite ? ` · HR. LIMITE: ${tarefa.hr_limite.slice(0, 5)}` : ''}
          </div>
        </div>

        {concluida ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-indigo-700">
            <Lock className="size-2.5" />
            Concluída
          </span>
        ) : aConfirmar ? (
          <span className="flex shrink-0 gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="xs" onClick={confirmarConclusao}>
                  Confirmar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regista esta tarefa como concluída, com o teu nome e a hora atual — fica trancada depois</TooltipContent>
            </Tooltip>
            <Button size="xs" variant="ghost" onClick={() => setAConfirmar(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <Button size="xs" variant="secondary" className="shrink-0" onClick={() => setAConfirmar(true)}>
            Marcar concluída
          </Button>
        )}
      </div>

      {concluida && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          Concluída por {nomeDe(tarefa.executado_por)} em{' '}
          {tarefa.dt_hr_conclusao_real && new Date(tarefa.dt_hr_conclusao_real).toLocaleString('pt-PT')}
          {ehGerenteOuDelegado && !aMostrarDestravar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="xs" variant="ghost" className="h-5 px-1.5 text-[0.68rem]" onClick={() => setAMostrarDestravar(true)}>
                  Destravar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reabre esta tarefa já concluída, para corrigir um carimbo por engano — pede uma justificativa</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {aMostrarDestravar && (
        <div className="flex gap-1.5">
          <Input
            placeholder="Justificativa do destravar (obrigatória)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="flex-1 text-xs"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" size="sm" disabled={!motivo.trim()} onClick={destravar}>
                Confirmar destravar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regista a justificativa e volta a marcar a tarefa como por concluir</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
