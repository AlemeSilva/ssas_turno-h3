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
  const [escolhendoPara, setEscolhendoPara] = useState<number | null>(null)
  const [aConfirmarPlantao, setAConfirmarPlantao] = useState<string | null>(null)
  const [escolhendoPlantaoPara, setEscolhendoPlantaoPara] = useState<string | null>(null)

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

  // Ao fim de semana o H3 já cobre o dia inteiro sozinho, como num fim
  // de semana comum — não há plantão a confirmar, por isso a lista só
  // mostra feriados em dias úteis.
  const feriadosFuturos = gerente.feriadosSemPlantao.filter((f) => f.data >= hojeISO && !ehFimDeSemana(f.data))

  async function escolherSubstituto(feriasId: number, substitutoId: string) {
    if (!usuario) return
    setAConfirmar(feriasId)
    await gerente.confirmarSubstituto(feriasId, substitutoId, usuario.id)
    setAConfirmar(null)
    setEscolhendoPara(null)
  }

  async function escolherPlantonista(dataFeriado: string, usuarioId: string) {
    setAConfirmarPlantao(dataFeriado)
    await gerente.confirmarPlantonista(dataFeriado, usuarioId)
    setAConfirmarPlantao(null)
    setEscolhendoPlantaoPara(null)
  }

  function LinhaFeriado({ f }: { f: { data: string; nome: string; tipo: string } }) {
    const aEscolher = escolhendoPlantaoPara === f.data
    const candidatos = usuarios.filter((u) => u.ativo)

    return (
      <li
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          padding: '0.35rem 0',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
          <span>
            {f.nome} · {formatarDataPT(f.data)}
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
            onClick={() => setEscolhendoPlantaoPara(aEscolher ? null : f.data)}
          >
            Confirmar plantonista
          </button>
        </div>
        {aEscolher && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingLeft: '0.25rem' }}>
            {candidatos.map((u) => (
              <button
                key={u.id}
                className="btn btn-ghost"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                onClick={() => escolherPlantonista(f.data, u.id)}
                disabled={aConfirmarPlantao === f.data}
              >
                {aConfirmarPlantao === f.data ? '…' : u.nome}
              </button>
            ))}
          </div>
        )}
      </li>
    )
  }

  function LinhaAusencia({ f }: { f: Ferias }) {
    const aEscolher = escolhendoPara === f.id
    const candidatos = usuarios.filter((u) => u.ativo && u.id !== f.usuario_id)

    return (
      <li
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          padding: '0.35rem 0',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <span>
            {nomeDe(f.usuario_id)} · {formatarDataPT(f.data_inicio)} a {formatarDataPT(f.data_fim)}
          </span>
          {f.substituicao_confirmada && f.substituto_id ? (
            <span className="badge badge-verde">Substituto: {nomeDe(f.substituto_id)}</span>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
              onClick={() => setEscolhendoPara(aEscolher ? null : f.id)}
            >
              Confirmar substituto
            </button>
          )}
        </div>
        {aEscolher && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingLeft: '0.25rem' }}>
            {candidatos.length === 0 ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sem candidatos disponíveis.</span>
            ) : (
              candidatos.map((u) => (
                <button
                  key={u.id}
                  className="btn btn-ghost"
                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                  onClick={() => escolherSubstituto(f.id, u.id)}
                  disabled={aConfirmar === f.id}
                >
                  {aConfirmar === f.id ? '…' : u.nome}
                </button>
              ))
            )}
          </div>
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
                    <LinhaFeriado key={f.data} f={f} />
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
