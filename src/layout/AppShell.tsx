import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { AlertBar } from './AlertBar'
import { useAuth } from '../auth/AuthContext'

const ABAS = [
  { to: '/inicio', label: 'Início' },
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
                color: isActive ? 'var(--text-on-accent)' : 'var(--text-secondary)',
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
    <svg width="28" height="28" viewBox="0 0 36 36" aria-hidden="true">
      {/* Quadrado âmbar Montepio */}
      <rect x="0" y="0" width="17" height="36" rx="5" fill="var(--montepio-orange)" />
      {/* Quadrado roxo Accenture */}
      <rect x="19" y="0" width="17" height="36" rx="5" fill="var(--accenture-purple)" />
      {/* Chevron ">" estilizado — referência ao logótipo Accenture, a branco sobre roxo */}
      <polyline
        points="23,11 30,18 23,25"
        fill="none"
        stroke="var(--text-on-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pássaro simplificado — bico apontado à esquerda, branco sobre âmbar */}
      <path
        d="M13,16 C10,14 5,15 4,17 C6,17 8,16.5 9,18 C10,19.5 12,20 14,19 C14,17.5 13,16 13,16 Z"
        fill="var(--text-on-accent)"
      />
    </svg>
  )
}
