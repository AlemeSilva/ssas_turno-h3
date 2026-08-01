import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useUsuarios } from '@/data/useUsuarios'
import { useResumoUsuario, LIMITE_FERIAS_ANUAL } from '@/data/useResumoUsuario'
import { useResumoGerente, type FeriadoSemPlantao, type PeriodoFeriasEquipe } from '@/data/useResumoGerente'
import { HORARIO_TURNO } from '@/lib/gerarRelatorioSemanal'
import { adicionarDias, agora, diasUteis, ehFimDeSemana, formatarDataPT, paraISO, proximaSextaISO } from '@/lib/datas'
import type { Ferias, TurnoTipo, Usuario } from '@/types/database'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Turno a mostrar para um dia específico, respeitando a convenção de
 * fim de semana (só o H3 trabalha aos sábados/domingos). */
function valorTurnoDoDia(turno: TurnoTipo | null, diaISO: string): { valor: string; detalhe?: string } {
  if (turno === null) return { valor: '—' }
  if (ehFimDeSemana(diaISO) && turno !== 'H3') return { valor: 'Fim de semana' }
  return { valor: turno, detalhe: HORARIO_TURNO[turno] }
}

interface LinhaEquipe {
  id: string
  nome: string
  dias: number
}

/** As férias do próprio Gerente são geridas fora desta app — só a
 * equipa entra nas listas do cockpit. Ordenado por dias (desc.), o
 * pedido é destacar quem tem mais pendente por aprovar primeiro. */
function listaEquipePorDias(mapa: Map<string, number>, usuarios: Usuario[]): LinhaEquipe[] {
  return usuarios
    .filter((u) => u.ativo && u.perfil !== 'GERENTE')
    .map((u) => ({ id: u.id, nome: u.nome, dias: mapa.get(u.id) ?? 0 }))
    .sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome))
}

