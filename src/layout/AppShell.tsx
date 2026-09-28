import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { AlertBar } from './AlertBar'
import { AlterarSenhaDialog } from './AlterarSenhaDialog'
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
  { to: '/headcount', label: 'Headcount' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { usuario, ehGerenteOuDelegado, signOut } = useAuth()

  function itemMenu(aba: (typeof ABAS)[number]) {
    return (
      <NavLink
        key={aba.to}
        to={aba.to}
        className={({ isActive }) =>
          cn(
            'group flex min-h-10 items-center rounded-r-md border-l-[3px] px-3.5 py-2.5 text-sm font-medium no-underline transition-colors',
            isActive
              ? 'border-brand-amber bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
              : 'border-transparent text-white/75 hover:border-white/25 hover:bg-white/[0.06] hover:text-white'
          )
        }
      >
        {aba.label}
      </NavLink>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="app-sidebar sticky top-0 flex h-screen w-[248px] shrink-0 flex-col text-white">
        <div className="brand-ribbon h-1 shrink-0" />
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight tracking-[-0.02em]">Gestão de Turnos</div>
            <div className="mt-1 text-[11px] leading-tight text-white/65">Accenture · Banco Montepio</div>
          </div>
        </div>

        <div className="mx-5 mb-3 border-t border-white/15" />
        <div className="px-5 pb-2 text-[10px] font-semibold tracking-[0.16em] text-white/45">OPERAÇÃO</div>
        <nav aria-label="Navegação principal" className="flex flex-col gap-1 pr-3">
          {ABAS.map(itemMenu)}
        </nav>

        {ehGerenteOuDelegado && (
          <>
            <div className="mx-5 mb-3 mt-6 border-t border-white/15" />
            <div className="px-5 pb-2 text-[10px] font-semibold tracking-[0.16em] text-white/45">GESTÃO</div>
            <nav aria-label="Navegação de gestão" className="flex flex-col gap-1 pr-3">
              {ABAS_GERENTE.map(itemMenu)}
            </nav>
          </>
        )}

        <div className="mt-auto px-5 pb-5 pt-6">
          <div className="border-t border-white/15 pt-3 text-[10px] tracking-wide text-white/45">
            SERVIÇO DE OPERAÇÃO · SAS
          </div>
          <div className="sidebar-brand-lockup mt-3 flex items-center justify-center gap-2.5" aria-label="Accenture e Banco Montepio">
            <MontepioLogo />
            <AccentureLogo />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex min-h-[68px] items-center justify-between gap-5 border-b border-zinc-200 bg-white px-7 pt-1">
          <div className="brand-ribbon absolute inset-x-0 top-0 h-1" />
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold tracking-wide text-brand-purple-strong">ACCENTURE</span>
            <span className="text-brand-amber-strong">×</span>
            <span className="font-semibold tracking-wide text-zinc-700">BANCO MONTEPIO</span>
            <span className="ml-2 hidden text-zinc-400 xl:inline">/</span>
            <span className="hidden text-zinc-500 xl:inline">Serviço de Operação</span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-zinc-900">{usuario?.nome ?? '—'}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {usuario?.perfil}
                {ehGerenteOuDelegado && usuario?.perfil !== 'GERENTE' ? ' · substituto do Gerente' : ''}
              </div>
            </div>
            <AlterarSenhaDialog />
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sair
            </Button>
          </div>
        </header>

        <div className="border-b border-zinc-200 bg-white">
          <AlertBar />
        </div>
        <main className="workspace-canvas min-h-0 flex-1 overflow-auto p-7">{children}</main>
      </div>
    </div>
  )
}

function MontepioLogo() {
  return (
    <div className="sidebar-logo-plate sidebar-logo-plate--montepio" role="img" aria-label="Banco Montepio">
      <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
        <path
          d="M5.2 16.2c.5-5.3 5.5-8.7 11.2-9.6L35 2.4 25.8 13c-3.6 4.1-8.5 7.8-12.5 7.1-2.5-.4-3.4-2.2-2.7-4.3.6-1.9 2.6-3.3 5.3-3.8-4.5.3-8.2 1.6-10.7 4.2Zm.1 1.3c-1.9 2.7-1.2 6.3 1.6 9.1l9.5 8.7h11.7c-4.5-3.4-9.7-7.2-10.2-10-.3-1.7 1.2-3.2 3-3 6.2.8 11.6-7.5 14-14.2-3.7 4.4-8.4 9.2-14.5 10.5-3.7.8-7.4-.1-10.3-2.6-1.5-1.3-3.4-1.1-4.8 1.5Z"
          fill="white"
        />
        <circle cx="12.8" cy="15.5" r="1.1" fill="#f0a41c" />
      </svg>
    </div>
  )
}

function AccentureLogo() {
  return (
    <div className="sidebar-logo-plate sidebar-logo-plate--accenture" role="img" aria-label="Accenture">
      <svg viewBox="0 0 126 40" width="116" height="37" aria-hidden="true">
        <path d="m78 3 13 5-13 5" fill="none" stroke="#a100ff" strokeWidth="3.8" strokeLinecap="square" strokeLinejoin="miter" />
        <text x="5" y="30" fill="#44177a" fontFamily="Arial, Helvetica, sans-serif" fontSize="24" fontWeight="700" letterSpacing="-1.15">accenture</text>
      </svg>
    </div>
  )
}
