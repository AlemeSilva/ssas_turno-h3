import { useMemo, useState, type FormEvent } from 'react'
import { usePlanoCiclo } from '@/data/usePlanoCiclo'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { semanaRefDe, paraISO, formatarDataPT } from '@/lib/datas'
import { gerarTextoPlano } from '@/lib/exportarPlano'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const ROTULO_STATUS_PLANO: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE_APROVACAO: 'Pendente de aprovação',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium', className)}>
      {children}
    </span>
  )
}

export function PlanoPage() {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const dataInicioCiclo = useMemo(() => paraISO(semanaRefDe(new Date())), [])
  const { plano, tarefas, aCarregar, recarregar, criarPlano } = usePlanoCiclo(dataInicioCiclo)

  const [textoExportado, setTextoExportado] = useState<string | null>(null)
  const [novaTarefa, setNovaTarefa] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleCriarPlano() {
    if (!usuario) return
    const { error } = await criarPlano(usuario.id)
    if (error) setErro(error.message)
  }

  async function submeterParaAprovacao() {
    if (!plano) return
    await supabase.from('planos').update({ status: 'PENDENTE_APROVACAO' }).eq('id', plano.id)
    recarregar()
  }

  async function aprovar() {
    if (!plano || !usuario) return
    await supabase
      .from('planos')
      .update({ status: 'APROVADO', aprovado_por: usuario.id, data_aprovacao: new Date().toISOString() })
      .eq('id', plano.id)
    recarregar()
  }

  async function adicionarTarefaExcecional(e: FormEvent) {
    e.preventDefault()
    if (!plano || !novaTarefa.trim()) return
    await supabase.from('tarefas_plano').insert({
      id_plano: plano.id,
      data_execucao: paraISO(new Date()),
      descricao_tarefa: novaTarefa.trim(),
      equipa_responsavel: 'DEOS - Operações',
      origem: 'EXCECIONAL',
    })
    setNovaTarefa('')
    recarregar()
  }

  function exportar(versao: 'DRAFT' | 'DEFINITIVO') {
    if (!plano) return
    setTextoExportado(gerarTextoPlano(plano, tarefas, versao))
  }

  if (aCarregar) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">A carregar…</CardContent>
      </Card>
    )
  }

  if (!plano) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <CardTitle>Plano de Fim de Semana</CardTitle>
          <p className="text-sm text-zinc-500">
            Ainda não existe plano para o ciclo com início em {formatarDataPT(dataInicioCiclo)}.
          </p>
          {erro && <Badge className="border-red-100 bg-red-50 text-red-700">{erro}</Badge>}
          <Button onClick={handleCriarPlano} className="self-start">
            Criar plano (pré-popula tarefas fixas)
          </Button>
        </CardContent>
      </Card>
    )
  }

  const porDia = new Map<string, typeof tarefas>()
  for (const t of tarefas) {
    const lista = porDia.get(t.data_execucao) ?? []
    lista.push(t)
    porDia.set(t.data_execucao, lista)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <CardTitle className="flex items-center gap-2">
              Plano de {formatarDataPT(dataInicioCiclo)}
              {plano.tipo_fim_semana === 'MANUTENCAO' && (
                <Badge className="border-amber-100 bg-amber-50 text-amber-700">MANUTENÇÃO</Badge>
              )}
            </CardTitle>
            <div className="mt-1.5">
              <Badge className="border-zinc-200 bg-zinc-100 text-zinc-500">{ROTULO_STATUS_PLANO[plano.status]}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={() => exportar('DRAFT')}>
                  Exportar Draft
                </Button>
              </TooltipTrigger>
              <TooltipContent>Prévia de texto, mesmo antes de o plano estar aprovado — para rever antes de avançar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" onClick={() => exportar('DEFINITIVO')} disabled={plano.status === 'RASCUNHO'}>
                  Exportar Definitivo
                </Button>
              </TooltipTrigger>
              <TooltipContent>Texto final pronto a partilhar — só disponível depois do plano sair do rascunho</TooltipContent>
            </Tooltip>
            {plano.status === 'RASCUNHO' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" onClick={submeterParaAprovacao}>
                    Submeter para aprovação
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Passa o plano de Rascunho para Pendente de aprovação, visível ao Gerente</TooltipContent>
              </Tooltip>
            )}
            {plano.status === 'PENDENTE_APROVACAO' && ehGerenteOuDelegado && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={aprovar}>Aprovar</Button>
                </TooltipTrigger>
                <TooltipContent>Aprova o plano — fica pronto para exportação definitiva e execução</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardContent>
      </Card>

      {textoExportado && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle>Texto pronto a copiar</CardTitle>
              <Button variant="ghost" onClick={() => setTextoExportado(null)}>
                Fechar
              </Button>
            </div>
            <Textarea readOnly value={textoExportado} className="h-64 font-mono text-xs" />
          </CardContent>
        </Card>
      )}

      {[...porDia.entries()].sort().map(([dia, lista]) => (
        <Card key={dia}>
          <CardContent className="flex flex-col gap-2 pt-6">
            <CardTitle>{formatarDataPT(dia)}</CardTitle>
            {lista.map((t) => (
              <div key={t.id} className="border-b border-zinc-100 pb-2 text-sm last:border-b-0">
                <strong className="font-semibold text-zinc-900">{t.hora_arranque ?? '—'}</strong> · {t.descricao_tarefa}
                <div className="text-xs text-zinc-400">
                  {t.equipa_responsavel}
                  {t.hr_limite ? ` · HR. LIMITE: ${t.hr_limite}` : ''}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={adicionarTarefaExcecional} className="flex gap-2">
            <Input
              placeholder="Descrição da tarefa excecional"
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              className="flex-1"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" variant="secondary">
                  Adicionar tarefa excecional
                </Button>
              </TooltipTrigger>
              <TooltipContent>Junta uma tarefa avulsa a hoje, fora das tarefas fixas que já vêm no modelo do plano</TooltipContent>
            </Tooltip>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
