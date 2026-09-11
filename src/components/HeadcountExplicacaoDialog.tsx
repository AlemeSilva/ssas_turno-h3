import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { decomporCalculoMes, mediasJanela, type ClassificacaoHeadcount, type ParcelaCarga } from '@/lib/headcount'
import { formatarMesAnoPT } from '@/lib/datas'
import type { HeadcountMensal, HeadcountParametros } from '@/types/database'

// Duplicado deliberadamente de HeadcountPage.tsx (mesmo padrão já usado em
// HeadcountCenariosDialog) — a página importa este componente; importar de
// volta criaria um ciclo de módulos.
function formatarMesReferencia(mesISO: string): string {
  const [ano, mes] = mesISO.split('-').map(Number)
  return formatarMesAnoPT(new Date(ano, mes - 1, 1))
}

const ROTULO_CLASSIFICACAO_ESCURO = {
  ACEITAVEL: { texto: 'Aceitável', cor: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400' },
  SOBRE_DIMENSIONADO: { texto: 'Sobre-dimensionado', cor: 'border-amber-400/30 bg-amber-400/10 text-amber-400' },
  SUB_DIMENSIONADO: { texto: 'Sub-dimensionado', cor: 'border-red-400/30 bg-red-400/10 text-red-400' },
} as const

const PARCELAS_CARGA_INFO: Record<ParcelaCarga['chave'], { rotulo: string; formula: (mes: HeadcountMensal, diasCorridos: number, semanas: number) => string }> = {
  pedidos: {
    rotulo: 'Pedidos',
    formula: (mes) => `${mes.volume_pedidos ?? 0} pedidos × ${mes.tempo_medio_pedido_minutos ?? 0} min ÷ 60`,
  },
  batch: {
    rotulo: 'Batch',
    formula: (mes, dias) => `${mes.batch_horas_dia ?? 0} h/dia × ${dias} dias`,
  },
  olho_vivo: {
    rotulo: 'Olho Vivo',
    formula: (mes, dias) => `${mes.olho_vivo_minutos_dia ?? 0} min/dia ÷ 60 × ${dias} dias`,
  },
  prep_fim_semana: {
    rotulo: 'Prep. fim de semana',
    formula: (mes, _dias, semanas) => `${mes.prep_fim_semana_horas_semana ?? 0} h/semana × ${semanas.toFixed(2)} semanas`,
  },
  imparidade_calendario: {
    rotulo: 'Imparidade — calendário',
    formula: (mes) => `fixo, ${mes.imparidade_calendario_horas ?? 0} h/mês`,
  },
  imparidade_execucao: {
    rotulo: 'Imparidade — execução',
    formula: (mes, _dias, semanas) => `${mes.imparidade_execucao_horas_semana ?? 0} h/semana × ${semanas.toFixed(2)} semanas`,
  },
  imparidade_reportes: {
    rotulo: 'Imparidade — reportes',
    formula: (mes) => `${mes.imparidade_reportes_minutos_dia ?? 0} min/dia ÷ 60 × ${mes.imparidade_reportes_dias_mes ?? 0} dias/mês`,
  },
  recuperacao_cadeia: {
    rotulo: 'Recuperação de cadeia',
    formula: (mes) => `${mes.dias_recuperacao_cadeia} dias × 24h`,
  },
}

function fraseVeredicto(classificacao: ClassificacaoHeadcount, real: number, idealExato: number, banda: number): string {
  const diferenca = Math.abs(real - idealExato).toFixed(1)
  if (classificacao === 'ACEITAVEL') {
    return `A diferença entre a equipa real (${real}) e o Ideal (${idealExato.toFixed(1)}) é ${diferenca} pessoas — dentro da tolerância de ±${banda}, por isso o veredito é Aceitável.`
  }
  if (classificacao === 'SOBRE_DIMENSIONADO') {
    return `A equipa real (${real}) está ${diferenca} pessoas acima do Ideal (${idealExato.toFixed(1)}) — fora da tolerância de ±${banda}, por isso o veredito é Sobre-dimensionado.`
  }
  return `A equipa real (${real}) está ${diferenca} pessoas abaixo do Ideal (${idealExato.toFixed(1)}) — fora da tolerância de ±${banda}, por isso o veredito é Sub-dimensionado.`
}

function SeccaoTitulo({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{children}</h3>
}

function LinhaParcela({ rotulo, formula, valor, cor }: { rotulo: string; formula: string; valor: number; cor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-zinc-800/60 py-1.5 last:border-0">
      <span className="w-48 shrink-0 text-sm text-zinc-200">{rotulo}</span>
      <span className="flex-1 text-xs text-zinc-500">{formula}</span>
      <span className={cn('shrink-0 text-right text-sm font-semibold tabular-nums', cor)}>{valor.toFixed(1)}h</span>
    </div>
  )
}

function NotaResiduo({ diferenca, unidade = 'h' }: { diferenca: number; unidade?: string }) {
  if (diferenca <= 0.05) return null
  return (
    <p className="mt-1 text-xs text-zinc-500">
      Diferença de arredondamento entre o detalhe calculado aqui e o valor oficial gravado no fecho do mês: {diferenca.toFixed(2)}
      {unidade}. O valor oficial é sempre o que conta para o Ideal.
    </p>
  )
}

export function HeadcountExplicacaoDialog({
  mesesJanela,
  parametros,
  headcountRealHoje,
  idealPorHoras,
  idealExato,
  classificacao,
  aoFechar,
}: {
  mesesJanela: HeadcountMensal[]
  parametros: HeadcountParametros
  headcountRealHoje: number
  idealPorHoras: number
  idealExato: number
  classificacao: ClassificacaoHeadcount
  aoFechar: () => void
}) {
  if (mesesJanela.length === 0) return null
  const medias = mediasJanela(mesesJanela)
  if (medias === null) return null

  const mesRecente = mesesJanela[0]
  const decomposicao = decomporCalculoMes(mesRecente)
  const piso = parametros.minimo_turnos_criticos / parametros.garantia_contratual_fracao
  const pisoVenceu = piso > idealPorHoras
  const diferencaCarga = Math.abs(decomposicao.somaParcelasCarga - decomposicao.cargaRegistada)
  const diferencaCapacidade = Math.abs(decomposicao.capacidadeCalculada - decomposicao.capacidadeRegistada)

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) aoFechar()
      }}
    >
      <DialogContent showCloseButton={false} className="max-h-[85vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-50 sm:max-w-[50rem]">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">Como se chega ao veredito</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400">Racional completo do cálculo de Headcount Ideal, com os números reais de hoje.</p>

        <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn('inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-semibold', ROTULO_CLASSIFICACAO_ESCURO[classificacao].cor)}>
              {ROTULO_CLASSIFICACAO_ESCURO[classificacao].texto}
            </span>
            <span className="text-sm text-zinc-300">
              Equipa real: <b className="text-zinc-50">{headcountRealHoje}</b> · Ideal: <b className="text-zinc-50">{idealExato.toFixed(1)}</b> pessoas · Tolerância: ±
              {parametros.banda_tolerancia_pessoas}
            </span>
          </div>
          <p className="text-sm text-zinc-400">{fraseVeredicto(classificacao, headcountRealHoje, idealExato, parametros.banda_tolerancia_pessoas)}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <SeccaoTitulo>Como se chega ao Ideal</SeccaoTitulo>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-zinc-800 px-2 py-1.5 text-left text-xs font-medium text-zinc-500">Mês</th>
                  <th className="border-b border-zinc-800 px-2 py-1.5 text-right text-xs font-medium text-zinc-500">Carga (h)</th>
                  <th className="border-b border-zinc-800 px-2 py-1.5 text-right text-xs font-medium text-zinc-500">Capacidade/pessoa (h)</th>
                </tr>
              </thead>
              <tbody>
                {mesesJanela.map((m) => (
                  <tr key={m.id}>
                    <td className="border-b border-zinc-800/60 px-2 py-1.5 text-zinc-300">{formatarMesReferencia(m.mes_referencia)}</td>
                    <td className="border-b border-zinc-800/60 px-2 py-1.5 text-right tabular-nums text-amber-400">{(m.carga_horas ?? 0).toFixed(1)}</td>
                    <td className="border-b border-zinc-800/60 px-2 py-1.5 text-right tabular-nums text-sky-400">{(m.capacidade_plena_horas_pessoa ?? 0).toFixed(1)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-2 py-1.5 font-semibold text-zinc-100">Média</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-400">{medias.cargaMedia.toFixed(1)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-sky-400">{medias.capacidadeMedia.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1 border-t border-zinc-800 pt-3 text-sm text-zinc-300">
            <p>
              Ideal por horas = Carga média ÷ Capacidade média = {medias.cargaMedia.toFixed(1)} ÷ {medias.capacidadeMedia.toFixed(1)} = <b className="text-zinc-50">{idealPorHoras.toFixed(2)}</b> pessoas
            </p>
            <p>
              Piso estrutural = Mínimo turnos críticos ÷ Garantia contratual = {parametros.minimo_turnos_criticos} ÷ {parametros.garantia_contratual_fracao} =
              {' '}
              <b className="text-zinc-50">{piso.toFixed(2)}</b> pessoas
            </p>
            <p>
              Ideal exato = maior dos dois = <b className="text-zinc-50">{idealExato.toFixed(1)}</b> pessoas — {pisoVenceu ? 'o piso estrutural venceu' : 'o cálculo por horas venceu'}.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <SeccaoTitulo>Como se chega à Carga de {formatarMesReferencia(mesRecente.mes_referencia)}</SeccaoTitulo>
          <div className="flex flex-col">
            {decomposicao.parcelasCarga.map((p) => (
              <LinhaParcela
                key={p.chave}
                rotulo={PARCELAS_CARGA_INFO[p.chave].rotulo}
                formula={PARCELAS_CARGA_INFO[p.chave].formula(mesRecente, decomposicao.diasCorridos, decomposicao.semanas)}
                valor={p.valor}
                cor="text-amber-400"
              />
            ))}
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-zinc-800 pt-2 text-sm">
            <span className="text-zinc-300">Soma das parcelas</span>
            <span className="font-semibold tabular-nums text-amber-400">{decomposicao.somaParcelasCarga.toFixed(1)}h</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
            <span className="text-zinc-300">Carga oficial registada</span>
            <span className="font-semibold tabular-nums text-zinc-50">{decomposicao.cargaRegistada.toFixed(1)}h</span>
          </div>
          <NotaResiduo diferenca={diferencaCarga} />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <SeccaoTitulo>Como se chega à Capacidade plena por pessoa de {formatarMesReferencia(mesRecente.mes_referencia)}</SeccaoTitulo>
          <LinhaParcela
            rotulo="Capacidade plena/pessoa"
            formula={`${decomposicao.diasUteis} dias úteis (sem fins de semana/feriados) × ${mesRecente.capacidade_base_horas ?? 0} h/dia × ${mesRecente.taxa_eficiencia ?? 0} eficiência × ${mesRecente.taxa_cobertura_ferias ?? 0} cobertura de férias`}
            valor={decomposicao.capacidadeCalculada}
            cor="text-sky-400"
          />
          <p className="text-xs text-zinc-500">
            {decomposicao.diasCorridos} dias corridos no mês, dos quais {decomposicao.diasUteis} são dias úteis — ao fim de semana só o H3 trabalha, e feriados a meio da semana só o H3 mais o
            plantonista.
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
            <span className="text-zinc-300">Capacidade oficial registada</span>
            <span className="font-semibold tabular-nums text-zinc-50">{decomposicao.capacidadeRegistada.toFixed(1)}h</span>
          </div>
          <NotaResiduo diferenca={diferencaCapacidade} />
        </div>

        <div className="flex justify-end border-t border-zinc-800 pt-4">
          <Button variant="outline" onClick={aoFechar} className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
