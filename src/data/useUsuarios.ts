import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types/database'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [aCarregar, setACarregar] = useState(true)

  async function carregar() {
    setACarregar(true)
    const { data } = await supabase.from('usuarios').select('*').order('nome')
    setUsuarios((data as Usuario[]) ?? [])
    setACarregar(false)
  }

  useEffect(() => {
    let cancelado = false

    async function carregarInicial() {
      setACarregar(true)
      const { data } = await supabase.from('usuarios').select('*').order('nome')
      if (!cancelado) {
        setUsuarios((data as Usuario[]) ?? [])
        setACarregar(false)
      }
    }

    carregarInicial()
    return () => {
      cancelado = true
    }
  }, [])

  return { usuarios, aCarregar, recarregar: carregar }
}

export function usuariosH3Ativos(usuarios: Usuario[]) {
  return usuarios.filter((u) => u.perfil === 'OPERADOR_H3' && u.ativo)
}
