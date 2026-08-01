import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useDebounce } from '@/lib/hooks/useDebounce'
import type { CadeiaDiaria, TarefaPlano } from '@/types/database'
import { avaliarAlertaReativo, avaliarRiscoGirFl, estaHrLimiteEstourado, isoWeekdayDe } from '@/lib/alertas'
import { agora as getNow } from '@/lib/datas'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  tarefas: TarefaPlano[]
  cadeias: CadeiaDiaria[]
  dependenciasGirFl: string[]
  ehManutencao: boolean
}

function agoraHHMM(): string {
  const d = getNow()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function LinhaAlerta({
  rotuloBadge,
  badgeClassName,
  descricao,
  registado,
  onRegistar,
}: {
  rotuloBadge: string
  badgeClassName: string
  descricao: string
  registado: boolean
  onRegistar: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-zinc-700">
        <span className={`mr-1.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium ${badgeClassName}`}>
          {rotuloBadge}
        </span>
        {descricao}
      </span>
      <Button variant="destructive" size="sm" disabled={registado} onClick={onRegistar}>
        {registado ? 'Acionamento registado' : 'Registar acionamento ao Gerente'}
      </Button>
    </div>
  )
}

export function PainelAlertas({ tarefas, cadeias, dependenciasGirFl: nomesDependenciasGirFl, ehManutencao }: Props) {
  const { usuario } = useAuth()
  const [registados, setRegistados] = useState<Set<string>>(new Set())

  const agora = agoraHHMM()
  const diaSemanaIso = isoWeekdayDe(getNow())

  // Debounce para prevenir múltiplos clics acidentais em "Registar acionamento"
  // RLS na BD já protege duplicação de dados críticos; isto é proteção UX adicional
  const registarAcionamentoDebounced = useDebounce(
    async (tipo: string, chave: string, referenciaTipo: string, referenciaId: number | null, descricao: string) => {
      if (!usuario) return
      setRegistados((prev) => new Set(prev).add(chave))
      await supabase.from('logs_auditoria').insert({
        referencia_tipo: referenciaTipo,
        referencia_id: referenciaId,
        id_usuario: usuario.id,
        acao: tipo,
        descricao_detalhada: descricao,
      })
    },
    500
  )

  const tarefasComHrLimiteEstourado = tarefas.filter((t) => estaHrLimiteEstourado(t.hr_limite, t.status, agora))

  const statusDependenciasGirFl = cadeias
    .filter((c) => c.secao === 'BATCH_SAB_DOM' && nomesDependenciasGirFl.includes(c.nome_cadeia))
    .map((c) => c.status)
  const riscoGirFl = avaliarRiscoGirFl(diaSemanaIso, agora, statusDependenciasGirFl)
  const girFlEmRisco = riscoGirFl.aplicavel && riscoGirFl.estado !== 'FUTURO'

  const checagem20hAtiva =
    (diaSemanaIso === 6 || diaSemanaIso === 7) && avaliarAlertaReativo('20:00', agora, 30) !== 'FUTURO'

  const checagem15hAtiva =
    diaSemanaIso === 6 && ehManutencao && avaliarAlertaReativo('15:00', agora, 30) !== 'FUTURO'

  if (tarefasComHrLimiteEstourado.length === 0 && !girFlEmRisco && !checagem20hAtiva && !checagem15hAtiva) {
    return null
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-600">Alertas ativos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {tarefasComHrLimiteEstourado.map((t) => {
          const chave = `hrlimite-${t.id}`
          return (
            <LinhaAlerta
              key={chave}
              rotuloBadge="HR. LIMITE"
              badgeClassName="border-red-100 bg-red-50 text-red-700"
              descricao={`${t.descricao_tarefa} — limite ${t.hr_limite}`}
              registado={registados.has(chave)}
              onRegistar={() =>
                registarAcionamentoDebounced(
                  'ESCALONAMENTO_HR_LIMITE',
                  chave,
                  'TAREFA_PLANO',
                  t.id,
                  `HR.LIMITE estourado: ${t.descricao_tarefa}`
                )
              }
            />
          )
        })}

        {girFlEmRisco && (
          <LinhaAlerta
            rotuloBadge="GIR_FL"
            badgeClassName="border-red-100 bg-red-50 text-red-700"
            descricao="Risco de colisão às 22h — blocos remanescentes de Sábado ainda não concluídos."
            registado={registados.has('girfl')}
            onRegistar={() =>
              registarAcionamentoDebounced('ESCALONAMENTO_GIR_FL', 'girfl', 'CADEIA', null, 'Risco de colisão GIR_FL às 22h')
            }
          />
        )}

        {checagem20hAtiva && (
          <LinhaAlerta
            rotuloBadge="Checagem"
            badgeClassName="border-amber-100 bg-amber-50 text-amber-700"
            descricao="Janela crítica das 20h (Sáb/Dom) em curso."
            registado={registados.has('checagem20h')}
            onRegistar={() =>
              registarAcionamentoDebounced('ESCALONAMENTO_CHECAGEM_20H', 'checagem20h', 'PLANO', null, 'Checagem das 20h acionada')
            }
          />
        )}

        {checagem15hAtiva && (
          <LinhaAlerta
            rotuloBadge="Checagem"
            badgeClassName="border-amber-100 bg-amber-50 text-amber-700"
            descricao="Janela crítica das 15h (Sábado de manutenção) em curso."
            registado={registados.has('checagem15h')}
            onRegistar={() =>
              registarAcionamentoDebounced(
                'ESCALONAMENTO_CHECAGEM_15H',
                'checagem15h',
                'PLANO',
                null,
                'Checagem das 15h de manutenção acionada'
              )
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
