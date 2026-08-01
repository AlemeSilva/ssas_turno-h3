import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

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
    <div
      className="legacy-theme"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
      }}
    >
      <form onSubmit={handleSubmit} className="card" style={{ width: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <LockMark />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Turno H3</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Accenture · Banco Montepio
            </div>
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: '0.9rem' }}>
          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Email
          </span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '1.2rem' }}>
          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Palavra-passe
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>

        {erro && (
          <div className="badge badge-vermelho" style={{ display: 'flex', marginBottom: '1rem', width: '100%' }}>
            {erro}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={aEnviar} style={{ width: '100%', justifyContent: 'center' }}>
          {aEnviar ? 'A entrar…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function LockMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="var(--bg-surface-raised)" />
      <path d="M11 15v-3a5 5 0 0 1 10 0v3" fill="none" stroke="var(--accent-primary)" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="9" y="15" width="14" height="11" rx="2.5" fill="var(--accent-secondary)" />
    </svg>
  )
}
