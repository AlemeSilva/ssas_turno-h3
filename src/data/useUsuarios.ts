import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types/database'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [aCarregar, setACarregar] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setACarregar(true)
      const { data } = await supabase.from('usuarios').select('*').order('nome')
      if (!cancelado) {
        setUsuarios((data as Usuario[]) ?? [])
        setACarregar(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [])

  return { usuarios, aCarregar }
}

export function usuariosH3Ativos(usuarios: Usuario[]) {
  return usuarios.filter((u) => u.perfil === 'OPERADOR_H3' && u.ativo)
}