function ListaEquipe({
  titulo,
  dados,
  destacarNaoZero,
  onClicarPessoa,
}: {
  titulo: string
  dados: LinhaEquipe[]
  destacarNaoZero?: boolean
  onClicarPessoa: (id: string, nome: string) => void
}) {
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="text-xs font-bold tracking-wide text-zinc-400 uppercase">{titulo}</div>
      <div className="flex flex-col gap-0.5">
        {dados.length === 0 ? (
          <p className="text-sm text-zinc-400">Sem equipa ativa.</p>
        ) : (
          dados.map((d) => (
            <button
              key={d.id}
              className="flex items-center justify-between rounded-md px-1 py-0.5 text-left text-sm hover:bg-zinc-50"
              onClick={() => onClicarPessoa(d.id, d.nome)}
            >
              <span className="text-zinc-700 underline decoration-zinc-200 decoration-dotted underline-offset-2">{d.nome}</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  d.dias === 0 ? 'text-zinc-300' : destacarNaoZero ? 'text-amber-600' : 'text-zinc-900'
                )}
              >
                {d.dias}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export function InicioPage() {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const { usuarios } = useUsuarios()
  const resumo = useResumoUsuario(usuario?.id)
  const gerente = useResumoGerente(ehGerenteOuDelegado)
  const [aConfirmar, setAConfirmar] = useState<number | null>(null)
  const [escolhendoPara, setEscolhendoPara] = useState<number | null>(null)
  const [erroSubstituto, setErroSubstituto] = useState<string | null>(null)
  const [aConfirmarPlantao, setAConfirmarPlantao] = useState<string | null>(null)
  const [escolhendoPlantaoPara, setEscolhendoPlantaoPara] = useState<string | null>(null)
  const [erroPlantao, setErroPlantao] = useState<string | null>(null)
  const [detalhePessoa, setDetalhePessoa] = useState<{
    nome: string
    status: 'APROVADA' | 'PENDENTE'
    periodos: PeriodoFeriasEquipe[]
  } | null>(null)

  const hoje = agora()
  const hojeISO = paraISO(hoje)
  const proximaSexta = proximaSextaISO(hoje)
  const proximaQuinta = paraISO(adicionarDias(new Date(proximaSexta + 'T00:00:00'), 6))

  const nomeDe = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? id

  const totalFerias = resumo.feriasAprovadasDias + resumo.feriasPendentesDias
  const corBarraFerias =
    totalFerias >= LIMITE_FERIAS_ANUAL ? 'bg-red-500' : totalFerias >= LIMITE_FERIAS_ANUAL * 0.75 ? 'bg-amber-500' : 'bg-emerald-500'

  const turnoHoje = valorTurnoDoDia(resumo.turnoAtual, hojeISO)
  const turnoProxima = valorTurnoDoDia(resumo.turnoProximaSemana, proximaSexta)

  // Ao fim de semana o H3 já cobre o dia inteiro sozinho, como num fim
  // de semana comum — não há plantão a confirmar, por isso a lista só
  // mostra feriados em dias úteis.
  const feriadosFuturos = gerente.feriadosSemPlantao.filter((f) => f.data >= hojeISO && !ehFimDeSemana(f.data))

  function abrirDetalhePessoa(id: string, nome: string, status: 'APROVADA' | 'PENDENTE') {
    const periodos = gerente.feriasEquipeAno
      .filter((f) => f.usuario_id === id && f.status === status)
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
    setDetalhePessoa({ nome, status, periodos })
  }

  async function escolherSubstituto(feriasId: number, substitutoId: string) {
    if (!usuario) return
    setAConfirmar(feriasId)
    setErroSubstituto(null)
    const { error } = await gerente.confirmarSubstituto(feriasId, substitutoId, usuario.id)
    setAConfirmar(null)
    if (error) setErroSubstituto(error)
    else setEscolhendoPara(null)
  }

  async function escolherPlantonista(dataFeriado: string, usuarioId: string) {
    setAConfirmarPlantao(dataFeriado)
    setErroPlantao(null)
    const { error } = await gerente.confirmarPlantonista(dataFeriado, usuarioId)
    setAConfirmarPlantao(null)
    if (error) setErroPlantao(error)
    else setEscolhendoPlantaoPara(null)
  }

  function LinhaFeriado({ f }: { f: FeriadoSemPlantao }) {
    const aEscolher = escolhendoPlantaoPara === f.data
    const candidatos = usuarios.filter((u) => u.ativo)

    return (
      <li className="flex flex-col gap-1.5 border-b border-zinc-100 py-2 last:border-b-0">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-700">
            {f.nome} · {formatarDataPT(f.data)}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setEscolhendoPlantaoPara(aEscolher ? null : f.data)
                  setErroPlantao(null)
                }}
              >
                Confirmar plantonista
              </Button>
            </TooltipTrigger>
            <TooltipContent>Abre a lista da equipa para escolheres quem fica de plantão neste feriado</TooltipContent>
          </Tooltip>
        </div>
        {aEscolher && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {candidatos.map((u) => (
              <Button
                key={u.id}
                size="xs"
                variant="ghost"
                onClick={() => escolherPlantonista(f.data, u.id)}
                disabled={aConfirmarPlantao === f.data}
              >
                {aConfirmarPlantao === f.data ? '…' : u.nome}
              </Button>
            ))}
          </div>
        )}
        {aEscolher && erroPlantao && <p className="pl-1 text-xs text-red-600">{erroPlantao}</p>}
      </li>
    )
  }

  function LinhaAusencia({ f }: { f: Ferias }) {
    const aEscolher = escolhendoPara === f.id
    const candidatos = usuarios.filter((u) => u.ativo && u.id !== f.usuario_id)

    return (
      <li className="flex flex-col gap-1.5 border-b border-zinc-100 py-2 last:border-b-0">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-700">
            {nomeDe(f.usuario_id)} · {formatarDataPT(f.data_inicio)} a {formatarDataPT(f.data_fim)}
          </span>
          {f.substituicao_confirmada && f.substituto_id ? (
            <span className="inline-flex items-center rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[0.65rem] font-medium whitespace-nowrap text-emerald-700">
              Substituto: {nomeDe(f.substituto_id)}
            </span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    setEscolhendoPara(aEscolher ? null : f.id)
                    setErroSubstituto(null)
                  }}
                >
                  Confirmar substituto
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abre a lista da equipa para escolheres quem cobre esta ausência — aparece já na Escala do Mês</TooltipContent>
            </Tooltip>
          )}
        </div>
        {aEscolher && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {candidatos.length === 0 ? (
              <span className="text-xs text-zinc-400">Sem candidatos disponíveis.</span>
            ) : (
              candidatos.map((u) => (
                <Button
                  key={u.id}
                  size="xs"
                  variant="ghost"
                  onClick={() => escolherSubstituto(f.id, u.id)}
                  disabled={aConfirmar === f.id}
                >
                  {aConfirmar === f.id ? '…' : u.nome}
                </Button>
              ))
            )}
          </div>
        )}
        {aEscolher && erroSubstituto && <p className="pl-1 text-xs text-red-600">{erroSubstituto}</p>}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold text-zinc-900">Bem-vindo, {usuario?.nome ?? '—'}</h1>

      <div className="grid grid-cols-3 gap-5">
        <Card>
          <CardContent className="pt-6">
            {ehGerenteOuDelegado ? (
              <ListaEquipe
                titulo="Férias aprovadas (equipa)"
                dados={listaEquipePorDias(gerente.feriasAprovadasPorPessoa, usuarios)}
                onClicarPessoa={(id, nome) => abrirDetalhePessoa(id, nome, 'APROVADA')}
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Férias</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold text-zinc-900">{totalFerias}</span>
                  <span className="text-base text-zinc-500">de {LIMITE_FERIAS_ANUAL} dias</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn('h-full rounded-full', corBarraFerias)}
                    style={{ width: `${Math.min(100, (totalFerias / LIMITE_FERIAS_ANUAL) * 100)}%` }}
                  />
                </div>
                <div className="text-sm text-zinc-500">
                  {resumo.feriasAprovadasDias} aprovados · {resumo.feriasPendentesDias} por aprovar
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {ehGerenteOuDelegado ? (
              <ListaEquipe
                titulo="Férias por aprovar (equipa)"
                dados={listaEquipePorDias(gerente.feriasPendentesPorPessoa, usuarios)}
                destacarNaoZero
                onClicarPessoa={(id, nome) => abrirDetalhePessoa(id, nome, 'PENDENTE')}
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Turno atual</div>
                <div className={cn('font-bold text-zinc-900', resumo.emFeriasHoje ? 'text-3xl' : 'text-4xl')}>
                  {resumo.emFeriasHoje ? 'Férias' : turnoHoje.valor}
                </div>
                {!resumo.emFeriasHoje && turnoHoje.detalhe && <div className="text-sm text-zinc-500">{turnoHoje.detalhe}</div>}
                <div className="text-xs text-zinc-400">{formatarDataPT(hojeISO)}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2.5 pt-6">
            <div className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Próxima semana</div>
            <div className="text-4xl font-bold text-zinc-900">{turnoProxima.valor}</div>
            {turnoProxima.detalhe && <div className="text-sm text-zinc-500">{turnoProxima.detalhe}</div>}
            <div className="text-xs text-zinc-400">
              {formatarDataPT(proximaSexta)} a {formatarDataPT(proximaQuinta)}
            </div>
          </CardContent>
        </Card>
      </div>

      {ehGerenteOuDelegado && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Visão do Gerente</h2>
          <div className="grid grid-cols-2 items-start gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Feriados sem plantão confirmado</CardTitle>
              </CardHeader>
              <CardContent>
                {feriadosFuturos.length === 0 ? (
                  <p className="text-sm text-zinc-400">Sem feriados pendentes este ano.</p>
                ) : (
                  <ul>
                    {feriadosFuturos.map((f) => (
                      <LinhaFeriado key={f.data} f={f} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ausências da equipa</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <div className="mb-1 text-xs font-bold tracking-wide text-zinc-400 uppercase">Hoje</div>
                  {gerente.ausenciasHoje.length === 0 ? (
                    <p className="text-sm text-zinc-400">Ninguém ausente hoje.</p>
                  ) : (
                    <ul>
                      {gerente.ausenciasHoje.map((f) => (
                        <LinhaAusencia key={f.id} f={f} />
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="mb-1 text-xs font-bold tracking-wide text-zinc-400 uppercase">
                    Próxima semana ({formatarDataPT(proximaSexta)} a {formatarDataPT(proximaQuinta)})
                  </div>
                  {gerente.ausenciasProximaSemana.length === 0 ? (
                    <p className="text-sm text-zinc-400">Ninguém ausente.</p>
                  ) : (
                    <ul>
                      {gerente.ausenciasProximaSemana.map((f) => (
                        <LinhaAusencia key={f.id} f={f} />
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {detalhePessoa && (
        <Dialog open onOpenChange={(aberto) => !aberto && setDetalhePessoa(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{detalhePessoa.nome}</DialogTitle>
              <DialogDescription>
                Férias {detalhePessoa.status === 'APROVADA' ? 'aprovadas' : 'por aprovar'} em {hoje.getFullYear()}
              </DialogDescription>
            </DialogHeader>
            {detalhePessoa.periodos.length === 0 ? (
              <p className="text-sm text-zinc-400">Sem períodos.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {detalhePessoa.periodos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-zinc-100 pb-1.5 text-sm last:border-b-0">
                    <span className="text-zinc-700">
                      {formatarDataPT(p.data_inicio)}
                      {p.data_inicio !== p.data_fim && <> a {formatarDataPT(p.data_fim)}</>}
                    </span>
                    <span className="text-zinc-500 tabular-nums">{diasUteis(p.data_inicio, p.data_fim)}d</span>
                  </div>
                ))}
                {(() => {
                  const total = detalhePessoa.periodos.reduce((soma, p) => soma + diasUteis(p.data_inicio, p.data_fim), 0)
                  return (
                    <div className="flex items-center justify-between pt-1 text-sm font-semibold">
                      <span className="text-zinc-900">Total</span>
                      <span className={cn('tabular-nums', total > LIMITE_FERIAS_ANUAL ? 'text-red-600' : 'text-zinc-900')}>
                        {total} dias
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
