import { useMemo, useState } from 'react'
import { ArrowRightLeft, ChevronLeft, ChevronRight, Lock, SlidersHorizontal, Sun, X } from 'lucide-react'
import { useUsuarios } from '@/data/useUsuarios'
import { useEscalaMes } from '@/data/useEscalaMes'
import { adicionarDias, ehFimDeSemana, formatarDataPT, formatarMesAnoPT, isoWeekday, paraISO } from '@/lib/datas'
import type { EscalaSemanal, Ferias, FeriadoPortugal, PlantaoVoluntario, TurnoTipo, Usuario } from '@/types/database'
import { PainelFerias } from '@/components/escala/PainelFerias'
import { PainelTrocas } from '@/components/escala/PainelTrocas'
import { PainelDelegacao } from '@/components/escala/PainelDelegacao'
import { useAuth } from '@/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RespostaSugestao {
  semana_ref: string
  H3: { usuario_id: string; nome: string; precisa_override: boolean } | null
  H1: string | null
  H2: string | null
  H4: string | null
}

function proximaQuinta(): string {
  const hoje = new Date()
  const diff = (4 - hoje.getDay() + 7) % 7 || 7
  const quinta = new Date(hoje)
  quinta.setDate(hoje.getDate() + diff)
  return paraISO(quinta)
}

