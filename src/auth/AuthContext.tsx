import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types/database'

interface AuthState {
  session: Session | null
  usuario: Usuario | null
  carregando: boolean
  ehGerenteOuDelegado: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ehGerenteOuDelegado, setEhGerenteOuDelegado] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao)
    })

    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let cancelado = false

    async function carregarPerfil() {
      if (!session?.user) {
        setUsuario(null)
        setEhGerenteOuDelegado(false)
        setCarregando(false)
        return
      }

      setCarregando(true)

      const [{ data: perfil }, { data: gerenteDelegado }] = await Promise.all([
        supabase.from('usuarios').select('*').eq('id', session.user.id).single(),
        supabase.rpc('is_gerente_ou_delegado'),
      ])

      if (!cancelado) {
        setUsuario((perfil as Usuario) ?? null)
        setEhGerenteOuDelegado(Boolean(gerenteDelegado))
        setCarregando(false)
      }
    }

    carregarPerfil()
    return () => {
      cancelado = true
    }
  }, [session])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, usuario, carregando, ehGerenteOuDelegado, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth tem de ser usado dentro de <AuthProvider>')
  return ctx
}
