import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcularProximoAlerta } from '../lib/alertas'
import { semanaRefDe, paraISO } from '../lib/datas'

export function AlertBar() {
  const [agora, setAgora] = useState(new Date())
  const [online, setOnline] = useState(navigator.onLine)
  const [ehManutencao, setEhManutencao] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    const dataInicioCiclo = paraISO(semanaRefDe(new Date()))
    supabase
      .from('planos')
      .select('tipo_fim_semana')
      .eq('data_inicio_ciclo', dataInicioCiclo)
      .maybeSingle()
      .then(({ data }) => setEhManutencao((data as { tipo_fim_semana?: string } | null)?.tipo_fim_semana === 'MANUTENCAO'))
  }, [])

  const proximo = calcularProximoAlerta(agora, ehManutencao)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 1.25rem',
        background: 'var(--bg-surface-raised)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span className={proximo ? 'badge badge-amarelo' : 'badge badge-neutro'}>
          {proximo ? 'Próximo alerta' : 'Sem alertas agendados'}
        </span>
        {proximo && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {proximo.rotulo} às {proximo.horario} · em {proximo.minutosRestantes} min
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className={online ? 'badge badge-verde' : 'badge badge-vermelho'}>
          {online ? 'Rede OK' : 'Sem rede'}
        </span>
      </div>
    </div>
  )
}
