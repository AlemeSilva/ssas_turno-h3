import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useHeadcountParametros } from '@/data/useHeadcountParametros'
import { useHeadcountMensal } from '@/data/useHeadcountMensal'
import { useUsuarios, usuariosH3Ativos } from '@/data/useUsuarios'
import {
  avaliarRiscoEscalaH3,
  calcularHeadcountIdeal,
  calcularPercentagemCapacidadePresente,
  classificarHeadcount,
} from '@/lib/headcount'
import { agora, formatarMesAnoPT } from '@/lib/datas'
import { cn } from '@/lib/utils'
import type { HeadcountMensal, HeadcountParametros } from '@/types/database'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function formatarMesReferencia(mesISO: string): string {
  const [ano, mes] = mesISO.split('-').map(Number)
  return formatarMesAnoPT(new Date(ano, mes - 1, 1))
}

/** mesISO já vem como 1º dia do mês (ex.: "2026-08-01") — o mês
 * terminou assim que estamos no 1º dia do mês seguinte ou depois. */
function mesJaTerminou(mesISO: string): boolean {
  const [ano, mes] = mesISO.split('-').map(Number)
  return agora() >= new Date(ano, mes, 1)
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="border-b border-zinc-100 px-2 py-1.5 text-left text-xs font-medium text-zinc-400">{children}</th>
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td className="border-b border-zinc-100 px-2 py-1.5">{children}</td>
}

