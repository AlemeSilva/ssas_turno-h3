import { useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useUsuarios } from '../data/useUsuarios'
import { useResumoUsuario, LIMITE_FERIAS_ANUAL } from '../data/useResumoUsuario'
import { useResumoGerente } from '../data/useResumoGerente'
import { HORARIO_TURNO } from '../lib/gerarRelatorioSemanal'
import { adicionarDias, agora, ehFimDeSemana, formatarDataPT, paraISO, proximaSextaISO } from '../lib/datas'
import type { Ferias, TurnoTipo } from '../types/database'

function CartaoResumo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {rotulo}
      </div>
      {children}
    </div>
  )
}

function valorGrandeStyle(): CSSProperties {
  return { fontSize: '2.6rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }
}

/** Turno a mostrar para um dia específico, respeitando a convenção de
 * fim de semana (só o H3 trabalha aos sábados/domingos). */
function valorTurnoDoDia(turno: TurnoTipo | null, diaISO: string): { valor: string; detalhe?: string } {
  if (turno === null) return { valor: '—' }
  if (ehFimDeSemana(diaISO) && turno !== 'H3') return { valor: 'Fim de semana' }
  return { valor: turno, detalhe: HORARIO_TURNO[turno] }
}

export function InicioPage() {
  const { usuario, ehGerenteOuDelegado } = useAuth()
  const { usuarios } = useUsuarios()
  const resumo = useResumoUsuario(usuario?.id)
  const gerente = useResumoGerente(ehGerenteOuDelegado)
  const [aConfirmar, setAConfirmar] = useState<number | null>(null)

  const hoje = agora()
  const hojeISO = paraISO(hoje)
  const proximaSexta = proximaSextaISO(hoje)
  const proximaQuinta = paraISO(adicionarDias(new Date(proximaSexta + 'T00:00:00'), 6))

  const nomeDe = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? id

  const totalFerias = resumo.feriasAprovadasDias + resumo.feriasPendentesDias
  const corBarraFerias =
    totalFerias >= LIMITE_FERIAS_ANUAL
      ? 'var(--status-vermelho)'
      : totalFerias >= LIMITE_FERIAS_ANUAL * 0.75
        ? 'var(--status-amarelo)'
        : 'var(--status-verde)'

  const turnoHoje = valorTurnoDoDia(resumo.turnoAtual, hojeISO)
  const turnoProxima = valorTurnoDoDia(resumo.turnoProximaSemana, proximaSexta)

  const feriadosFuturos = gerente.feriadosSemPlantao.filter((f) => f.data >= hojeISO)

  async function confirmar(feriasId: number) {
    if (!usuario) return
    setAConfirmar(feriasId)
    await gerente.confirmarSubstituicao(feriasId, usuario.id)
    setAConfirmar(null)
  }

  function LinhaAusencia({ f }: { f: Ferias }) {
    return (
      <li
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
          padding: '0.35rem 0',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span>
          {nomeDe(f.usuario_id)} · {formatarDataPT(f.data_inicio)} a {formatarDataPT(f.data_fim)}
        </span>
        {f.substituicao_confirmada ? (
          <span className="badge badge-verde">Substituto confirmado</span>
        ) : (
          <button
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
            onClick={() => confirmar(f.id)}
            disabled={aConfirmar === f.id}
          >
            {aConfirmar === f.id ? 'A confirmar…' : 'Confirmar substituto'}
          </button>
        )}
      </li>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Bem-vindo, {usuario?.nome ?? '—'}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        <CartaoResumo rotulo="Férias">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={valorGrandeStyle()}>{totalFerias}</span>
            <span style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>de {LIMITE_FERIAS_ANUAL} dias</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-surface-hover)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (totalFerias / LIMITE_FERIAS_ANUAL) * 100)}%`,
                background: corBarraFerias,
                borderRadius: 999,
              }}
            />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {resumo.feriasAprovadasDias} aprovados · {resumo.feriasPendentesDias} por aprovar
          </div>
        </CartaoResumo>

        <CartaoResumo rotulo="Turno atual">
          <div style={resumo.emFeriasHoje ? { ...valorGrandeStyle(), fontSize: '1.9rem' } : valorGrandeStyle()}>
            {resumo.emFeriasHoje ? 'Férias' : turnoHoje.valor}
          </div>
          {!resumo.emFeriasHoje && turnoHoje.detalhe && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{turnoHoje.detalhe}</div>
          )}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatarDataPT(hojeISO)}</div>
        </CartaoResumo>

        <CartaoResumo rotulo="Próxima semana">
          <div style={valorGrandeStyle()}>{turnoProxima.valor}</div>
          {turnoProxima.detalhe && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{turnoProxima.detalhe}</div>}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatarDataPT(proximaSexta)} a {formatarDataPT(proximaQuinta)}
          </div>
        </CartaoResumo>
      </div>

      {ehGerenteOuDelegado && (
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Visão do Gerente</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Feriados sem plantão confirmado</h3>
              {feriadosFuturos.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sem feriados pendentes este ano.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {feriadosFuturos.map((f) => (
                    <li
                      key={f.data}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem',
                        padding: '0.35rem 0',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>{f.nome}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{formatarDataPT(f.data)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>Ausências da equipa</h3>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Hoje
              </div>
              {gerente.ausenciasHoje.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0 }}>Ninguém ausente hoje.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
                  {gerente.ausenciasHoje.map((f) => (
                    <LinhaAusencia key={f.id} f={f} />
                  ))}
                </ul>
              )}

              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Próxima semana ({formatarDataPT(proximaSexta)} a {formatarDataPT(proximaQuinta)})
              </div>
              {gerente.ausenciasProximaSemana.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0 }}>Ninguém ausente.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {gerente.ausenciasProximaSemana.map((f) => (
                    <LinhaAusencia key={f.id} f={f} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
