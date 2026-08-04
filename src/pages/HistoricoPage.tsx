import { useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { useUsuarios } from '@/data/useUsuarios'
import type { CadeiaDiaria, EscalaSemanal, LogAuditoria, Plano, StatusPlano } from '@/types/database'
import { formatarDataPT } from '@/lib/datas'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Separador = 'ESCALA' | 'PLANO' | 'CADEIAS' | 'AUDITORIA'

// O Select do Radix não aceita value="" (é o valor interno usado para
// "nada selecionado") — precisamos de um sentinel explícito para a
// opção "Todos/Todas" poder ser escolhida de volta depois de já teres
// filtrado por algo, tal como o <option value=""> nativo permitia.
const TODOS = '__todos__'

const TABS: { id: Separador; label: string }[] = [
  { id: 'ESCALA', label: 'Escala' },
  { id: 'PLANO', label: 'Plano' },
  { id: 'CADEIAS', label: 'Cadeias' },
  { id: 'AUDITORIA', label: 'Auditoria' },
]

export function HistoricoPage() {
  const { ehGerenteOuDelegado } = useAuth()
  const [separador, setSeparador] = useState<Separador>('ESCALA')
  const { usuarios } = useUsuarios()

  if (!ehGerenteOuDelegado) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">Esta área é reservada ao Gerente.</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <CardTitle>Histórico / Consulta</CardTitle>

        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <Button key={t.id} variant={separador === t.id ? 'default' : 'outline'} size="sm" onClick={() => setSeparador(t.id)}>
              {t.label}
            </Button>
          ))}
        </div>

        {separador === 'ESCALA' && <FiltroEscala usuarios={usuarios} />}
        {separador === 'PLANO' && <FiltroPlano />}
        {separador === 'CADEIAS' && <FiltroCadeias />}
        {separador === 'AUDITORIA' && <FiltroAuditoria usuarios={usuarios} />}
      </CardContent>
    </Card>
  )
}

