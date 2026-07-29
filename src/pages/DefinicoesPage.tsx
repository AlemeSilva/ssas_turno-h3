import { useState, type CSSProperties, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useCadeiasCatalogo } from '../data/useCadeiasCatalogo'
import { useAuth } from '../auth/AuthContext'
import type { CategoriaCadeia } from '../types/database'

const ROTULO_CATEGORIA: Record<CategoriaCadeia, string> = {
  NORMAL: 'Normal',
  ASTERISCO: '* (cópia automática para Cloud)',
  DUPLO_ASTERISCO: '** (input AML/MAB)',
}

export function DefinicoesPage() {
  const { ehGerenteOuDelegado } = useAuth()
  const { catalogo, dependenciasGirFl, aCarregar } = useCadeiasCatalogo()
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<CategoriaCadeia>('NORMAL')
  const [erro, setErro] = useState<string | null>(null)

  if (!ehGerenteOuDelegado) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-secondary)' }}>Esta área é reservada ao Gerente.</p>
      </div>
    )
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) return
    const proximaOrdem = catalogo.length > 0 ? Math.max(...catalogo.map((c) => c.ordem)) + 1 : 1
    const { error } = await supabase
      .from('cadeias_catalogo')
      .insert({ nome_cadeia: nome.trim().toUpperCase(), categoria, ordem: proximaOrdem, ativo: true })
    if (error) {
      setErro(error.message)
    } else {
      setNome('')
      setCategoria('NORMAL')
    }
  }

  async function alternarAtivo(nomeCadeia: string, ativo: boolean) {
    await supabase.from('cadeias_catalogo').update({ ativo: !ativo }).eq('nome_cadeia', nomeCadeia)
  }

  async function alternarDependenciaGirFl(nomeCadeia: string, incluida: boolean) {
    if (incluida) {
      await supabase.from('gir_fl_dependencias').delete().eq('nome_cadeia', nomeCadeia)
    } else {
      await supabase.from('gir_fl_dependencias').insert({ nome_cadeia: nomeCadeia })
    }
  }

  if (aCarregar) return <div className="card">A carregar…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Gestão de Cadeias</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Adicionar ou desativar uma cadeia da matriz de acompanhamento diário — situação pouco
          frequente, mas suportada sem alterações de código. Uma cadeia com histórico registado
          nunca é apagada, só desativada: deixa de entrar em novos planos, mas os registos
          antigos mantêm-se intactos para auditoria.
        </p>

        <form onSubmit={adicionar} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            Nome da cadeia
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: SD_NOVA" />
          </label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaCadeia)}>
              <option value="NORMAL">Normal</option>
              <option value="ASTERISCO">* (cópia automática para Cloud)</option>
              <option value="DUPLO_ASTERISCO">** (input AML/MAB)</option>
            </select>
          </label>
          <button className="btn btn-secondary" type="submit">
            Adicionar cadeia
          </button>
        </form>
        {erro && <div className="badge badge-vermelho" style={{ display: 'block', marginBottom: '1rem' }}>{erro}</div>}

        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th()}>Cadeia</th>
              <th style={th()}>Categoria</th>
              <th style={th()}>Dependência GIR_FL (22h)</th>
              <th style={th()}>Estado</th>
              <th style={th()} />
            </tr>
          </thead>
          <tbody>
            {catalogo.map((c) => {
              const incluidaGirFl = dependenciasGirFl.includes(c.nome_cadeia)
              const eOProprioGirFl = c.nome_cadeia === 'GIR_FL'
              return (
                <tr key={c.nome_cadeia}>
                  <td style={td()}>{c.nome_cadeia}</td>
                  <td style={td()}>{ROTULO_CATEGORIA[c.categoria]}</td>
                  <td style={td()}>
                    {!eOProprioGirFl && (
                      <button
                        className={incluidaGirFl ? 'btn btn-secondary' : 'btn btn-ghost'}
                        style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
                        onClick={() => alternarDependenciaGirFl(c.nome_cadeia, incluidaGirFl)}
                      >
                        {incluidaGirFl ? 'Incluída' : 'Não incluída'}
                      </button>
                    )}
                  </td>
                  <td style={td()}>
                    <span className={c.ativo ? 'badge badge-verde' : 'badge badge-neutro'}>{c.ativo ? 'Ativa' : 'Desativada'}</span>
                  </td>
                  <td style={td()}>
                    <button className="btn btn-ghost" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }} onClick={() => alternarAtivo(c.nome_cadeia, c.ativo)}>
                      {c.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function th(): CSSProperties {
  return { textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }
}

function td(): CSSProperties {
  return { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)' }
}
