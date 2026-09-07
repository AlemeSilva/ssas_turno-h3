import { useRef, useCallback } from 'react'

/**
 * Hook para debounce de callbacks críticos — previne múltiplas submissões
 * acidentais em clicks rápidos. Delay mínimo de 500ms.
 *
 * A trava é por chave (obterChave deriva-a dos argumentos de cada
 * chamada) — decidir o item A não pode bloquear silenciosamente decidir
 * o item B logo a seguir, só um duplo-clique no mesmo A. obterChave é
 * obrigatório (sem valor por omissão) precisamente para forçar cada
 * chamador a pensar em qual é a chave certa: quando o mesmo primeiro
 * argumento se repete para ações distintas (ex.: vários alertas do
 * mesmo tipo, cada um com o seu próprio identificador mais à frente),
 * uma chave por omissão errada reintroduz o mesmo bloqueio partilhado.
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number,
  obterChave: (...args: Parameters<T>) => unknown
) {
  const chavesEmProcessamentoRef = useRef<Set<unknown>>(new Set())

  return useCallback(
    ((...args: Parameters<T>) => {
      const chave = obterChave(...args)

      // Se esta chave já está a processar, ignora o novo clique
      if (chavesEmProcessamentoRef.current.has(chave)) return

      chavesEmProcessamentoRef.current.add(chave)

      const result = callback(...args)

      setTimeout(() => {
        chavesEmProcessamentoRef.current.delete(chave)
      }, delayMs)

      return result
    }) as T,
    [callback, delayMs, obterChave]
  )
}
