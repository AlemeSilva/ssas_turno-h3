import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useHeadcountParametros } from '@/data/useHeadcountParametros'
import { useHeadcountMensal } from '@/data/useHeadcountMensal'
import { useUsuarios, usuariosH3Ativos } from '@/data/useUsuarios'
import {
  avaliarRiscoEscalaH3,
  calcularEstadoHeadcountAtual,
  calcularPercentagemCapacidadePresente,
  CAMPOS_PARAMETROS,
} from '@/lib/headcount'
import { agora, formatarMesAnoPT } from '@/lib/datas'
import { cn } from '@/lib/utils'
import type { HeadcountMensal, HeadcountParametros } from '@/types/database'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HeadcountCenariosDialog } from '@/components/HeadcountCenariosDialog'
import { HeadcountExplicacaoDialog } from '@/components/HeadcountExplicacaoDialog'
import { construirDocumentoRelatorioHeadcount, nomeFicheiroRelatorioHeadcount } from '@/lib/relatorio-headcount'
import { descarregarRelatorioHeadcountPdf } from '@/lib/relatorio-headcount-pdf'

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
  const [dialogCenariosAberto, setDialogCenariosAberto] = useState(false)
  const [dialogExplicacaoAberto, setDialogExplicacaoAberto] = useState(false)
  const [aGerarRelatorio, setAGerarRelatorio] = useState(false)
  const [erroRelatorio, setErroRelatorio] = useState<string | null>(null)

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
  const operadoresNaoH3Hoje = headcountRealHoje - operadorH3AtivoHoje
  const riscoH3 = avaliarRiscoEscalaH3(operadorH3AtivoHoje)

  const mesesFechados = meses.filter((m) => m.fechado)
  const mesesPendentes = meses.filter((m) => !m.fechado)
  const janela = parametros?.janela_tendencia_meses ?? 3
  const mesesJanela = mesesFechados.slice(0, janela)
  // Mesma função usada pelo relatório PDF — nunca duas implementações da
  // mesma sequência de cálculo (achado de peer-review).
  const estado = parametros ? calcularEstadoHeadcountAtual(mesesJanela, headcountRealHoje, parametros) : null
  const idealPorHoras = estado?.idealPorHoras ?? null
  const idealExato = estado?.idealExato ?? null
  const classificacao = estado?.classificacao ?? null

  const ultimoFechado = mesesFechados[0]
  const pctPresente = ultimoFechado ? calcularPercentagemCapacidadePresente(ultimoFechado) : null

  async function gerarRelatorio() {
    if (!parametros) return
    setErroRelatorio(null)
    setAGerarRelatorio(true)
    try {
      const agoraGeracao = new Date()
      const documento = construirDocumentoRelatorioHeadcount({
        mesesJanela,
        mesesFechados,
        parametros,
        headcountRealHoje,
        operadorH3AtivoHoje,
        geradoEm: agoraGeracao,
      })
      if (!documento) {
        setErroRelatorio('Não foi possível gerar o relatório com os dados atuais.')
        return
      }
      await descarregarRelatorioHeadcountPdf(documento, nomeFicheiroRelatorioHeadcount(agoraGeracao))
    } catch (erro) {
      setErroRelatorio(erro instanceof Error ? erro.message : 'Falha a gerar o PDF. Tenta novamente.')
    } finally {
      setAGerarRelatorio(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Headcount Ideal</CardTitle>
              <p className="mt-2 text-sm text-zinc-500">
                Média da carga dos últimos {janela} meses fechados, a dividir pela capacidade plena por pessoa — comparada com o
                headcount real de hoje.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="secondary" size="sm" disabled={idealExato === null} onClick={() => setDialogExplicacaoAberto(true)}>
                      Ver Cálculo
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {idealExato === null
                    ? 'Só disponível depois de haver um veredito de Headcount Ideal'
                    : 'Mostra o racional completo do cálculo, num ecrã de alto contraste'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="secondary" size="sm" disabled={idealExato === null} onClick={() => setDialogCenariosAberto(true)}>
                      Estudo de Cenários
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {idealExato === null
                    ? 'Só disponível depois de haver um veredito de Headcount Ideal'
                    : 'Explora hipóteses de headcount e de carga, sem gravar nada'}
                </TooltipContent>
              </Tooltip>
              {ehGerenteTitular && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="secondary" size="sm" disabled={idealExato === null || aGerarRelatorio} onClick={gerarRelatorio}>
                        {aGerarRelatorio ? 'A gerar…' : 'Relatório'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {idealExato === null
                      ? 'Só disponível depois de haver um veredito de Headcount Ideal'
                      : 'Descarrega um relatório em PDF, pronto a distribuir'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {erroRelatorio && <p className="text-sm text-red-600">{erroRelatorio}</p>}

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

      {dialogCenariosAberto && parametros && (
        <HeadcountCenariosDialog
          mesesJanela={mesesJanela}
          parametros={parametros}
          operadoresHoje={operadoresNaoH3Hoje}
          operadoresH3Hoje={operadorH3AtivoHoje}
          aoFechar={() => setDialogCenariosAberto(false)}
        />
      )}

      {dialogExplicacaoAberto && parametros && idealPorHoras !== null && idealExato !== null && classificacao !== null && (
        <HeadcountExplicacaoDialog
          mesesJanela={mesesJanela}
          parametros={parametros}
          headcountRealHoje={headcountRealHoje}
          idealPorHoras={idealPorHoras}
          idealExato={idealExato}
          classificacao={classificacao}
          aoFechar={() => setDialogExplicacaoAberto(false)}
        />
      )}
    </div>
  )
}
