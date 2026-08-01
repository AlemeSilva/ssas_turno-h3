import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { usuariosH3Ativos } from '@/data/useUsuarios'
import type { TrocaEscala, Usuario } from '@/types/database'
import { formatarDataPT } from '@/lib/datas'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PainelTrocas({ usuarios }: { usuarios: Usuario[] }) {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const [trocas, setTrocas] = useState<TrocaEscala[]>([])
  const [semanaRef, setSemanaRef] = useState('')
  const [substitutoId, setSubstitutoId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  const elegiveisH3 = usuariosH3Ativos(usuarios).filter((u) => u.id !== usuario?.id)
  const souOperadorH3 = usuario?.perfil === 'OPERADOR_H3'

  // Ver comentário equivalente em PainelFerias.tsx — descarta respostas
  // de carregar() que resolvam fora de ordem.
  const idCarregamentoRef = useRef(0)

  async function carregar() {
    const meuId = ++idCarregamentoRef.current
    const { data } = await supabase.from('trocas_escala').select('*').eq('status', 'PROPOSTA').order('semana_ref')
    if (idCarregamentoRef.current === meuId) {
      setTrocas((data as TrocaEscala[]) ?? [])
    }
  }

  useEffect(() => {
    carregar()
    const canal = supabase
      .channel('trocas-painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trocas_escala' }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  async function propor(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    // O <Select> do shadcn/Radix não é um <select> nativo, por isso não
    // participa na validação HTML do formulário (o "required" nativo
    // que antes impedia submissão sem substituto escolhido) — a
    // verificação abaixo repõe essa mesma proteção manualmente.
    if (!substitutoId) {
      setErro('Escolhe um substituto.')
      return
    }
    setErro(null)
    setAEnviar(true)
    const { error } = await supabase.from('trocas_escala').insert({
      usuario_proponente: usuario.id,
      usuario_substituto: substitutoId,
      semana_ref: semanaRef,
    })
    setAEnviar(false)
    if (error) {
      setErro(error.message)
    } else {
      setSemanaRef('')
      setSubstitutoId('')
    }
  }

  // Debounce para prevenir múltiplas submissões acidentais em clicks rápidos de Aprovar/Rejeitar
  const decidirDebounced = useDebounce(
    async (id: number, status: 'APROVADA' | 'REJEITADA') => {
      if (!usuario) return
      await supabase
        .from('trocas_escala')
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
        <CardTitle>Trocas de H3</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {souOperadorH3 && (
          <form onSubmit={propor} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Semana (Quinta de referência)
              <Input type="date" required value={semanaRef} onChange={(e) => setSemanaRef(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Substituto
              <Select value={substitutoId} onValueChange={setSubstitutoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  {elegiveisH3.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <Button type="submit" variant="secondary" disabled={aEnviar}>
              {aEnviar ? 'A enviar…' : 'Propor troca'}
            </Button>
          </form>
        )}

        <div className="flex flex-col gap-2">
          {trocas.length === 0 && <p className="text-sm text-zinc-400">Sem trocas propostas.</p>}
          {trocas.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-700">
                {formatarDataPT(t.semana_ref)}: {nomeDe(t.usuario_proponente)} → {nomeDe(t.usuario_substituto)}
              </span>
              {ehGerenteOuDelegado ? (
                <span className="flex shrink-0 gap-1.5">
                  <Button size="xs" onClick={() => decidirDebounced(t.id, 'APROVADA')}>
                    Aprovar
                  </Button>
                  <Button size="xs" variant="destructive" onClick={() => decidirDebounced(t.id, 'REJEITADA')}>
                    Rejeitar
                  </Button>
                </span>
              ) : (
                <span className="shrink-0 rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-700">
                  PROPOSTA
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
