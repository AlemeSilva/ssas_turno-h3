import { useRef, useCallback } from 'react'

/**
 * Hook para debounce de callbacks críticos — previne múltiplas submissões
 * acidentais em clicks rápidos. Delay mínimo de 500ms.
 */
export function useDebounce<T extends (...args: any[]) => any>(callback: T, delayMs: number = 500) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isProcessingRef = useRef(false)

  return useCallback(
    ((...args: any[]) => {
      // Se já está processando, ignora novo click
      if (isProcessingRef.current) return

      isProcessingRef.current = true

      // Limpar timeout anterior se existir
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      // Executar callback
      const result = callback(...args)

      // Reset após delay
      timeoutRef.current = setTimeout(() => {
        isProcessingRef.current = false
      }, delayMs)

      return result
    }) as T,
    [callback, delayMs]
  )
}
