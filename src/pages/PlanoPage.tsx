import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { usePlanoCiclo } from '@/data/usePlanoCiclo'
import { useAuth } from '@/auth/AuthContext'
import { useUsuarios } from '@/data/useUsuarios'
import { supabase } from '@/lib/supabase'
import { semanaRefDe, adicionarDias, paraISO, formatarDataPT } from '@/lib/datas'
import { gerarTextoPlano } from '@/lib/exportarPlano'
import { cn } from '@/lib/utils'
import type { TarefaPlano } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

// Partilhada entre adicionar e editar tarefa excecional — os 3 campos
// em comum têm exatamente a mesma regra e mensagem nos dois formulários.
function erroDeCamposTarefa(data: string, hora: string, equipa: string): string | null {
  if (!data) return 'Escolhe o dia da tarefa.'
  if (!hora) return 'Escolhe a hora de arranque.'
  if (!equipa.trim()) return 'Indica a equipa responsável.'
  return null
}

export function PlanoPage() {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const { usuarios } = useUsuarios()
  const dataInicioCiclo = useMemo(() => paraISO(semanaRefDe(new Date())), [])
  const { plano, tarefas, aCarregar, recarregar, criarPlano } = usePlanoCiclo(dataInicioCiclo)

  // Os 5 dias válidos do ciclo aberto (Qui→Seg), para a tarefa
  // excecional ser sempre associada a um deles — nunca a uma data
  // arbitrária fora do plano.
  const diasCiclo = useMemo(() => {
    const nomes = ['Quinta', 'Sexta', 'Sábado', 'Domingo', 'Segunda']
    const quinta = new Date(dataInicioCiclo + 'T00:00:00')
    return nomes.map((nome, i) => {
      const iso = paraISO(adicionarDias(quinta, i))
      return { iso, rotulo: `${nome} · ${formatarDataPT(iso)}` }
    })
  }, [dataInicioCiclo])

  const [textoExportado, setTextoExportado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erroCopia, setErroCopia] = useState(false)
  const [novaTarefa, setNovaTarefa] = useState('')
  const [novaData, setNovaData] = useState('')
  const [novaHora, setNovaHora] = useState('')
  const [novaHrLimite, setNovaHrLimite] = useState('')
  const [novaEquipa, setNovaEquipa] = useState('DEOS - Operações')
  const [erroNovaTarefa, setErroNovaTarefa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const [tarefaEditar, setTarefaEditar] = useState<TarefaPlano | null>(null)
  const [editData, setEditData] = useState('')
  const [editHora, setEditHora] = useState('')
  const [editHrLimite, setEditHrLimite] = useState('')
  const [editEquipa, setEditEquipa] = useState('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editAtualizadoEm, setEditAtualizadoEm] = useState('')
  const [aEditar, setAEditar] = useState(false)
  const [erroEditar, setErroEditar] = useState<string | null>(null)

  // Aviso não bloqueante — ex.: quando editar/adicionar uma tarefa reabre
  // um plano já aprovado para nova aprovação do Gerente (ver trigger
  // trg_tarefas_plano_reabre), para não parecer que a alteração ficou
  // perdida quando na verdade voltou a Pendente de aprovação.
  const [aviso, setAviso] = useState<string | null>(null)

  // undefined = ainda a carregar; null = ninguém escalado de H3 para
  // este ciclo. Só o Gerente/delegado ou esta pessoa podem criar o
  // plano — mesma regra já aplicada em planos_insert (RLS), aqui só
  // para a interface não mostrar o botão a quem a base ia recusar.
  const [operadorCicloId, setOperadorCicloId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      const sabadoCiclo = paraISO(adicionarDias(new Date(dataInicioCiclo + 'T00:00:00'), 2))
      const { data } = await supabase
        .from('escala_semanal')
        .select('usuario_id')
        .eq('semana_ref', sabadoCiclo)
        .eq('turno', 'H3')
        .maybeSingle()
      if (!cancelado) setOperadorCicloId((data as { usuario_id: string } | null)?.usuario_id ?? null)
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [dataInicioCiclo])

  const nomeOperadorCiclo = usuarios.find((u) => u.id === operadorCicloId)?.nome ?? null
  // Nome amplo de propósito — cobre criar, aprovar e editar tarefas
  // excecionais: Gerente/delegado, ou o operador H3 escalado para este
  // ciclo (mesma regra que pode_editar_plano já aplica na RLS).
  const podeGerirPlano = ehGerenteOuDelegado || (usuario && usuario.id === operadorCicloId)
  // Enquanto operadorCicloId ainda está a carregar (undefined), um
  // operador H3 legítimo deste ciclo ainda não sabe se pode editar — sem
  // isto, o botão de editar tarefa pisca escondido→visível a cada carga.
  const permissoesResolvidas = ehGerenteOuDelegado || operadorCicloId !== undefined

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
    const erroCampos = erroDeCamposTarefa(novaData, novaHora, novaEquipa)
    if (erroCampos) {
      setErroNovaTarefa(erroCampos)
      return
    }
    setErroNovaTarefa(null)
    const reabre = plano.status === 'APROVADO' || plano.status === 'EM_EXECUCAO'
    await supabase.from('tarefas_plano').insert({
      id_plano: plano.id,
      data_execucao: novaData,
      hora_arranque: novaHora,
      hr_limite: novaHrLimite || null,
      descricao_tarefa: novaTarefa.trim(),
      equipa_responsavel: novaEquipa.trim(),
      origem: 'EXCECIONAL',
    })
    setNovaTarefa('')
    setNovaData('')
    setNovaHora('')
    setNovaHrLimite('')
    setTextoExportado(null)
    if (reabre && !ehGerenteOuDelegado) {
      setAviso('Esta tarefa reabriu o plano para nova aprovação do Gerente, porque já estava aprovado.')
    }
    recarregar()
  }

  function abrirEdicao(t: TarefaPlano) {
    setTarefaEditar(t)
    setEditData(t.data_execucao)
    // O Postgres devolve `time` como HH:MM:SS — o <input type="time">
    // sem step="1" espera HH:MM, por isso corta os segundos.
    setEditHora((t.hora_arranque ?? '').slice(0, 5))
    setEditHrLimite((t.hr_limite ?? '').slice(0, 5))
    setEditEquipa(t.equipa_responsavel)
    setEditDescricao(t.descricao_tarefa)
    setEditAtualizadoEm(t.atualizado_em)
    setErroEditar(null)
  }

  async function guardarEdicao(e: FormEvent) {
    e.preventDefault()
    if (!tarefaEditar) return
    const erroCampos = erroDeCamposTarefa(editData, editHora, editEquipa)
    if (erroCampos) {
      setErroEditar(erroCampos)
      return
    }
    if (!editDescricao.trim()) {
      setErroEditar('Indica a descrição da tarefa.')
      return
    }
    setErroEditar(null)
    setAEditar(true)
    const reabre = plano?.status === 'APROVADO' || plano?.status === 'EM_EXECUCAO'
    // Bloqueio otimista via atualizado_em: só grava se ninguém mexeu na
    // tarefa desde que abriste o diálogo — sem isto, esta gravação
    // apagaria em silêncio a alteração de outra pessoa (última escrita
    // ganha, sem aviso). Sem linha devolvida: ou já não existe, ou
    // mudou entretanto.
    const { data, error } = await supabase
      .from('tarefas_plano')
      .update({
        data_execucao: editData,
        hora_arranque: editHora,
        hr_limite: editHrLimite || null,
        equipa_responsavel: editEquipa.trim(),
        descricao_tarefa: editDescricao.trim(),
      })
      .eq('id', tarefaEditar.id)
      .eq('atualizado_em', editAtualizadoEm)
      .select()
      .maybeSingle()
    setAEditar(false)
    if (error) {
      setErroEditar(error.message)
      return
    }
    if (!data) {
      setErroEditar('Não foi possível guardar — a tarefa foi alterada ou removida por outra pessoa entretanto. Fecha e tenta novamente.')
      recarregar()
      return
    }
    setTextoExportado(null)
    if (reabre && !ehGerenteOuDelegado) {
      setAviso('Esta alteração reabriu o plano para nova aprovação do Gerente, porque já estava aprovado.')
    }
    setTarefaEditar(null)
    recarregar()
  }

  function exportar(versao: 'DRAFT' | 'DEFINITIVO') {
    if (!plano) return
    setCopiado(false)
    setErroCopia(false)
    setTextoExportado(gerarTextoPlano(plano, tarefas, versao))
  }

  async function copiarTexto() {
    if (!textoExportado) return
    try {
      await navigator.clipboard.writeText(textoExportado)
      setErroCopia(false)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Permissão de área de transferência negada pelo browser, ou API
      // indisponível — o texto continua selecionável à mão na caixa.
      setCopiado(false)
      setErroCopia(true)
    }
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
          {operadorCicloId === undefined ? (
            <p className="text-sm text-zinc-400">A verificar permissões…</p>
          ) : podeGerirPlano ? (
            <>
              {erro && <Badge className="border-red-100 bg-red-50 text-red-700">{erro}</Badge>}
              <Button onClick={handleCriarPlano} className="self-start">
                Criar plano (pré-popula tarefas fixas)
              </Button>
            </>
          ) : (
            <p className="text-sm text-zinc-400">
              {nomeOperadorCiclo
                ? `Só ${nomeOperadorCiclo} (operador H3 desta semana) ou o Gerente podem criar este plano.`
                : 'Só o operador H3 desta semana ou o Gerente podem criar este plano — ainda não há H3 atribuído para este ciclo.'}
            </p>
          )}
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
              {plano.status === 'RASCUNHO' || plano.status === 'PENDENTE_APROVACAO'
                ? `Plano Prévio · ${formatarDataPT(dataInicioCiclo)}`
                : `Plano Definitivo · ${formatarDataPT(plano.data_aprovacao ? paraISO(new Date(plano.data_aprovacao)) : dataInicioCiclo)}`}
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
                <Button
                  variant="ghost"
                  onClick={() => exportar('DEFINITIVO')}
                  disabled={plano.status === 'RASCUNHO' || plano.status === 'PENDENTE_APROVACAO'}
                >
                  Exportar Definitivo
                </Button>
              </TooltipTrigger>
              <TooltipContent>Texto final pronto a partilhar — só disponível depois de o plano estar aprovado</TooltipContent>
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
            {plano.status === 'PENDENTE_APROVACAO' && podeGerirPlano && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={aprovar}>Aprovar</Button>
                </TooltipTrigger>
                <TooltipContent>Aprova o plano — fica pronto para exportação definitiva e execução. Gerente/delegado ou o operador H3 deste ciclo podem aprovar</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardContent>
      </Card>

      {aviso && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>{aviso}</span>
          <Button variant="ghost" size="sm" onClick={() => setAviso(null)}>
            Fechar
          </Button>
        </div>
      )}

      {textoExportado && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex items-center justify-between">
              <CardTitle>Texto pronto a copiar</CardTitle>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={copiarTexto}>
                  {copiado ? 'Copiado!' : erroCopia ? 'Falhou — copia à mão' : 'Copiar'}
                </Button>
                <Button variant="ghost" onClick={() => setTextoExportado(null)}>
                  Fechar
                </Button>
              </div>
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
              <div key={t.id} className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2 text-sm last:border-b-0">
                <div>
                  <strong className="font-semibold text-zinc-900">{t.hora_arranque ?? '—'}</strong> · {t.descricao_tarefa}
                  <div className="text-xs text-zinc-400">
                    {t.equipa_responsavel}
                    {t.hr_limite ? ` · HR. LIMITE: ${t.hr_limite}` : ''}
                  </div>
                </div>
                {permissoesResolvidas && podeGerirPlano && t.origem === 'EXCECIONAL' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon-xs" variant="ghost" aria-label="Editar tarefa excecional" onClick={() => abrirEdicao(t)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Corrigir dia, hora, equipa ou descrição desta tarefa avulsa</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={adicionarTarefaExcecional} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Select value={novaData} onValueChange={setNovaData}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Dia…" />
                </SelectTrigger>
                <SelectContent>
                  {diasCiclo.map((d) => (
                    <SelectItem key={d.iso} value={d.iso}>
                      {d.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                aria-label="Hora de arranque"
                value={novaHora}
                onChange={(e) => setNovaHora(e.target.value)}
                className="w-28"
              />
              <Input
                placeholder="Equipa responsável"
                value={novaEquipa}
                onChange={(e) => setNovaEquipa(e.target.value)}
                className="w-44"
              />
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
                <TooltipContent>Junta uma tarefa avulsa a um dos dias do ciclo, fora das tarefas fixas que já vêm no modelo do plano</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                    Hora-limite (opcional)
                    <Input
                      type="time"
                      aria-label="Hora-limite"
                      value={novaHrLimite}
                      onChange={(e) => setNovaHrLimite(e.target.value)}
                      className="w-28"
                    />
                  </label>
                </TooltipTrigger>
                <TooltipContent>Se definida, esta tarefa passa a entrar nos alertas de atraso quando a hora-limite for ultrapassada sem estar concluída</TooltipContent>
              </Tooltip>
            </div>
            {erroNovaTarefa && <p className="text-xs text-red-600">{erroNovaTarefa}</p>}
          </form>
        </CardContent>
      </Card>

      <Dialog open={tarefaEditar !== null} onOpenChange={(aberto) => !aberto && !aEditar && setTarefaEditar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tarefa excecional</DialogTitle>
            <DialogDescription>Corrige o dia, hora, equipa ou descrição — a tarefa mantém-se a mesma, só os dados mudam.</DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarEdicao} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Dia</span>
              <Select value={editData} onValueChange={setEditData}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Dia…" />
                </SelectTrigger>
                <SelectContent>
                  {diasCiclo.map((d) => (
                    <SelectItem key={d.iso} value={d.iso}>
                      {d.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Hora de arranque</span>
              <Input type="time" value={editHora} onChange={(e) => setEditHora(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Hora-limite (opcional)</span>
              <Input type="time" value={editHrLimite} onChange={(e) => setEditHrLimite(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Equipa responsável</span>
              <Input value={editEquipa} onChange={(e) => setEditEquipa(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Descrição</span>
              <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} />
            </label>
            {erroEditar && <p className="text-sm text-red-600">{erroEditar}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarefaEditar(null)} disabled={aEditar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={aEditar}>
                {aEditar ? 'A guardar…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
