import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useCadeiasCatalogo } from '@/data/useCadeiasCatalogo'
import { useAuth } from '@/auth/AuthContext'
import type { CategoriaCadeia } from '@/types/database'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const ROTULO_CATEGORIA: Record<CategoriaCadeia, string> = {
  NORMAL: 'Normal',
  ASTERISCO: '* (cópia automática para Cloud)',
  DUPLO_ASTERISCO: '** (input AML/MAB)',
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="border-b border-zinc-100 px-2 py-1.5 text-left text-xs font-medium text-zinc-400">{children}</th>
}

function Td({ children, colSpan }: { children?: React.ReactNode; colSpan?: number }) {
  return (
    <td className="border-b border-zinc-100 px-2 py-1.5" colSpan={colSpan}>
      {children}
    </td>
  )
}

export function DefinicoesPage() {
  const { ehGerenteOuDelegado } = useAuth()
  const { catalogo, dependenciasGirFl, aCarregar } = useCadeiasCatalogo()
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<CategoriaCadeia>('NORMAL')
  const [erro, setErro] = useState<string | null>(null)

  if (!ehGerenteOuDelegado) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">Esta área é reservada ao Gerente.</CardContent>
      </Card>
    )
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) return
    const proximaOrdem = catalogo.length > 0 ? Math.max(...catalogo.map((c) => c.ordem)) + 1 : 1
    const { error } = await supabase
      .from('cadeias_catalogo')
      .insert({ nome_cadeia: nome.trim().toUpperCase(), categoria, ordem: proximaOrdem, ativo: true })
    if (error) {
      setErro(error.message)
    } else {
      setNome('')
      setCategoria('NORMAL')
    }
  }

  async function alternarAtivo(nomeCadeia: string, ativo: boolean) {
    await supabase.from('cadeias_catalogo').update({ ativo: !ativo }).eq('nome_cadeia', nomeCadeia)
  }

  async function alternarDependenciaGirFl(nomeCadeia: string, incluida: boolean) {
    if (incluida) {
      await supabase.from('gir_fl_dependencias').delete().eq('nome_cadeia', nomeCadeia)
    } else {
      await supabase.from('gir_fl_dependencias').insert({ nome_cadeia: nomeCadeia })
    }
  }

  if (aCarregar) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">A carregar…</CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div>
            <CardTitle>Gestão de Cadeias</CardTitle>
            <p className="mt-2 text-sm text-zinc-500">
              Adicionar ou desativar uma cadeia da matriz de acompanhamento diário — situação pouco frequente, mas
              suportada sem alterações de código. Uma cadeia com histórico registado nunca é apagada, só desativada:
              deixa de entrar em novos planos, mas os registos antigos mantêm-se intactos para auditoria.
            </p>
          </div>

          <form onSubmit={adicionar} className="flex items-end gap-2.5">
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Nome da cadeia
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: SD_NOVA" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Categoria
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaCadeia)}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROTULO_CATEGORIA) as CategoriaCadeia[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {ROTULO_CATEGORIA[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button type="submit" variant="secondary">
              Adicionar cadeia
            </Button>
          </form>
          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <Th>Cadeia</Th>
                <Th>Categoria</Th>
                <Th>Dependência GIR_FL (22h)</Th>
                <Th>Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {catalogo.map((c) => {
                const incluidaGirFl = dependenciasGirFl.includes(c.nome_cadeia)
                const eOProprioGirFl = c.nome_cadeia === 'GIR_FL'
                return (
                  <tr key={c.nome_cadeia}>
                    <Td>{c.nome_cadeia}</Td>
                    <Td>{ROTULO_CATEGORIA[c.categoria]}</Td>
                    <Td>
                      {!eOProprioGirFl && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="xs"
                              variant={incluidaGirFl ? 'secondary' : 'ghost'}
                              onClick={() => alternarDependenciaGirFl(c.nome_cadeia, incluidaGirFl)}
                            >
                              {incluidaGirFl ? 'Incluída' : 'Não incluída'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {incluidaGirFl
                              ? 'Esta cadeia atrasa o alerta de risco da GIR_FL às 22h — clica para retirar'
                              : 'Clica para esta cadeia passar a atrasar o alerta de risco da GIR_FL às 22h'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                          c.ativo ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                        )}
                      >
                        {c.ativo ? 'Ativa' : 'Desativada'}
                      </span>
                    </Td>
                    <Td>
                      <Button size="xs" variant="ghost" onClick={() => alternarAtivo(c.nome_cadeia, c.ativo)}>
                        {c.ativo ? 'Desativar' : 'Reativar'}
                      </Button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
