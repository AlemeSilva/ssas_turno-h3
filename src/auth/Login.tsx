import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aEnviar, setAEnviar] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setAEnviar(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setAEnviar(false)
    if (error) {
      setErro('Credenciais inválidas ou conta inexistente. Contacte o Gerente para provisionamento de acesso.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex-row items-center gap-2.5 space-y-0">
          <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50">
            <Lock className="size-4 text-indigo-600" />
          </span>
          <div>
            <div className="text-base font-bold text-zinc-900">Gestão de Turnos</div>
            <div className="text-xs text-zinc-500">Accenture · Banco Montepio</div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-zinc-500">Email</span>
              <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-zinc-500">Palavra-passe</span>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <Button type="submit" disabled={aEnviar} className="w-full">
              {aEnviar ? 'A entrar…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
