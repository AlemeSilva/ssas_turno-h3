import { useState } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import type { ChecklistItem, Usuario } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
    <div className="flex flex-col gap-1 border-b border-zinc-100 py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-zinc-700">{item.item_descricao}</span>

        {item.concluido ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-indigo-700">
            <Lock className="size-2.5" />
            Concluído
          </span>
        ) : aConfirmar ? (
          <span className="flex shrink-0 gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="xs" onClick={confirmarConclusao}>
                  Confirmar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regista este item como concluído, com o teu nome e a hora atual — fica trancado depois</TooltipContent>
            </Tooltip>
            <Button size="xs" variant="ghost" onClick={() => setAConfirmar(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <Button size="xs" variant="secondary" onClick={() => setAConfirmar(true)}>
            Marcar concluído
          </Button>
        )}
      </div>

      {item.concluido && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          Carimbado por {nomeDe(item.concluido_por)} em{' '}
          {item.data_hora_conclusao && new Date(item.data_hora_conclusao).toLocaleString('pt-PT')}
          {ehGerenteOuDelegado && !aMostrarDestravar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="xs" variant="ghost" className="h-5 px-1.5 text-[0.68rem]" onClick={() => setAMostrarDestravar(true)}>
                  Destravar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reabre este item já concluído, para corrigir um carimbo por engano — pede uma justificativa</TooltipContent>
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
            <TooltipContent>Regista a justificativa e volta a marcar o item como por concluir</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
