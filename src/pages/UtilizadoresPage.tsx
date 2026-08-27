import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useUsuarios } from '@/data/useUsuarios'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { adicionarDias, agora, duracaoEmAnosEMeses, formatarDataPT, paraISO } from '@/lib/datas'
import { semanasParaNovoOperador } from '@/lib/composicaoEscala'
import type { PerfilUsuario, Usuario } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const ROTULO_PERFIL: Record<PerfilUsuario, string> = {
  GERENTE: 'Gerente',
  OPERADOR: 'Operador',
  OPERADOR_H3: 'Operador H3',
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="border-b border-zinc-100 px-2 py-1.5 text-left text-xs font-medium text-zinc-400">{children}</th>
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('border-b border-zinc-100 px-2 py-1.5 align-middle', className)}>{children}</td>
}

async function chamarGerirUtilizadores<T>(corpo: Record<string, unknown>): Promise<{ data: T | null; erro: string | null }> {
  const { data, error } = await supabase.functions.invoke('gerir-utilizadores', { body: corpo })
  if (error) return { data: null, erro: error.message }
  if (data?.erro) return { data: null, erro: data.erro as string }
  return { data: data as T, erro: null }
}

export function UtilizadoresPage() {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const { usuarios, aCarregar, recarregar } = useUsuarios()

  const [aRegistarAberto, setARegistarAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [perfil, setPerfil] = useState<PerfilUsuario>('OPERADOR')
  const [empresa, setEmpresa] = useState('Accenture')
  const [limiteH3, setLimiteH3] = useState('')
  const [turnoFixo, setTurnoFixo] = useState<'H1' | 'H4' | ''>('')
  const [elegivelH2, setElegivelH2] = useState(false)
  const [aRegistar, setARegistar] = useState(false)
  const [erroRegistar, setErroRegistar] = useState<string | null>(null)

  const [resetAlvo, setResetAlvo] = useState<{ id: string; nome: string } | null>(null)
  const [novaPassword, setNovaPassword] = useState('')
  const [aRepor, setARepor] = useState(false)
  const [erroReset, setErroReset] = useState<string | null>(null)

  const [aDesativar, setADesativar] = useState<string | null>(null)
  const [erroDesativar, setErroDesativar] = useState<{ id: string; mensagem: string } | null>(null)

  const [agendarAlvo, setAgendarAlvo] = useState<{ id: string; nome: string } | null>(null)
  const [dataSaida, setDataSaida] = useState('')
  const [aAgendar, setAAgendar] = useState(false)
  const [erroAgendar, setErroAgendar] = useState<string | null>(null)

  const [aAlterarTurno, setAAlterarTurno] = useState<string | null>(null)
  const [erroTurno, setErroTurno] = useState<{ id: string; mensagem: string } | null>(null)

  const [aAlterarH2, setAAlterarH2] = useState<string | null>(null)
  const [erroH2, setErroH2] = useState<{ id: string; mensagem: string } | null>(null)

  const ehGerenteTitular = usuario?.perfil === 'GERENTE'
  // Um delegado pode registar OPERADOR/OPERADOR_H3, mas nunca outro
  // Gerente — mesma fronteira aplicada na Edge Function e na RLS
  // (usuarios_insert_gerente), para não ficar só na interface.
  const perfisDisponiveis = (Object.keys(ROTULO_PERFIL) as PerfilUsuario[]).filter(
    (p) => p !== 'GERENTE' || ehGerenteTitular
  )

  if (!ehGerenteOuDelegado) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-zinc-500">Esta área é reservada ao Gerente.</CardContent>
      </Card>
    )
  }

  function podeGerir(alvo: Usuario) {
    return alvo.perfil !== 'GERENTE' || ehGerenteTitular
  }

  async function registar(e: FormEvent) {
    e.preventDefault()
    setErroRegistar(null)
    // O <Select> do turno, tal como o de Perfil, não participa na
    // validação HTML nativa do formulário — repõe-se manualmente.
    if (perfil === 'OPERADOR' && !turnoFixo) {
      setErroRegistar('Escolhe o turno fixo (H1 ou H4) deste Operador.')
      return
    }
    setARegistar(true)
    const { erro } = await chamarGerirUtilizadores({
      acao: 'criar',
      nome,
      email,
      password,
      perfil,
      empresa,
      limite_h3_mensal: perfil === 'OPERADOR_H3' && limiteH3 ? Number(limiteH3) : null,
      turno_fixo: perfil === 'OPERADOR' ? turnoFixo : null,
      elegivel_h2: perfil === 'OPERADOR_H3' ? elegivelH2 : false,
    })
    setARegistar(false)
    if (erro) {
      setErroRegistar(erro)
    } else {
      setNome('')
      setEmail('')
      setPassword('')
      setPerfil('OPERADOR')
      setEmpresa('Accenture')
      setLimiteH3('')
      setTurnoFixo('')
      setElegivelH2(false)
      setARegistarAberto(false)
      recarregar()
    }
  }

  async function agendarSaida() {
    if (!agendarAlvo || !dataSaida) return
    setErroAgendar(null)
    setAAgendar(true)
    const { error } = await supabase.from('usuarios').update({ data_saida: dataSaida }).eq('id', agendarAlvo.id)
    setAAgendar(false)
    if (error) {
      setErroAgendar(error.message)
    } else {
      setDataSaida('')
      setAgendarAlvo(null)
      recarregar()
    }
  }

  async function cancelarSaidaAgendada(alvo: Usuario) {
    setErroDesativar(null)
    const { error } = await supabase.from('usuarios').update({ data_saida: null }).eq('id', alvo.id)
    if (error) {
      setErroDesativar({ id: alvo.id, mensagem: error.message })
      return
    }
    recarregar()
  }

  async function alterarTurnoFixo(alvo: Usuario, novoTurno: 'H1' | 'H4') {
    if (novoTurno === alvo.turno_fixo) return
    setErroTurno(null)
    setAAlterarTurno(alvo.id)
    // Só muda o atributo da pessoa — não mexe na escala já gerada para
    // este ano (essa continua editável manualmente na página Escala,
    // como hoje). Passa a valer a partir da próxima composição
    // automática (reativação ou preenchimento anual de novembro).
    const { error } = await supabase.from('usuarios').update({ turno_fixo: novoTurno }).eq('id', alvo.id)
    setAAlterarTurno(null)
    if (error) {
      setErroTurno({ id: alvo.id, mensagem: error.message })
      return
    }
    recarregar()
  }

  async function alterarElegibilidadeH2(alvo: Usuario, novoValor: boolean) {
    if (novoValor === alvo.elegivel_h2) return
    setErroH2(null)
    setAAlterarH2(alvo.id)
    // Só muda o atributo da pessoa — não mexe na escala já gerada,
    // mesma fronteira de turno_fixo acima. Passa a valer a partir da
    // próxima composição automática (preenchimento anual de novembro).
    const { error } = await supabase.from('usuarios').update({ elegivel_h2: novoValor }).eq('id', alvo.id)
    setAAlterarH2(null)
    if (error) {
      setErroH2({ id: alvo.id, mensagem: error.message })
      return
    }
    recarregar()
  }

  async function reporPassword() {
    if (!resetAlvo) return
    setErroReset(null)
    setARepor(true)
    const { erro } = await chamarGerirUtilizadores({
      acao: 'reset_password',
      usuario_id: resetAlvo.id,
      nova_password: novaPassword,
    })
    setARepor(false)
    if (erro) {
      setErroReset(erro)
    } else {
      setNovaPassword('')
      setResetAlvo(null)
    }
  }

  async function alternarAtivo(alvo: Usuario) {
    setErroDesativar(null)
    setADesativar(alvo.id)
    if (alvo.ativo) {
      // Desativar precisa da Edge Function — também termina sessões
      // já abertas. Reativar é só um campo, sem esse efeito.
      const { erro } = await chamarGerirUtilizadores({ acao: 'desativar', usuario_id: alvo.id })
      setADesativar(null)
      if (erro) {
        setErroDesativar({ id: alvo.id, mensagem: erro })
        return
      }
    } else {
      // Limpa data_saida ao reativar — se ficasse uma data no passado,
      // o desactivar-saidos automático (corre todos os dias às 01h00)
      // desfazia esta reativação já no dia seguinte, sem ninguém pedir.
      const { error } = await supabase.from('usuarios').update({ ativo: true, data_saida: null }).eq('id', alvo.id)
      if (error) {
        setADesativar(null)
        setErroDesativar({ id: alvo.id, mensagem: error.message })
        return
      }
      // Recompõe a escala desta pessoa até ao fim do ano (mesma lógica
      // do registo — ver composicaoEscala.ts) — sem isto, ficava sem
      // nenhum turno atribuído até ao preenchimento automático de
      // novembro seguinte. GERENTE não entra aqui (placeholder H4 só é
      // recomposto no preenchimento anual, mesma fronteira que 'criar'
      // já usa na Edge Function).
      if (alvo.perfil === 'OPERADOR' && alvo.turno_fixo) {
        const semanas = semanasParaNovoOperador(paraISO(agora()))
        const { error: erroEscala } = await supabase.from('escala_semanal').insert(
          semanas.map((semana_ref) => ({ semana_ref, usuario_id: alvo.id, turno: alvo.turno_fixo, criado_por: usuario?.id }))
        )
        if (erroEscala) {
          setADesativar(null)
          setErroDesativar({ id: alvo.id, mensagem: `Reativado, mas falhou compor a escala: ${erroEscala.message}` })
          return
        }
      }
      setADesativar(null)
    }
    recarregar()
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center justify-between">
            <CardTitle>Gestão de Utilizadores</CardTitle>
            <Button onClick={() => setARegistarAberto(true)}>Registar utilizador</Button>
          </div>

          {aCarregar ? (
            <p className="text-sm text-zinc-500">A carregar…</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Email</Th>
                  <Th>Perfil</Th>
                  <Th>Empresa</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <Td>{u.nome}</Td>
                    <Td className="text-zinc-500">{u.email}</Td>
                    <Td>
                      {u.perfil === 'OPERADOR' && podeGerir(u) ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <span>{ROTULO_PERFIL[u.perfil]}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Select
                                  value={u.turno_fixo ?? undefined}
                                  onValueChange={(v) => alterarTurnoFixo(u, v as 'H1' | 'H4')}
                                  disabled={aAlterarTurno === u.id}
                                >
                                  <SelectTrigger size="sm" className="h-6 w-16 px-1.5 text-xs">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="H1">H1</SelectItem>
                                    <SelectItem value="H4">H4</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TooltipTrigger>
                              <TooltipContent>
                                Turno fixo — só muda a partir da próxima composição automática, não afeta a escala já gerada
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {erroTurno?.id === u.id && <p className="text-xs text-red-600">{erroTurno.mensagem}</p>}
                        </div>
                      ) : u.perfil === 'OPERADOR_H3' && podeGerir(u) ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <span>{ROTULO_PERFIL[u.perfil]}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Select
                                  value={u.elegivel_h2 ? 'sim' : 'nao'}
                                  onValueChange={(v) => alterarElegibilidadeH2(u, v === 'sim')}
                                  disabled={aAlterarH2 === u.id}
                                >
                                  <SelectTrigger size="sm" className="h-6 w-24 px-1.5 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sim">H2: sim</SelectItem>
                                    <SelectItem value="nao">H2: não</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TooltipTrigger>
                              <TooltipContent>
                                Elegível para H2 na rotação automática — só afeta composições futuras, não a escala já gerada
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {erroH2?.id === u.id && <p className="text-xs text-red-600">{erroH2.mensagem}</p>}
                        </div>
                      ) : (
                        ROTULO_PERFIL[u.perfil]
                      )}
                    </Td>
                    <Td>{u.empresa}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                            u.ativo ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                          )}
                        >
                          {u.ativo ? 'Ativo' : 'Desativado'}
                        </span>
                        {u.ativo && u.data_saida && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[0.65rem] font-medium whitespace-nowrap text-amber-700">
                                Sai em {formatarDataPT(u.data_saida)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Desativação automática agendada — corre todos os dias às 01h00</TooltipContent>
                          </Tooltip>
                        )}
                        {!u.ativo && u.data_saida && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[0.65rem] font-medium whitespace-nowrap text-zinc-500">
                                Saiu em {formatarDataPT(u.data_saida)} · {duracaoEmAnosEMeses(u.criado_em, u.data_saida)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Tempo de permanência na equipa, desde o registo até à saída</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {podeGerir(u) ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  aria-label="Repor password"
                                  onClick={() => {
                                    setResetAlvo({ id: u.id, nome: u.nome })
                                    setErroReset(null)
                                  }}
                                >
                                  <KeyRound className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Repor a password desta pessoa — precisa de lhe indicar a nova por outro canal</TooltipContent>
                            </Tooltip>
                            <Button
                              size="xs"
                              variant={u.ativo ? 'ghost' : 'secondary'}
                              disabled={aDesativar === u.id}
                              onClick={() => alternarAtivo(u)}
                            >
                              {aDesativar === u.id ? '…' : u.ativo ? 'Desativar' : 'Reativar'}
                            </Button>
                            {u.ativo && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => {
                                      if (u.data_saida) {
                                        cancelarSaidaAgendada(u)
                                        return
                                      }
                                      setAgendarAlvo({ id: u.id, nome: u.nome })
                                      setDataSaida('')
                                      setErroAgendar(null)
                                    }}
                                  >
                                    {u.data_saida ? 'Cancelar saída' : 'Agendar saída'}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {u.data_saida
                                    ? 'Remove a data de saída agendada — a conta deixa de ser desativada automaticamente'
                                    : 'Define uma data a partir da qual esta pessoa é desativada automaticamente, sem precisares de voltar cá nesse dia'}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {erroDesativar?.id === u.id && <p className="text-xs text-red-600">{erroDesativar.mensagem}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aRegistarAberto} onOpenChange={(aberto) => !aRegistar && setARegistarAberto(aberto)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registar utilizador</DialogTitle>
            <DialogDescription>Cria a conta de acesso e o perfil, num só passo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={registar} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Nome</span>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Email</span>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Password inicial</span>
              <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Empresa</span>
              <Input required value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-zinc-500">Perfil</span>
              <Select
                value={perfil}
                onValueChange={(v) => {
                  setPerfil(v as PerfilUsuario)
                  setTurnoFixo('')
                  setElegivelH2(false)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {perfisDisponiveis.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ROTULO_PERFIL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {perfil === 'OPERADOR_H3' && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-zinc-500">Limite de H3 por mês (opcional)</span>
                  <Input type="number" min={0} value={limiteH3} onChange={(e) => setLimiteH3(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-zinc-500">Elegível para H2 na rotação automática?</span>
                  <Select value={elegivelH2 ? 'sim' : 'nao'} onValueChange={(v) => setElegivelH2(v === 'sim')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </>
            )}
            {perfil === 'OPERADOR' && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-zinc-500">Turno fixo</span>
                <Select value={turnoFixo} onValueChange={(v) => setTurnoFixo(v as 'H1' | 'H4')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="H1">H1 — 07h00 às 16h00</SelectItem>
                    <SelectItem value="H4">H4 — 09h00 às 18h00</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            )}
            {erroRegistar && <p className="text-sm text-red-600">{erroRegistar}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setARegistarAberto(false)} disabled={aRegistar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={aRegistar}>
                {aRegistar ? 'A registar…' : 'Registar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetAlvo !== null} onOpenChange={(aberto) => !aberto && !aRepor && setResetAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repor password</DialogTitle>
            <DialogDescription>
              {resetAlvo?.nome} — define uma nova password. Indica-a a esta pessoa por outro canal (não fica visível depois de fechar).
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-zinc-500">Nova password</span>
            <Input
              type="password"
              minLength={6}
              autoFocus
              value={novaPassword}
              onChange={(e) => setNovaPassword(e.target.value)}
            />
          </label>
          {erroReset && <p className="text-sm text-red-600">{erroReset}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetAlvo(null)} disabled={aRepor}>
              Cancelar
            </Button>
            <Button onClick={reporPassword} disabled={aRepor || novaPassword.length < 6}>
              {aRepor ? 'A repor…' : 'Repor password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={agendarAlvo !== null} onOpenChange={(aberto) => !aberto && !aAgendar && setAgendarAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar saída</DialogTitle>
            <DialogDescription>
              {agendarAlvo?.nome} — a partir desta data, a conta é desativada automaticamente (corre todos os dias às
              01h00), sem precisares de voltar cá nesse dia. A escala futura desta pessoa é removida no momento da
              desativação.
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-zinc-500">Data de saída</span>
            <Input
              type="date"
              autoFocus
              min={paraISO(adicionarDias(agora(), 1))}
              value={dataSaida}
              onChange={(e) => setDataSaida(e.target.value)}
            />
          </label>
          {erroAgendar && <p className="text-sm text-red-600">{erroAgendar}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgendarAlvo(null)} disabled={aAgendar}>
              Cancelar
            </Button>
            <Button onClick={agendarSaida} disabled={aAgendar || !dataSaida}>
              {aAgendar ? 'A agendar…' : 'Agendar saída'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
