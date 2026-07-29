import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { AlertBar } from './AlertBar'
import { useAuth } from '../auth/AuthContext'

const ABAS = [
  { to: '/plano', label: 'Plano de Fim de Semana' },
  { to: '/checklist', label: 'Checklist Ativo' },
  { to: '/escala', label: 'Escala do Mês' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/historico', label: 'Histórico' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { usuario, ehGerenteOuDelegado, signOut } = useAuth()
  const abas = ehGerenteOuDelegado ? [...ABAS, { to: '/definicoes', label: 'Definições' }] : ABAS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AlertBar />

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <LockMark />
          <div>
            <div style={{ fontWeight: 700 }}>Turno H3</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Accenture · Banco Montepio</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '0.3rem' }}>
          {abas.map((aba) => (
            <NavLink
              key={aba.to}
              to={aba.to}
              style={({ isActive }) => ({
                padding: '0.5rem 0.9rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.83rem',
                fontWeight: 600,
                color: isActive ? '#fff' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                textDecoration: 'none',
              })}
            >
              {aba.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{usuario?.nome ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {usuario?.perfil}
              {ehGerenteOuDelegado && usuario?.perfil !== 'GERENTE' ? ' · substituto do Gerente' : ''}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => signOut()}>
            Sair
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>{children}</main>
    </div>
  )
}

function LockMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="var(--bg-surface-raised)" />
      <path d="M11 15v-3a5 5 0 0 1 10 0v3" fill="none" stroke="var(--accent-primary)" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="9" y="15" width="14" height="11" rx="2.5" fill="var(--accent-secondary)" />
    </svg>
  )
}
