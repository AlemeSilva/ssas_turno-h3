import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { AlertBar } from './AlertBar'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const ABAS = [
  { to: '/inicio', label: 'Início' },
  { to: '/plano', label: 'Plano de Fim de Semana' },
  { to: '/checklist', label: 'Checklist Ativo' },
  { to: '/escala', label: 'Escala do Mês' },
]

const ABAS_GERENTE = [
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/historico', label: 'Histórico' },
  { to: '/definicoes', label: 'Definições' },
  { to: '/utilizadores', label: 'Utilizadores' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { usuario, ehGerenteOuDelegado, signOut } = useAuth()
  const abas = ehGerenteOuDelegado ? [...ABAS, ...ABAS_GERENTE] : ABAS

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AlertBar />

      <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <LockMark />
          <div>
            <div className="font-bold text-zinc-900">Turno H3</div>
            <div className="text-xs text-zinc-500">Accenture · Banco Montepio</div>
          </div>
        </div>

        <nav className="flex gap-1">
          {abas.map((aba) => (
            <NavLink
              key={aba.to}
              to={aba.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3.5 py-2 text-sm font-semibold no-underline',
                  isActive ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                )
              }
            >
              {aba.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-zinc-900">{usuario?.nome ?? '—'}</div>
            <div className="text-xs text-zinc-500">
              {usuario?.perfil}
              {ehGerenteOuDelegado && usuario?.perfil !== 'GERENTE' ? ' · substituto do Gerente' : ''}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}

function LockMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 36 36" aria-hidden="true">
      {/* Quadrado âmbar Montepio */}
      <rect x="0" y="0" width="17" height="36" rx="5" fill="var(--montepio-orange)" />
      {/* Quadrado roxo Accenture */}
      <rect x="19" y="0" width="17" height="36" rx="5" fill="var(--accenture-purple)" />
      {/* Chevron ">" estilizado — referência ao logótipo Accenture, a branco sobre roxo */}
      <polyline points="23,11 30,18 23,25" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Pássaro simplificado — bico apontado à esquerda, branco sobre âmbar */}
      <path
        d="M13,16 C10,14 5,15 4,17 C6,17 8,16.5 9,18 C10,19.5 12,20 14,19 C14,17.5 13,16 13,16 Z"
        fill="white"
      />
    </svg>
  )
}
