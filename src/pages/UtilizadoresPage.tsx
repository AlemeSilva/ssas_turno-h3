import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useUsuarios } from '@/data/useUsuarios'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
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
  const [aRegistar, setARegistar] = useState(false)
  const [erroRegistar, setErroRegistar] = useState<string | null>(null)

  const [resetAlvo, setResetAlvo] = useState<{ id: string; nome: string } | null>(null)
  const [novaPassword, setNovaPassword] = useState('')
  const [aRepor, setARepor] = useState(false)
  const [erroReset, setErroReset] = useState<string | null>(null)

  const [aDesativar, setADesativar] = useState<string | null>(null)
  const [erroDesativar, setErroDesativar] = useState<{ id: string; mensagem: string } | null>(null)

  const ehGerenteTitular = usuario?.perfil === 'GERENTE'

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
    setARegistar(true)
    const { erro } = await chamarGerirUtilizadores({
      acao: 'criar',
      nome,
      email,
      password,
      perfil,
      empresa,
      limite_h3_mensal: perfil === 'OPERADOR_H3' && limiteH3 ? Number(limiteH3) : null,
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
      setARegistarAberto(false)
      recarregar()
    }
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
    if (alvo.ativo) {
      // Desativar precisa da Edge Function — também termina sessões
      // já abertas. Reativar é só um campo, sem esse efeito.
      setADesativar(alvo.id)
      const { erro } = await chamarGerirUtilizadores({ acao: 'desativar', usuario_id: alvo.id })
      setADesativar(null)
      if (erro) {
        setErroDesativar({ id: alvo.id, mensagem: erro })
        return
      }
    } else {
      const { error } = await supabase.from('usuarios').update({ ativo: true }).eq('id', alvo.id)
      if (error) {
        setErroDesativar({ id: alvo.id, mensagem: error.message })
        return
      }
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
                    <Td>{ROTULO_PERFIL[u.perfil]}</Td>
                    <Td>{u.empresa}</Td>
                    <Td>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium',
                          u.ativo ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                        )}
                      >
                        {u.ativo ? 'Ativo' : 'Desativado'}
                      </span>
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
              <Select value={perfil} onValueChange={(v) => setPerfil(v as PerfilUsuario)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROTULO_PERFIL) as PerfilUsuario[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {ROTULO_PERFIL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {perfil === 'OPERADOR_H3' && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-zinc-500">Limite de H3 por mês (opcional)</span>
                <Input type="number" min={0} value={limiteH3} onChange={(e) => setLimiteH3(e.target.value)} />
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
    </div>
  )
}
