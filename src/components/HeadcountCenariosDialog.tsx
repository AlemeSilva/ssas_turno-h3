import { useMemo, useReducer, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  calcularCenario,
  construirBaselinesTermos,
  estadoInicial,
  tocado,
  type AjustesCenario,
  type ResultadoCenario,
} from '@/lib/cenarios-headcount'
import type { HeadcountMensal, HeadcountParametros } from '@/types/database'

// Duplicado deliberadamente de HeadcountPage.tsx, não importado de lá —
// esta página já importa este componente; importar de volta criaria um
// ciclo de módulos. É só um mapeamento estático de 3 entradas.
const ROTULO_CLASSIFICACAO = {
  ACEITAVEL: { texto: 'Aceitável', cor: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  SOBRE_DIMENSIONADO: { texto: 'Sobre-dimensionado', cor: 'border-amber-100 bg-amber-50 text-amber-700' },
  SUB_DIMENSIONADO: { texto: 'Sub-dimensionado', cor: 'border-red-100 bg-red-50 text-red-700' },
} as const

type CampoSlider = Exclude<keyof AjustesCenario, 'operadores' | 'operadoresH3'>

interface SliderConfig {
  campo: CampoSlider
  rotulo: string
  unidade: string
  /** Só usado quando o baseline deste campo é 0 (slider absoluto). */
  maxAbsoluto: number
  /** Mesmo texto do balão de CAMPOS_PARAMETROS em HeadcountPage.tsx, para
   * os 7 campos que também são parâmetro estrutural — volumePedidos e
   * diasRecuperacaoCadeia não são parâmetro (são entrada mensal, em
   * headcount_mensal), por isso têm descrição própria aqui. */
  descricao: string
}

const SLIDERS_TAREFA: SliderConfig[] = [
  {
    campo: 'batchHorasDia',
    rotulo: 'Batch',
    unidade: 'h/dia',
    maxAbsoluto: 24,
    descricao:
      'Horas de processamento em lote (batch) que a equipa tem de garantir todos os dias do mês, independentemente do volume de pedidos. Entra na carga total multiplicada pelos dias corridos do mês.',
  },
  {
    campo: 'olhoVivoMinutosDia',
    rotulo: 'Olho Vivo',
    unidade: 'min/dia',
    maxAbsoluto: 120,
    descricao:
      'Minutos por dia dedicados à tarefa Olho Vivo — uma carga fixa diária da equipa. Entra na carga total (convertida para horas) multiplicada pelos dias corridos do mês.',
  },
  {
    campo: 'prepFimSemanaHorasSemana',
    rotulo: 'Prep. fim de semana',
    unidade: 'h/semana',
    maxAbsoluto: 20,
    descricao: 'Horas por semana dedicadas à preparação do Plano de Fim de Semana. Entra na carga total multiplicada pelo número de semanas do mês.',
  },
  {
    campo: 'imparidadeCalendarioHoras',
    rotulo: 'Imparidade — calendário',
    unidade: 'h/mês',
    maxAbsoluto: 40,
    descricao:
      'Horas fixas por mês dedicadas à parte de calendário do Cálculo de Imparidade — um valor único que se soma uma vez à carga total, sem escalar com dias ou semanas do mês.',
  },
  {
    campo: 'imparidadeExecucaoHorasSemana',
    rotulo: 'Imparidade — execução',
    unidade: 'h/semana',
    maxAbsoluto: 20,
    descricao: 'Horas por semana dedicadas à execução do Cálculo de Imparidade. Entra na carga total multiplicada pelo número de semanas do mês.',
  },
  {
    campo: 'imparidadeReportesMinutosDia',
    rotulo: 'Imparidade — reportes (minutos)',
    unidade: 'min/dia',
    maxAbsoluto: 120,
    descricao:
      'Minutos por dia dedicados aos reportes do Cálculo de Imparidade, nos dias em que há reportes. Combina-se com "Imparidade — reportes (dias)" para dar a carga total de reportes do mês.',
  },
  {
    campo: 'imparidadeReportesDiasMes',
    rotulo: 'Imparidade — reportes (dias)',
    unidade: 'dias/mês',
    maxAbsoluto: 31,
    descricao: 'Número de dias por mês em que há reportes do Cálculo de Imparidade. Multiplicado pelos minutos por dia de reportes dá a carga total de reportes do mês.',
  },
  {
    campo: 'volumePedidos',
    rotulo: 'Volume de pedidos',
    unidade: 'pedidos/mês',
    maxAbsoluto: 1000,
    descricao: 'Volume de pedidos do mês — multiplicado pelo Tempo médio por pedido (convertido para horas) dá a parcela da carga relativa a pedidos.',
  },
  {
    campo: 'diasRecuperacaoCadeia',
    rotulo: 'Recuperação de cadeia',
    unidade: 'dias/mês',
    maxAbsoluto: 15,
    descricao: 'Dias de recuperação de cadeia no mês — cada dia soma 24h à carga total (é sempre dia inteiro, nunca meio-turno).',
  },
]

// Sliders percentuais vão de -100% (termo eliminado) a +200% (triplica
// o valor histórico) — alargado a pedido do Gerente para cobrir tanto a
// automação total de uma tarefa como um pico de crise de volume.
const PERCENTAGEM_MIN = -100
const PERCENTAGEM_MAX = 200

function reducerCenario(estado: AjustesCenario, acao: { campo: keyof AjustesCenario; valor: number }): AjustesCenario {
  return { ...estado, [acao.campo]: acao.valor }
}

export function HeadcountCenariosDialog({
  mesesJanela,
  parametros,
  operadoresHoje,
  operadoresH3Hoje,
  aoFechar,
}: {
  mesesJanela: HeadcountMensal[]
  parametros: HeadcountParametros
  operadoresHoje: number
  operadoresH3Hoje: number
  aoFechar: () => void
}) {
  const headcountRealHoje = operadoresHoje + operadoresH3Hoje
  const baselines = useMemo(() => construirBaselinesTermos(mesesJanela), [mesesJanela])
  const [estado, dispatch] = useReducer(reducerCenario, { baselines, operadoresHoje, operadoresH3Hoje }, (seed) =>
    estadoInicial(seed.baselines, seed.operadoresHoje, seed.operadoresH3Hoje)
  )
  const [mostrarConfirmacaoFecho, setMostrarConfirmacaoFecho] = useState(false)

  const resultado = useMemo(
    () => calcularCenario(mesesJanela, estado, headcountRealHoje, parametros),
    [mesesJanela, estado, headcountRealHoje, parametros]
  )

  const dirty =
    SLIDERS_TAREFA.some((s) => tocado(estado[s.campo], baselines[s.campo])) ||
    tocado(estado.operadores, operadoresHoje) ||
    tocado(estado.operadoresH3, operadoresH3Hoje)

  function ajustar(campo: keyof AjustesCenario, valor: number) {
    dispatch({ campo, valor })
  }

  function tentarFechar() {
    if (dirty) {
      setMostrarConfirmacaoFecho(true)
    } else {
      aoFechar()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) tentarFechar()
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        {mostrarConfirmacaoFecho ? (
          <>
            <DialogHeader>
              <DialogTitle>Fechar sem guardar?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-zinc-500">
              Este estudo de cenários nunca é gravado — os ajustes que fizeste perdem-se ao fechar.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMostrarConfirmacaoFecho(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={aoFechar}>
                Fechar sem guardar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Estudo de Cenários</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-zinc-500">
              Explora hipóteses de headcount e de carga sem gravar nada — fecha esta janela a qualquer momento para descartar.
            </p>

            <ResumoCenario resultado={resultado} parametros={parametros} />

            <div className="grid gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-zinc-500">
                    Operadores
                    <Input
                      type="number"
                      min={0}
                      value={estado.operadores}
                      onChange={(e) => ajustar('operadores', Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-500">
                    Operadores H3
                    <Input
                      type="number"
                      min={0}
                      value={estado.operadoresH3}
                      onChange={(e) => ajustar('operadoresH3', Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    />
                  </label>
                </div>
                <GraficoCenario resultado={resultado} />
              </div>

              <div className="flex max-h-96 flex-col gap-3 overflow-y-auto sm:border-l sm:border-zinc-100 sm:pl-4">
                {SLIDERS_TAREFA.map((s) => (
                  <SliderTarefa key={s.campo} config={s} valor={estado[s.campo]} baseline={baselines[s.campo]} aoMudar={(v) => ajustar(s.campo, v)} />
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SliderTarefa({
  config,
  valor,
  baseline,
  aoMudar,
}: {
  config: SliderConfig
  valor: number
  baseline: number
  aoMudar: (valor: number) => void
}) {
  // Regra geral (não uma exceção para recuperação de cadeia): qualquer
  // termo sem histórico (baseline 0) usa slider absoluto — um slider
  // percentual sobre uma base zero nunca sai de zero.
  const absoluto = baseline === 0

  if (absoluto) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            <span>
              {config.rotulo} ({config.unidade}) — sem histórico nesta janela
            </span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={config.maxAbsoluto}
                step={1}
                value={valor}
                onChange={(e) => aoMudar(Number(e.target.value))}
                className="w-full accent-zinc-900"
              />
              <span className="w-16 shrink-0 text-right text-sm font-medium text-zinc-700 tabular-nums">{valor.toFixed(0)}</span>
            </div>
          </label>
        </TooltipTrigger>
        <TooltipContent>{config.descricao}</TooltipContent>
      </Tooltip>
    )
  }

  const percentagem = ((valor - baseline) / baseline) * 100

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          <span>
            {config.rotulo} ({config.unidade}) — histórico: {baseline.toFixed(1)}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={PERCENTAGEM_MIN}
              max={PERCENTAGEM_MAX}
              step={1}
              value={percentagem}
              onChange={(e) => aoMudar(baseline * (1 + Number(e.target.value) / 100))}
              className="w-full accent-zinc-900"
            />
            <span className="w-28 shrink-0 text-right text-sm font-medium text-zinc-700 tabular-nums">
              {percentagem >= 0 ? '+' : ''}
              {percentagem.toFixed(0)}% ({valor.toFixed(1)})
            </span>
          </div>
        </label>
      </TooltipTrigger>
      <TooltipContent>{config.descricao}</TooltipContent>
    </Tooltip>
  )
}

function ResumoCenario({ resultado, parametros }: { resultado: ResultadoCenario; parametros: HeadcountParametros }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      {resultado.idealExato === null || resultado.classificacao === null ? (
        <p className="text-sm text-zinc-500">Sem baseline válido para simular (sem meses fechados, ou capacidade plena a zero).</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-semibold',
              ROTULO_CLASSIFICACAO[resultado.classificacao].cor
            )}
          >
            {ROTULO_CLASSIFICACAO[resultado.classificacao].texto}
          </span>
          <span className="text-sm text-zinc-600">
            Headcount simulado: <b>{resultado.headcountSimuladoTotal}</b> · Ideal: <b>{resultado.idealExato.toFixed(1)}</b> pessoas · Tolerância: ±
            {parametros.banda_tolerancia_pessoas}
          </span>
        </div>
      )}
      <span
        className={cn(
          'inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
          resultado.riscoH3 ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
        )}
      >
        {resultado.riscoH3
          ? 'Aviso: risco de escala H3 — não sobrepor férias entre H3, antecipar cross-training'
          : 'Operador H3 simulado acima do mínimo'}
      </span>
    </div>
  )
}

function GraficoCenario({ resultado }: { resultado: ResultadoCenario }) {
  const largura = 320
  const chartTop = 10
  const chartBottom = 170
  const chartAltura = chartBottom - chartTop
  // maxY só pode ser 0 se as três grandezas (carga, capacidade plena
  // simulada, capacidade real de hoje) fossem todas 0 — na prática
  // nunca acontece (há sempre alguma carga/equipa real), mas o chão
  // aqui evita uma divisão por zero se algum dia acontecer.
  const maxY = resultado.maxY || 1

  function alturaBarra(valor: number): number {
    return Math.max(0, (Math.max(0, valor) / maxY) * chartAltura)
  }

  const alturaCarga = alturaBarra(resultado.cargaHoras)
  const alturaCapacidade = alturaBarra(resultado.capacidadePlenaEquipaHoras)
  const yReferencia = chartBottom - alturaBarra(resultado.capacidadeRealHojeHoras)

  return (
    <svg viewBox={`0 0 ${largura} 200`} className="w-full text-zinc-400" role="img" aria-label="Carga simulada vs. capacidade plena simulada, com referência à capacidade real de hoje">
      <line x1={40} y1={chartBottom} x2={largura - 20} y2={chartBottom} stroke="currentColor" className="text-zinc-200" />
      <line x1={40} y1={yReferencia} x2={largura - 20} y2={yReferencia} stroke="currentColor" strokeDasharray="4 3" />
      <text x={largura - 20} y={yReferencia - 4} textAnchor="end" className="fill-zinc-400 text-[9px]">
        Capacidade real hoje
      </text>

      <Tooltip>
        <TooltipTrigger asChild>
          <rect x={80} y={chartBottom - alturaCarga} width={70} height={alturaCarga} className="fill-amber-400" />
        </TooltipTrigger>
        <TooltipContent>Carga — total de horas de trabalho que a equipa precisa de cobrir no mês (pedidos, batch, Olho Vivo, prep. de fim de semana, imparidade e recuperação de cadeia), somadas.</TooltipContent>
      </Tooltip>
      <text x={115} y={chartBottom + 14} textAnchor="middle" className="fill-zinc-500 text-[10px]">
        Carga
      </text>
      <text x={115} y={chartBottom - alturaCarga - 4} textAnchor="middle" className="fill-zinc-700 text-[10px] font-medium tabular-nums">
        {resultado.cargaHoras.toFixed(0)}h
      </text>

      <Tooltip>
        <TooltipTrigger asChild>
          <rect x={190} y={chartBottom - alturaCapacidade} width={70} height={alturaCapacidade} className="fill-emerald-400" />
        </TooltipTrigger>
        <TooltipContent>Capacidade plena — total de horas produtivas que a equipa simulada consegue oferecer no mês, já com eficiência e reserva de férias descontadas.</TooltipContent>
      </Tooltip>
      <text x={225} y={chartBottom + 14} textAnchor="middle" className="fill-zinc-500 text-[10px]">
        Capacidade plena
      </text>
      <text x={225} y={chartBottom - alturaCapacidade - 4} textAnchor="middle" className="fill-zinc-700 text-[10px] font-medium tabular-nums">
        {resultado.capacidadePlenaEquipaHoras.toFixed(0)}h
      </text>
    </svg>
  )
}
