import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useDebounce } from '@/lib/hooks/useDebounce'
import type { Ferias, Usuario } from '@/types/database'
import { formatarDataPT } from '@/lib/datas'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const ESTILO_STATUS: Record<string, string> = {
  APROVADA: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PENDENTE: 'bg-amber-50 text-amber-700 border-amber-100',
  REJEITADA: 'bg-red-50 text-red-700 border-red-100',
}

export function PainelFerias({ usuarios }: { usuarios: Usuario[] }) {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const [pedidos, setPedidos] = useState<Ferias[]>([])
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  // Conta invocações de carregar() para descartar respostas antigas que
  // resolvam depois de uma mais recente — a subscrição realtime pode
  // disparar carregar() várias vezes em rápida sucessão (ex.: várias
  // aprovações seguidas), e pedidos concorrentes não têm garantia de
  // resolver pela mesma ordem em que foram feitos.
  const idCarregamentoRef = useRef(0)

  async function carregar() {
    const meuId = ++idCarregamentoRef.current
    const { data } = await supabase
      .from('ferias')
      .select('*')
      .in('status', ehGerenteOuDelegado ? ['PENDENTE', 'APROVADA'] : ['PENDENTE'])
      .order('data_inicio')
    if (idCarregamentoRef.current === meuId) {
      setPedidos((data as Ferias[]) ?? [])
    }
  }

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('ferias-painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ferias' }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehGerenteOuDelegado])

  async function pedirFerias(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setErro(null)
    setAEnviar(true)
    const { error } = await supabase
      .from('ferias')
      .insert({ usuario_id: usuario.id, data_inicio: dataInicio, data_fim: dataFim })
    setAEnviar(false)
    if (error) {
      setErro(traduzirErro(error.message))
    } else {
      setDataInicio('')
      setDataFim('')
    }
  }

  // Debounce para prevenir múltiplas submissões acidentais em clicks rápidos de Aprovar/Rejeitar
  const decidirDebounced = useDebounce(
    async (id: number, status: 'APROVADA' | 'REJEITADA') => {
      if (!usuario) return
      await supabase
        .from('ferias')
        .update({ status, aprovado_por: usuario.id, data_aprovacao: new Date().toISOString() })
        .eq('id', id)
    },
    500
  )

  function nomeDe(id: string) {
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Férias</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={pedirFerias} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Data de início
            <Input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Data de fim
            <Input type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </label>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button type="submit" variant="secondary" disabled={aEnviar}>
            {aEnviar ? 'A enviar…' : 'Pedir férias'}
          </Button>
        </form>

        <div className="flex flex-col gap-2">
          {pedidos.length === 0 && <p className="text-sm text-zinc-400">Sem pedidos pendentes.</p>}
          {pedidos.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-700">
                {nomeDe(f.usuario_id)} · {formatarDataPT(f.data_inicio)} a {formatarDataPT(f.data_fim)}
              </span>
              {f.status === 'PENDENTE' && ehGerenteOuDelegado ? (
                <span className="flex shrink-0 gap-1.5">
                  <Button size="xs" onClick={() => decidirDebounced(f.id, 'APROVADA')}>
                    Aprovar
                  </Button>
                  <Button size="xs" variant="destructive" onClick={() => decidirDebounced(f.id, 'REJEITADA')}>
                    Rejeitar
                  </Button>
                </span>
              ) : (
                <span
                  className={cn(
                    'shrink-0 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                    ESTILO_STATUS[f.status]
                  )}
                >
                  {f.status}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function traduzirErro(mensagem: string): string {
  if (mensagem.includes('sobrepostas')) return 'Já existem férias pedidas/aprovadas de outro colega neste período.'
  if (mensagem.includes('saldo anual')) return 'Este pedido ultrapassa o saldo anual de 22 dias úteis de férias.'
  if (mensagem.includes('escala atribuída')) return 'Já existe escala atribuída a esta pessoa num período sobreposto.'
  return mensagem
}
