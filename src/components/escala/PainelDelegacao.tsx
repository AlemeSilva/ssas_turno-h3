import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import type { DelegacaoAprovacao, Usuario } from '@/types/database'
import { formatarDataPT } from '@/lib/datas'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PainelDelegacao({ usuarios }: { usuarios: Usuario[] }) {
  const { usuario } = useAuth()
  const [delegacoes, setDelegacoes] = useState<DelegacaoAprovacao[]>([])
  const [substitutoId, setSubstitutoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  const souGerenteTitular = usuario?.perfil === 'GERENTE'
  const candidatos = usuarios.filter((u) => u.id !== usuario?.id)

  async function carregar() {
    const { data } = await supabase
      .from('delegacoes_aprovacao')
      .select('*')
      .gte('data_fim', new Date().toISOString().slice(0, 10))
      .order('data_inicio')
    setDelegacoes((data as DelegacaoAprovacao[]) ?? [])
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    // Ver comentário equivalente em PainelTrocas.tsx — o <Select> não é
    // um <select> nativo, por isso repõe-se manualmente a validação que
    // o "required" nativo garantia antes.
    if (!substitutoId) {
      setErro('Escolhe um substituto.')
      return
    }
    setErro(null)
    setAEnviar(true)
    const { error } = await supabase.from('delegacoes_aprovacao').insert({
      gerente_titular: usuario.id,
      substituto: substitutoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
    })
    setAEnviar(false)
    if (error) {
      setErro(error.message.includes('já existe') ? 'Já existe uma delegação ativa nesse período.' : error.message)
    } else {
      setSubstitutoId('')
      setDataInicio('')
      setDataFim('')
      carregar()
    }
  }

  function nomeDe(id: string) {
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  if (!souGerenteTitular) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delegação de Aprovação</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="-mt-2 text-xs text-zinc-400">
          Aditiva — mantém sempre o teu próprio poder de aprovar durante a janela.
        </p>

        <form onSubmit={criar} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Substituto
            <Select value={substitutoId} onValueChange={setSubstitutoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar…" />
              </SelectTrigger>
              <SelectContent>
                {candidatos.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            De
            <Input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Até
            <Input type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </label>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button type="submit" variant="secondary" disabled={aEnviar}>
            {aEnviar ? 'A criar…' : 'Criar delegação'}
          </Button>
        </form>

        <div className="flex flex-col gap-1.5">
          {delegacoes.length === 0 && <p className="text-sm text-zinc-400">Sem delegações ativas.</p>}
          {delegacoes.map((d) => (
            <div key={d.id} className="text-sm text-zinc-700">
              {nomeDe(d.substituto)} · {formatarDataPT(d.data_inicio)} a {formatarDataPT(d.data_fim)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