function FiltroEscala({ usuarios }: { usuarios: { id: string; nome: string }[] }) {
  const [usuarioId, setUsuarioId] = useState('')
  const [turno, setTurno] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [resultados, setResultados] = useState<EscalaSemanal[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('escala_semanal').select('*').order('semana_ref', { ascending: false })
    if (usuarioId) query = query.eq('usuario_id', usuarioId)
    if (turno) query = query.eq('turno', turno)
    if (de) query = query.gte('semana_ref', de)
    if (ate) query = query.lte('semana_ref', ate)
    const { data } = await query
    setResultados((data as EscalaSemanal[]) ?? [])
  }

  function nomeDe(id: string) {
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  return (
    <div>
      <form onSubmit={pesquisar} className="mb-4 flex flex-wrap items-end gap-2.5">
        <Campo label="Pessoa">
          <Select value={usuarioId || TODOS} onValueChange={(v) => setUsuarioId(v === TODOS ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Turno">
          <Select value={turno || TODOS} onValueChange={(v) => setTurno(v === TODOS ? '' : v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {['H1', 'H2', 'H3', 'H4'].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="De">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Button type="submit">Pesquisar</Button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th>Semana</Th>
            <Th>Pessoa</Th>
            <Th>Turno</Th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <Td>{formatarDataPT(r.semana_ref)}</Td>
              <Td>{nomeDe(r.usuario_id)}</Td>
              <Td>
                <ChipNeutro>{r.turno}</ChipNeutro>
              </Td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr>
              <Td colSpan={3}>Sem resultados — ajusta os filtros e pesquisa.</Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FiltroAuditoria({ usuarios }: { usuarios: { id: string; nome: string }[] }) {
  const [usuarioId, setUsuarioId] = useState('')
  const [acao, setAcao] = useState('')
  const [resultados, setResultados] = useState<LogAuditoria[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('logs_auditoria').select('*').order('data_hora', { ascending: false }).limit(200)
    if (usuarioId) query = query.eq('id_usuario', usuarioId)
    if (acao) query = query.ilike('acao', `%${acao}%`)
    const { data } = await query
    setResultados((data as LogAuditoria[]) ?? [])
  }

  function nomeDe(id: string | null) {
    if (!id) return '—'
    return usuarios.find((u) => u.id === id)?.nome ?? id
  }

  return (
    <div>
      <form onSubmit={pesquisar} className="mb-4 flex flex-wrap items-end gap-2.5">
        <Campo label="Pessoa">
          <Select value={usuarioId || TODOS} onValueChange={(v) => setUsuarioId(v === TODOS ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Tipo de ação (texto)">
          <Input value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="ex.: ESCALONAMENTO" />
        </Campo>
        <Button type="submit">Pesquisar</Button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th>Data/hora</Th>
            <Th>Ação</Th>
            <Th>Utilizador</Th>
            <Th>Descrição</Th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <Td>{new Date(r.data_hora).toLocaleString('pt-PT')}</Td>
              <Td>{r.acao}</Td>
              <Td>{nomeDe(r.id_usuario)}</Td>
              <Td>{r.descricao_detalhada}</Td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr>
              <Td colSpan={4}>Sem resultados — ajusta os filtros e pesquisa.</Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const STATUS_PLANO_LABELS: Record<StatusPlano, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE_APROVACAO: 'Pendente',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
}

function FiltroPlano() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [status, setStatus] = useState<StatusPlano | ''>('')
  const [resultados, setResultados] = useState<Plano[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('planos').select('*').order('data_inicio_ciclo', { ascending: false })
    if (de) query = query.gte('data_inicio_ciclo', de)
    if (ate) query = query.lte('data_inicio_ciclo', ate)
    if (status) query = query.eq('status', status)
    const { data } = await query
    setResultados((data as Plano[]) ?? [])
  }

  return (
    <div>
      <form onSubmit={pesquisar} className="mb-4 flex flex-wrap items-end gap-2.5">
        <Campo label="Início do ciclo — De">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Campo label="Estado">
          <Select value={status || TODOS} onValueChange={(v) => setStatus(v === TODOS ? '' : (v as StatusPlano))}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {(Object.keys(STATUS_PLANO_LABELS) as StatusPlano[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_PLANO_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Button type="submit">Pesquisar</Button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th>Ciclo</Th>
            <Th>Tipo F. Semana</Th>
            <Th>Estado</Th>
            <Th>Criado em</Th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <Td>{formatarDataPT(r.data_inicio_ciclo)}</Td>
              <Td>{r.tipo_fim_semana}</Td>
              <Td>
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                    r.status === 'APROVADO' || r.status === 'CONCLUIDO'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : r.status === 'EM_EXECUCAO'
                        ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                        : 'border-amber-100 bg-amber-50 text-amber-700'
                  )}
                >
                  {STATUS_PLANO_LABELS[r.status]}
                </span>
              </Td>
              <Td>{formatarDataPT(r.data_criacao)}</Td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr>
              <Td colSpan={4}>Sem resultados — ajusta os filtros e pesquisa.</Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FiltroCadeias() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [nomeCadeia, setNomeCadeia] = useState('')
  const [resultados, setResultados] = useState<CadeiaDiaria[]>([])

  async function pesquisar(e: FormEvent) {
    e.preventDefault()
    let query = supabase.from('cadeias_diarias').select('*').order('data', { ascending: false }).limit(300)
    if (de) query = query.gte('data', de)
    if (ate) query = query.lte('data', ate)
    if (nomeCadeia) query = query.ilike('nome_cadeia', `%${nomeCadeia}%`)
    const { data } = await query
    setResultados((data as CadeiaDiaria[]) ?? [])
  }

  return (
    <div>
      <form onSubmit={pesquisar} className="mb-4 flex flex-wrap items-end gap-2.5">
        <Campo label="Data — De">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Campo label="Nome da cadeia">
          <Input value={nomeCadeia} onChange={(e) => setNomeCadeia(e.target.value)} placeholder="ex.: GIR_FL" />
        </Campo>
        <Button type="submit">Pesquisar</Button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th>Data</Th>
            <Th>Cadeia</Th>
            <Th>Secção</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => (
            <tr key={r.id}>
              <Td>{formatarDataPT(r.data)}</Td>
              <Td>{r.nome_cadeia}</Td>
              <Td>{r.secao}</Td>
              <Td>
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                    r.status === 'CONCLUIDO_AUTOMATICO' || r.status === 'CONCLUIDO_MANUAL'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : r.status === 'ATRASADO'
                        ? 'border-red-100 bg-red-50 text-red-700'
                        : r.status === 'EM_ANDAMENTO'
                          ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                          : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                  )}
                >
                  {r.status.replace(/_/g, ' ')}
                </span>
              </Td>
            </tr>
          ))}
          {resultados.length === 0 && (
            <tr>
              <Td colSpan={4}>Sem resultados — ajusta os filtros e pesquisa.</Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      {children}
    </label>
  )
}

function Th({ children }: { children?: ReactNode }) {
  return <th className="border-b border-zinc-100 px-2 py-1.5 text-left text-xs font-medium text-zinc-400">{children}</th>
}

function Td({ children, colSpan }: { children?: ReactNode; colSpan?: number }) {
  return (
    <td className="border-b border-zinc-100 px-2 py-1.5" colSpan={colSpan}>
      {children}
    </td>
  )
}

function ChipNeutro({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-zinc-500">
      {children}
    </span>
  )
}