const ROTULO_CLASSIFICACAO = {
  ACEITAVEL: { texto: 'Aceitável', cor: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
  SOBRE_DIMENSIONADO: { texto: 'Sobre-dimensionado', cor: 'border-amber-100 bg-amber-50 text-amber-700' },
  SUB_DIMENSIONADO: { texto: 'Sub-dimensionado', cor: 'border-red-100 bg-red-50 text-red-700' },
} as const

const CAMPOS_PARAMETROS: { chave: keyof HeadcountParametros; rotulo: string; descricao: string; passo?: string }[] = [
  {
    chave: 'capacidade_base_horas',
    rotulo: 'Capacidade-base (h/dia)',
    descricao:
      'Horas de trabalho nominais de uma pessoa por dia — o ponto de partida da capacidade plena, antes de qualquer desconto de eficiência ou de reserva de férias.',
  },
  {
    chave: 'taxa_eficiencia',
    rotulo: 'Taxa de eficiência (0-1)',
    passo: '0.01',
    descricao:
      'Fração do dia de trabalho presente que é efetivamente produtiva, descontando pausas, formação e pequenos atrasos do dia a dia. Aplica-se como multiplicador direto na capacidade plena por pessoa (ex.: 0,85 = 85% do dia é produtivo).',
  },
  {
    chave: 'taxa_cobertura_ferias',
    rotulo: 'Taxa de cobertura de férias (0-1)',
    passo: '0.01',
    descricao:
      'Fração da capacidade nominal que sobra depois de reservar estruturalmente para a rotação de férias da equipa ao longo do ano. Não é a ausência real de um mês específico (essa já está refletida na capacidade presente) — é uma margem fixa para que o Headcount Ideal já venha dimensionado para absorver férias sem entrar em rutura (ex.: 0,90 = reserva-se 10% da capacidade para cobertura de férias).',
  },
  {
    chave: 'batch_horas_dia',
    rotulo: 'Batch (h/dia)',
    descricao:
      'Horas de processamento em lote (batch) que a equipa tem de garantir todos os dias do mês, independentemente do volume de pedidos. Entra na carga total multiplicada pelos dias corridos do mês.',
  },
  {
    chave: 'olho_vivo_minutos_dia',
    rotulo: 'Olho Vivo (min/dia)',
    descricao:
      'Minutos por dia dedicados à tarefa Olho Vivo — uma carga fixa diária da equipa. Entra na carga total (convertida para horas) multiplicada pelos dias corridos do mês.',
  },
  {
    chave: 'prep_fim_semana_horas_semana',
    rotulo: 'Prep. fim de semana (h/semana)',
    descricao:
      'Horas por semana dedicadas à preparação do Plano de Fim de Semana. Entra na carga total multiplicada pelo número de semanas do mês.',
  },
  {
    chave: 'tempo_medio_pedido_minutos',
    rotulo: 'Tempo médio / pedido (min)',
    descricao:
      'Tempo médio, em minutos, para tratar um pedido. Multiplicado pelo volume de pedidos do mês (convertido para horas) dá a parcela da carga relativa a pedidos.',
  },
  {
    chave: 'imparidade_calendario_horas',
    rotulo: 'Imparidade — calendário (h/mês)',
    descricao:
      'Horas fixas por mês dedicadas à parte de calendário do Cálculo de Imparidade — um valor único que se soma uma vez à carga total, sem escalar com dias ou semanas do mês.',
  },
  {
    chave: 'imparidade_execucao_horas_semana',
    rotulo: 'Imparidade — execução (h/semana)',
    descricao:
      'Horas por semana dedicadas à execução do Cálculo de Imparidade. Entra na carga total multiplicada pelo número de semanas do mês.',
  },
  {
    chave: 'imparidade_reportes_minutos_dia',
    rotulo: 'Imparidade — reportes (min/dia)',
    descricao:
      'Minutos por dia dedicados aos reportes do Cálculo de Imparidade, nos dias em que há reportes. Combina-se com "Imparidade — reportes (dias/mês)" para dar a carga total de reportes do mês.',
  },
  {
    chave: 'imparidade_reportes_dias_mes',
    rotulo: 'Imparidade — reportes (dias/mês)',
    descricao:
      'Número de dias por mês em que há reportes do Cálculo de Imparidade. Multiplicado pelos minutos por dia de reportes dá a carga total de reportes do mês.',
  },
  {
    chave: 'banda_tolerancia_pessoas',
    rotulo: 'Banda de tolerância (pessoas)',
    descricao:
      'Margem de tolerância, em número de pessoas, à volta do Headcount Ideal. Dentro desta margem (ideal ± banda) a equipa é classificada como Aceitável; fora dela, Sobre-dimensionada ou Sub-dimensionada.',
  },
  {
    chave: 'janela_tendencia_meses',
    rotulo: 'Janela de tendência (meses)',
    descricao:
      'Número de meses fechados mais recentes usados para calcular a média móvel que dá o Headcount Ideal. Suaviza picos e vales pontuais de carga e de capacidade em vez de reagir a um único mês atípico.',
  },
]

function PainelParametros({
  parametros,
  ehGerenteTitular,
  aoGuardar,
}: {
  parametros: HeadcountParametros
  ehGerenteTitular: boolean
  aoGuardar: () => void
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS_PARAMETROS.map((c) => [c.chave, String(parametros[c.chave])]))
  )
  const [aGuardar, setAGuardar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function guardar() {
    setErro(null)
    setAGuardar(true)
    const payload = Object.fromEntries(CAMPOS_PARAMETROS.map((c) => [c.chave, Number(valores[c.chave])]))
    const { error } = await supabase.from('headcount_parametros').update(payload).eq('id', true)
    setAGuardar(false)
    if (error) {
      setErro(error.message)
    } else {
      aoGuardar()
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div>
          <CardTitle>Parâmetros</CardTitle>
          <p className="mt-2 text-sm text-zinc-500">
            {ehGerenteTitular ? 'Qualquer alteração fica registada em auditoria.' : 'Só o Gerente titular pode alterar — consulta apenas.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CAMPOS_PARAMETROS.map((c) => (
            <Tooltip key={c.chave}>
              <TooltipTrigger asChild>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  {c.rotulo}
                  <Input
                    type="number"
                    step={c.passo ?? '1'}
                    value={valores[c.chave]}
                    disabled={!ehGerenteTitular}
                    onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                  />
                </label>
              </TooltipTrigger>
              <TooltipContent>{c.descricao}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {ehGerenteTitular && (
          <div>
            <Button variant="secondary" onClick={guardar} disabled={aGuardar}>
              {aGuardar ? 'A guardar…' : 'Guardar parâmetros'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LinhaMesPendente({
  mes,
  ehGerenteTitular,
  aoGuardar,
}: {
  mes: HeadcountMensal
  ehGerenteTitular: boolean
  aoGuardar: () => void
}) {
  const [pedidos, setPedidos] = useState(mes.volume_pedidos !== null ? String(mes.volume_pedidos) : '')
  const [recuperacao, setRecuperacao] = useState(String(mes.dias_recuperacao_cadeia))
  const [aGuardar, setAGuardar] = useState(false)
  const [aFechar, setAFechar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mesTerminou = mesJaTerminou(mes.mes_referencia)

  async function guardar() {
    setErro(null)
    setAGuardar(true)
    const { data, error } = await supabase
      .from('headcount_mensal')
      .update({
        volume_pedidos: pedidos === '' ? null : Number(pedidos),
        dias_recuperacao_cadeia: Number(recuperacao) || 0,
      })
      .eq('id', mes.id)
      .eq('atualizado_em', mes.atualizado_em)
      .select()
    setAGuardar(false)
    if (error) {
      setErro(error.message)
    } else if (!data || data.length === 0) {
      setErro('Este mês foi alterado por outra pessoa entretanto — valores atualizados abaixo.')
    }
    aoGuardar()
  }

  async function fechar() {
    setErro(null)
    setAFechar(true)
    const { error } = await supabase.rpc('fechar_mes_headcount', { p_mes_referencia: mes.mes_referencia })
    setAFechar(false)
    if (error) {
      setErro(error.message)
    } else {
      aoGuardar()
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-zinc-100 py-3 last:border-0">
      <div className="w-32 text-sm font-medium">{formatarMesReferencia(mes.mes_referencia)}</div>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Volume de pedidos
        <Input type="number" min={0} value={pedidos} onChange={(e) => setPedidos(e.target.value)} className="w-28" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Dias de recuperação de cadeia
        <Input type="number" min={0} value={recuperacao} onChange={(e) => setRecuperacao(e.target.value)} className="w-28" />
      </label>
      <Button size="sm" variant="secondary" onClick={guardar} disabled={aGuardar}>
        {aGuardar ? 'A guardar…' : 'Guardar'}
      </Button>
      {ehGerenteTitular && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" onClick={fechar} disabled={aFechar || !mesTerminou || pedidos === ''}>
                {aFechar ? 'A fechar…' : 'Fechar Mês'}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {!mesTerminou
              ? 'Só é possível fechar depois de o mês terminar'
              : pedidos === ''
                ? 'Preenche o volume de pedidos primeiro'
                : 'Torna este mês definitivo — sem reabertura depois'}
          </TooltipContent>
        </Tooltip>
      )}
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
    </div>
  )
}

export function HeadcountPage() {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const { parametros, aCarregar: aCarregarParametros, recarregar: recarregarParametros } = useHeadcountParametros()
  const { meses, aCarregar: aCarregarMeses, recarregar: recarregarMeses } = useHeadcountMensal()
  const { usuarios, aCarregar: aCarregarUsuarios } = useUsuarios()

  const ehGerenteTitular = usuario?.perfil === 'GERENTE'

  useEffect(() => {
    if (!ehGerenteOuDelegado) return
    supabase.rpc('garantir_rascunho_headcount_mensal').then(() => recarregarMeses())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehGerenteOuDelegado])

  if (!ehGerenteOuDelegado) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">Esta área é reservada ao Gerente.</CardContent>
      </Card>
    )
  }

  if (aCarregarParametros || aCarregarMeses || aCarregarUsuarios) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">A carregar…</CardContent>
      </Card>
    )
  }

  const equipa = usuarios.filter((u) => u.ativo && (u.perfil === 'OPERADOR' || u.perfil === 'OPERADOR_H3'))
  const headcountRealHoje = equipa.length
  const operadorH3AtivoHoje = usuariosH3Ativos(usuarios).length
  const riscoH3 = avaliarRiscoEscalaH3(operadorH3AtivoHoje)

  const mesesFechados = meses.filter((m) => m.fechado)
  const mesesPendentes = meses.filter((m) => !m.fechado)
  const janela = parametros?.janela_tendencia_meses ?? 3
  const mesesJanela = mesesFechados.slice(0, janela)
  const idealExato = calcularHeadcountIdeal(mesesJanela)
  const classificacao =
    idealExato !== null && parametros ? classificarHeadcount(headcountRealHoje, idealExato, parametros.banda_tolerancia_pessoas) : null

  const ultimoFechado = mesesFechados[0]
  const pctPresente = ultimoFechado ? calcularPercentagemCapacidadePresente(ultimoFechado) : null

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div>
            <CardTitle>Headcount Ideal</CardTitle>
            <p className="mt-2 text-sm text-zinc-500">
              Média da carga dos últimos {janela} meses fechados, a dividir pela capacidade plena por pessoa — comparada com o
              headcount real de hoje.
            </p>
          </div>

          {idealExato === null || classificacao === null ? (
            <p className="text-sm text-zinc-500">Ainda sem nenhum mês fechado — fecha o primeiro mês para veres o veredito.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn('inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-semibold', ROTULO_CLASSIFICACAO[classificacao].cor)}
              >
                {ROTULO_CLASSIFICACAO[classificacao].texto}
              </span>
              <span className="text-sm text-zinc-600">
                Equipa real: <b>{headcountRealHoje}</b> · Ideal: <b>{idealExato.toFixed(1)}</b> pessoas · Tolerância: ±
                {parametros?.banda_tolerancia_pessoas}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                riscoH3 ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
              )}
            >
              {riscoH3 ? `Aviso: risco de escala H3 (${operadorH3AtivoHoje} de 3 mínimos)` : `Operador H3 ativo: ${operadorH3AtivoHoje}`}
            </span>
            {ultimoFechado && pctPresente !== null && (
              <span className="text-sm text-zinc-500">
                Capacidade presente em {formatarMesReferencia(ultimoFechado.mes_referencia)}: {pctPresente.toFixed(0)}% da plena
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {mesesPendentes.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <div>
              <CardTitle>Dados do mês</CardTitle>
              <p className="mt-2 text-sm text-zinc-500">
                É aqui que introduzes o volume de pedidos e, se houver, os dias de recuperação de cadeia de cada mês.{' '}
                {ehGerenteTitular
                  ? '"Fechar Mês" só fica disponível depois de o mês terminar.'
                  : 'Fechar o mês fica reservado ao Gerente titular.'}
              </p>
            </div>
            {mesesPendentes.map((m) => (
              <LinhaMesPendente key={`${m.id}-${m.atualizado_em}`} mes={m} ehGerenteTitular={ehGerenteTitular} aoGuardar={recarregarMeses} />
            ))}
          </CardContent>
        </Card>
      )}

      {parametros && <PainelParametros parametros={parametros} ehGerenteTitular={ehGerenteTitular} aoGuardar={recarregarParametros} />}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <CardTitle>Histórico</CardTitle>
          {mesesFechados.length === 0 ? (
            <p className="text-sm text-zinc-500">Ainda sem meses fechados.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Mês</Th>
                  <Th>Pedidos</Th>
                  <Th>Carga (h)</Th>
                  <Th>Headcount real</Th>
                  <Th>Operador H3</Th>
                </tr>
              </thead>
              <tbody>
                {mesesFechados.map((m) => (
                  <tr key={m.id}>
                    <Td>{formatarMesReferencia(m.mes_referencia)}</Td>
                    <Td>{m.volume_pedidos}</Td>
                    <Td>{m.carga_horas?.toFixed(0)}</Td>
                    <Td>{m.headcount_real_snapshot}</Td>
                    <Td>{m.operador_h3_ativo_snapshot}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
