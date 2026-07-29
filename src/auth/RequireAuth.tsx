import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { Login } from './Login'

// Note: o corte de acesso "oficial" (a partir do dia seguinte à
// data_saida) é imposto no servidor por uma função agendada que
// bloqueia a conta no Supabase Auth — ver supabase/functions/desativar-saidas.
// Esta verificação de `ativo` no cliente é só uma segunda camada,
// para o caso de a função agendada ainda não ter corrido.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, usuario, carregando, signOut } = useAuth()

  if (carregando) {
    return <CentroDeEcra texto="A carregar…" />
  }

  if (!session) {
    return <Login />
  }

  if (usuario && !usuario.ativo) {
    return (
      <CentroDeEcra texto="Esta conta foi desativada. Contacte o Gerente.">
        <button className="btn btn-ghost" onClick={() => signOut()} style={{ marginTop: '1rem' }}>
          Sair
        </button>
      </CentroDeEcra>
    )
  }

  return <>{children}</>
}

function CentroDeEcra({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        color: 'var(--text-secondary)',
        background: 'var(--bg-app)',
      }}
    >
      <div>{texto}</div>
      {children}
    </div>
  )
}
