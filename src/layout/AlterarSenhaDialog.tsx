import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function AlterarSenhaDialog() {
  const { session } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [aAlterar, setAAlterar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const naoCoincide = confirmarSenha.length > 0 && novaSenha !== confirmarSenha
  const podeSubmeter = novaSenha.length >= 6 && novaSenha === confirmarSenha

  function limpar() {
    setNovaSenha('')
    setConfirmarSenha('')
    setErro(null)
  }

  function fechar() {
    if (aAlterar) return
    limpar()
    setAberto(false)
  }

  async function alterarSenha() {
    if (!podeSubmeter || !session) return
    setErro(null)
    setAAlterar(true)

    const { error: erroUpdate } = await supabase.auth.updateUser({ password: novaSenha })
    if (erroUpdate) {
      setAAlterar(false)
      setErro(erroUpdate.message)
      return
    }

    // A partir daqui o evento USER_UPDATED pode já ter desmontado este
    // componente (ver AuthContext) — as chamadas seguintes correm até ao
    // fim de qualquer forma; o log é o registo que sobrevive ao desmonte.
    const { error: erroSignOut } = await supabase.auth.signOut({ scope: 'others' })

    await supabase.from('logs_auditoria').insert({
      referencia_tipo: 'USUARIO',
      id_usuario: session.user.id,
      acao: 'PASSWORD_ALTERADA_PROPRIA',
      descricao_detalhada: erroSignOut
        ? `Password alterada pelo próprio utilizador; falha ao terminar outras sessões: ${erroSignOut.message}`
        : 'Password alterada pelo próprio utilizador; outras sessões terminadas.',
    })

    setAAlterar(false)
    if (erroSignOut) {
      setErro(`Senha alterada, mas não foi possível terminar as outras sessões: ${erroSignOut.message}`)
      return
    }
    limpar()
    setAberto(false)
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setAberto(true)}>
        Alterar Senha
      </Button>
      <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Define uma nova senha de acesso. Todas as outras sessões ativas, noutros dispositivos, serão terminadas.
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-zinc-500">Nova Senha</span>
            <Input
              type="password"
              minLength={6}
              autoComplete="new-password"
              autoFocus
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-zinc-500">Confirmação da Nova Senha</span>
            <Input
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
            />
          </label>
          {naoCoincide && <p className="text-sm text-red-600">As senhas não coincidem.</p>}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={fechar} disabled={aAlterar}>
              Cancelar
            </Button>
            <Button onClick={alterarSenha} disabled={aAlterar || !podeSubmeter}>
              {aAlterar ? 'A alterar…' : 'Alterar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