const DIAS_SEMANA_ABREV = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Uma cor pastel distinta por turno real (não os 3 baldes genéricos
// manhã/tarde/noite) — H3 leva ainda um ícone de cadeado, por ser o
// turno restrito a Caique/Bruno/Kilson.
const ESTILO_TURNO: Record<TurnoTipo, string> = {
  H1: 'bg-sky-50 text-sky-700 border-sky-100',
  H2: 'bg-amber-50 text-amber-700 border-amber-100',
  H3: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  H4: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

const ESTILO_LEGENDA: Record<TurnoTipo, string> = {
  H1: 'bg-sky-100 border-sky-200',
  H2: 'bg-amber-100 border-amber-200',
  H3: 'bg-indigo-100 border-indigo-200',
  H4: 'bg-emerald-100 border-emerald-200',
}

const OPCOES_TURNO: { valor: TurnoTipo; rotulo: string }[] = [
  { valor: 'H1', rotulo: 'H1 — 07h00 às 16h00' },
  { valor: 'H2', rotulo: 'H2 — 14h00 às 23h00' },
  { valor: 'H3', rotulo: 'H3 — 22h00 às 07h00' },
  { valor: 'H4', rotulo: 'H4 — 09h00 às 18h00' },
]

function linhaDoDia(
  diaISO: string,
  usuarioId: string,
  escalas: EscalaSemanal[]
): EscalaSemanal | undefined {
  return escalas.find((e) => {
    if (e.usuario_id !== usuarioId) return false
    const fimJanela = new Date(e.semana_ref)
    fimJanela.setDate(fimJanela.getDate() + 6)
    return e.semana_ref <= diaISO && diaISO <= paraISO(fimJanela)
  })
}

function valorDoDia(
  diaISO: string,
  usuarioId: string,
  escalas: EscalaSemanal[],
  ferias: Ferias[]
): TurnoTipo | 'F' | null {
  const temFerias = ferias.some(
    (f) => f.usuario_id === usuarioId && f.data_inicio <= diaISO && f.data_fim >= diaISO
  )
  if (temFerias) return 'F'

  const turno = linhaDoDia(diaISO, usuarioId, escalas)?.turno ?? null
  // Ao fim de semana só o H3 está escalado — os restantes turnos (H1/H2/H4)
  // não trabalham, a célula fica vazia para sinalizar visualmente o dia.
  if (turno !== null && turno !== 'H3' && ehFimDeSemana(diaISO)) return null
  return turno
}

/** Nome de quem cobre a ausência de `usuarioId` no dia indicado, se a
 * substituição já tiver sido escolhida (ver migração 0009). */
function substitutoDoDia(
  diaISO: string,
  usuarioId: string,
  ferias: Ferias[],
  usuarios: Usuario[]
): string | undefined {
  const f = ferias.find(
    (f) => f.usuario_id === usuarioId && f.data_inicio <= diaISO && f.data_fim >= diaISO && f.substituto_id
  )
  if (!f?.substituto_id) return undefined
  return usuarios.find((u) => u.id === f.substituto_id)?.nome
}

function feriadoDoDia(diaISO: string, feriados: FeriadoPortugal[]): FeriadoPortugal | undefined {
  return feriados.find((f) => f.data === diaISO)
}

/** Quem faz o plantão nesse feriado, se já tiver sido escolhido —
 * só conta linhas voluntario=true (ver view feriados_sem_plantao). */
function plantonistaDoDia(diaISO: string, plantoes: PlantaoVoluntario[], usuarios: Usuario[]): Usuario | undefined {
  const p = plantoes.find((pl) => pl.data_feriado === diaISO && pl.voluntario)
  if (!p) return undefined
  return usuarios.find((u) => u.id === p.usuario_id)
}

export function EscalaPage() {
  const [mesRef, setMesRef] = useState<Date>(() => new Date())
  const [mostrarFimDeSemana, setMostrarFimDeSemana] = useState(true)
  const { usuarios, aCarregar: aCarregarUsuarios } = useUsuarios()
  const { escalas, ferias, feriados, plantoes, aCarregar: aCarregarEscala } = useEscalaMes(mesRef)
  const { ehGerenteOuDelegado } = useAuth()

  const dias = useMemo(() => {
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth()
    const totalDias = new Date(ano, mes + 1, 0).getDate()
    return Array.from({ length: totalDias }, (_, i) => {
      const d = new Date(ano, mes, i + 1)
      const iso = paraISO(d)
      return { numero: i + 1, iso, fimDeSemana: ehFimDeSemana(iso) }
    })
  }, [mesRef])

  const diasVisiveis = useMemo(
    () => (mostrarFimDeSemana ? dias : dias.filter((d) => !d.fimDeSemana)),
    [dias, mostrarFimDeSemana]
  )

  function mudarMes(delta: number) {
    setMesRef((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1))
  }

  const pessoasAtivas = usuarios.filter((u) => u.ativo)
  const aCarregar = aCarregarUsuarios || aCarregarEscala

  const [celulaEmEdicao, setCelulaEmEdicao] = useState<{ usuarioId: string; diaISO: string } | null>(null)
  const pessoaEmEdicao = celulaEmEdicao ? pessoasAtivas.find((p) => p.id === celulaEmEdicao.usuarioId) : undefined
  const linhaEmEdicao = celulaEmEdicao
    ? linhaDoDia(celulaEmEdicao.diaISO, celulaEmEdicao.usuarioId, escalas)
    : undefined

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <CardTitle className="min-w-40 text-center">{formatarMesAnoPT(mesRef)}</CardTitle>
            <Button variant="ghost" size="icon" aria-label="Mês seguinte" onClick={() => mudarMes(1)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="ml-1 text-zinc-500" onClick={() => setMesRef(new Date())}>
              Hoje
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={!mostrarFimDeSemana}
              onClick={() => setMostrarFimDeSemana((v) => !v)}
            >
              <SlidersHorizontal className="size-3.5" />
              {mostrarFimDeSemana ? 'Ocultar fins de semana' : 'Mostrar fins de semana'}
            </Button>
            {ehGerenteOuDelegado && <PainelSugestao usuarios={pessoasAtivas} />}
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {aCarregar ? (
            <p className="px-4 text-sm text-zinc-500">A carregar…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-40 border-b border-zinc-100 bg-white px-4 py-2 text-left text-xs font-medium tracking-wider text-zinc-400 uppercase">
                      Nome
                    </th>
                    {diasVisiveis.map((d) => {
                      const feriado = feriadoDoDia(d.iso, feriados)
                      return (
                        <th
                          key={d.iso}
                          className={cn(
                            'min-w-12 border-b border-l border-zinc-100 px-1 py-2 text-center',
                            feriado ? 'bg-rose-50/70' : d.fimDeSemana && 'bg-zinc-50/70'
                          )}
                          title={feriado?.nome}
                        >
                          <div className="text-[0.6rem] font-medium tracking-wider text-zinc-400 uppercase">
                            {DIAS_SEMANA_ABREV[isoWeekday(new Date(d.iso + 'T00:00:00')) - 1]}
                          </div>
                          <div className="text-sm font-semibold text-zinc-800">{d.numero}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pessoasAtivas.map((p) => (
                    <tr key={p.id} className="group">
                      <td className="sticky left-0 z-10 border-b border-zinc-100 bg-white px-4 py-2 font-medium whitespace-nowrap text-zinc-900 group-hover:bg-zinc-50">
                        <span className="inline-flex items-center gap-1.5">
                          {p.nome}
                          {p.perfil === 'OPERADOR_H3' && (
                            <Badge
                              variant="outline"
                              className="gap-0.5 border-indigo-100 bg-indigo-50 px-1.5 text-[0.65rem] text-indigo-700"
                            >
                              <Lock className="size-2.5" />
                              H3
                            </Badge>
                          )}
                        </span>
                      </td>
                      {diasVisiveis.map((d) => {
                        const feriado = feriadoDoDia(d.iso, feriados)
                        const valor = valorDoDia(d.iso, p.id, escalas, ferias)
                        const linha = linhaDoDia(d.iso, p.id, escalas)
                        // Num feriado só o H3 tem turno real para editar — os
                        // restantes mostram "Feriado" e deixam de ser clicáveis.
                        const editavel = ehGerenteOuDelegado && linha !== undefined && (!feriado || valor === 'H3')
                        const substituto = valor === 'F' ? substitutoDoDia(d.iso, p.id, ferias, usuarios) : undefined
                        const plantonista = feriado ? plantonistaDoDia(d.iso, plantoes, usuarios) : undefined
                        return (
                          <td
                            key={d.iso}
                            className={cn(
                              'border-b border-l border-zinc-100 px-1 py-1 text-center align-middle',
                              feriado ? 'bg-rose-50/40' : d.fimDeSemana && 'bg-zinc-50/70',
                              editavel && 'cursor-pointer hover:bg-zinc-100'
                            )}
                            onClick={editavel ? () => setCelulaEmEdicao({ usuarioId: p.id, diaISO: d.iso }) : undefined}
                            title={editavel ? 'Editar turno desta semana' : feriado?.nome}
                          >
                            <CelulaTurno
                              valor={valor}
                              fimDeSemana={d.fimDeSemana}
                              substitutoNome={substituto}
                              feriado={feriado}
                              ehPlantonista={plantonista?.id === p.id}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
          <Legenda className={ESTILO_LEGENDA.H1} texto="H1" />
          <Legenda className={ESTILO_LEGENDA.H2} texto="H2" />
          <Legenda className={ESTILO_LEGENDA.H3} texto="H3 (restrito a Caique/Bruno/Kilson)" />
          <Legenda className={ESTILO_LEGENDA.H4} texto="H4" />
          <Legenda className="border-dashed border-zinc-300 bg-zinc-50" texto="Folga / Férias" />
          <Legenda className="border-dashed border-violet-300 bg-violet-50" texto="Substituição confirmada" />
          <Legenda className="border-dashed border-rose-300 bg-rose-50" texto="Feriado" />
          <Legenda className="border-rose-200 bg-rose-50" texto="Plantão" />
          {ehGerenteOuDelegado && <span className="text-zinc-400">Clica numa célula para editar a semana</span>}
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-5">
        <PainelFerias usuarios={pessoasAtivas} />
        <PainelTrocas usuarios={pessoasAtivas} />
        {ehGerenteOuDelegado && <PainelDelegacao usuarios={pessoasAtivas} />}
      </div>

      {pessoaEmEdicao && linhaEmEdicao && (
        <ModalEdicaoTurno
          pessoa={pessoaEmEdicao}
          linha={linhaEmEdicao}
          onFechar={() => setCelulaEmEdicao(null)}
        />
      )}
    </div>
  )
}

function CelulaTurno({
  valor,
  fimDeSemana,
  substitutoNome,
  feriado,
  ehPlantonista,
}: {
  valor: TurnoTipo | 'F' | null
  fimDeSemana: boolean
  substitutoNome?: string
  feriado?: FeriadoPortugal
  ehPlantonista?: boolean
}) {
  if (valor === 'F') {
    if (substitutoNome) {
      return (
        <span
          className="inline-flex items-center justify-center gap-0.5 rounded-md border border-dashed border-violet-200 bg-violet-50 px-1.5 py-1 text-[0.65rem] font-medium text-violet-600"
          title={`Férias — substituído por ${substitutoNome}`}
        >
          <ArrowRightLeft className="size-2.5" />
          {substitutoNome}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[0.65rem] font-medium text-zinc-400">
        Férias
      </span>
    )
  }
  // Feriado: ninguém trabalha o turno normal, só quem faz o plantão —
  // isto vence H1/H2/H4 mesmo que escala_semanal tenha algo marcado
  // nesse dia. O H3 é exceção: trabalha sempre, feriado ou não (fim de
  // semana sozinho a cobrir o dia inteiro; dia útil só até às 07h, com
  // um plantonista a render daí até ao fim da cadeia diária) — por
  // isso cai para o badge H3 normal em vez de "Feriado"/"Plantão".
  if (feriado && valor !== 'H3') {
    if (ehPlantonista) {
      return (
        <span
          className="inline-flex items-center justify-center gap-0.5 rounded-md border border-rose-100 bg-rose-50 px-1.5 py-1 text-[0.65rem] font-medium text-rose-700"
          title={feriado.nome}
        >
          <Sun className="size-2.5" />
          Plantão
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center justify-center rounded-md border border-dashed border-rose-200 bg-rose-50/60 px-1.5 py-1 text-[0.65rem] font-medium text-rose-400"
        title={feriado.nome}
      >
        Feriado
      </span>
    )
  }
  if (valor === null) {
    // Fim de semana sem H3 = folga deliberada (mostra o badge). Um dia
    // útil sem linha é falta de dados — fica em branco de propósito,
    // para continuar visível como anomalia em vez de ser mascarado
    // com um rótulo "Folga" enganador.
    if (!fimDeSemana) return null
    return (
      <span className="inline-flex items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[0.65rem] font-medium text-zinc-400">
        Folga
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-0.5 rounded-md border px-1.5 py-1 text-[0.65rem] font-medium',
        ESTILO_TURNO[valor]
      )}
    >
      {valor === 'H3' && <Lock className="size-2.5" />}
      {valor}
    </span>
  )
}

function Legenda({ className, texto }: { className: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-full border', className)} />
      {texto}
    </span>
  )
}

function ModalEdicaoTurno({
  pessoa,
  linha,
  onFechar,
}: {
  pessoa: Pick<Usuario, 'nome'>
  linha: EscalaSemanal
  onFechar: () => void
}) {
  // Capturados uma vez no mount (nunca re-sincronizados com `linha`,
  // que é recomputada a cada render a partir de `escalas` e pode mudar
  // sob os pés deste modal — a subscrição realtime é live desde a
  // migration 0007). turnoOriginal serve de base para deteção de
  // conflito no gravar(); usar linha.turno (live) aqui em vez disso
  // permitiria gravar um valor obsoleto por cima de uma alteração
  // concorrente sem qualquer aviso.
  const [turno, setTurno] = useState<TurnoTipo>(linha.turno)
  const [turnoOriginal] = useState<TurnoTipo>(linha.turno)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // linha.semana_ref é exatamente a janela [semana_ref, semana_ref+6]
  // que linhaDoDia() usou para encontrar esta linha — mostrar essa
  // mesma janela, sem nenhum offset adicional, garante que o dia
  // clicado está sempre dentro do intervalo apresentado.
  const inicioSemanaISO = linha.semana_ref
  const fimSemanaISO = paraISO(adicionarDias(new Date(linha.semana_ref + 'T00:00:00'), 6))

  async function gravar() {
    if (turno === turnoOriginal) {
      onFechar()
      return
    }
    setAGravar(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('escala_semanal')
        .update({ turno })
        .eq('id', linha.id)
        .eq('turno', turnoOriginal)
        .select()
      if (error) {
        setErro(error.message)
      } else if (!data || data.length === 0) {
        setErro('Este turno foi alterado por outra sessão entretanto. Fecha e reabre a célula para ver o valor atual.')
      } else {
        onFechar()
      }
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !aGravar) onFechar()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar turno</DialogTitle>
          <DialogDescription>
            {pessoa.nome} — semana de {formatarDataPT(inicioSemanaISO)} a {formatarDataPT(fimSemanaISO)}. A
            alteração aplica-se à semana inteira, não só ao dia selecionado.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700">Turno</span>
          <Select value={turno} onValueChange={(v) => setTurno(v as TurnoTipo)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_TURNO.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={aGravar}>
            Cancelar
          </Button>
          <Button onClick={gravar} disabled={aGravar}>
            {aGravar ? 'A gravar…' : 'Gravar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PainelSugestao({ usuarios }: { usuarios: Pick<Usuario, 'id' | 'nome'>[] }) {
  const [aberto, setAberto] = useState(false)
  const [semanaRef, setSemanaRef] = useState(proximaQuinta)
  const [sugestao, setSugestao] = useState<RespostaSugestao | null>(null)
  const [aCarregar, setACarregar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState(false)

  function nomePorId(id: string | null): string {
    if (!id) return '—'
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  async function calcular() {
    setACarregar(true)
    setErro(null)
    setSugestao(null)
    setAplicado(false)
    const { data, error } = await supabase.functions.invoke('sugerir-escala', {
      body: { semana_ref: semanaRef },
    })
    if (error) setErro(error.message)
    else setSugestao(data as RespostaSugestao)
    setACarregar(false)
  }

  async function aplicar() {
    if (!sugestao) return
    const linhas: { usuario_id: string; semana_ref: string; turno: string }[] = []
    if (sugestao.H3) linhas.push({ usuario_id: sugestao.H3.usuario_id, semana_ref: sugestao.semana_ref, turno: 'H3' })
    if (sugestao.H1) linhas.push({ usuario_id: sugestao.H1, semana_ref: sugestao.semana_ref, turno: 'H1' })
    if (sugestao.H2) linhas.push({ usuario_id: sugestao.H2, semana_ref: sugestao.semana_ref, turno: 'H2' })
    if (sugestao.H4) linhas.push({ usuario_id: sugestao.H4, semana_ref: sugestao.semana_ref, turno: 'H4' })
    const { error } = await supabase.from('escala_semanal').upsert(linhas, { onConflict: 'usuario_id,semana_ref' })
    if (!error) setAplicado(true)
  }

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        Sugerir automaticamente
      </Button>
    )
  }

  return (
    <div className="relative">
      <div className="absolute top-full right-0 z-20 mt-2 w-72 rounded-xl bg-white p-4 text-sm ring-1 ring-zinc-200 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <strong className="text-sm font-semibold text-zinc-900">Sugestão automática</strong>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Fechar"
            onClick={() => {
              setAberto(false)
              setSugestao(null)
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <label className="mb-3 flex flex-col gap-1 text-xs text-zinc-500">
          Semana (Quinta-feira de referência)
          <Input
            type="date"
            value={semanaRef}
            onChange={(e) => {
              setSemanaRef(e.target.value)
              setSugestao(null)
            }}
          />
        </label>

        <Button className="w-full" size="sm" onClick={calcular} disabled={aCarregar}>
          {aCarregar ? 'A calcular…' : 'Calcular sugestão'}
        </Button>

        {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

        {sugestao && (
          <div className="mt-3 text-sm">
            <table className="w-full border-collapse">
              <tbody>
                {(['H1', 'H2', 'H4'] as const).map((t) => (
                  <tr key={t}>
                    <td className="w-10 py-1">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                          ESTILO_TURNO[t]
                        )}
                      >
                        {t}
                      </span>
                    </td>
                    <td className="py-1 text-zinc-700">{nomePorId(sugestao[t])}</td>
                  </tr>
                ))}
                <tr>
                  <td className="w-10 py-1">
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                        ESTILO_TURNO.H3
                      )}
                    >
                      <Lock className="size-2.5" />
                      H3
                    </span>
                  </td>
                  <td className="py-1 text-zinc-700">
                    {sugestao.H3 ? (
                      <span>
                        {sugestao.H3.nome}
                        {sugestao.H3.precisa_override && (
                          <span className="ml-1.5 text-xs text-amber-600">⚠ override</span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {aplicado ? (
              <p className="mt-2 text-xs text-emerald-600">Aplicado à escala.</p>
            ) : (
              <Button className="mt-3 w-full" size="sm" onClick={aplicar}>
                Aplicar à escala
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
