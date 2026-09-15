export type ToastType = 'success' | 'warning' | 'error'

export interface ToastDetail {
  type: ToastType
  title: string
  message: string
}

/**
 * Dispara um toast na UI. Usa CustomEvent para que qualquer módulo — inclusive
 * hooks fora da árvore React — possa notificar sem precisar de contexto.
 */
export function notify(type: ToastType, title: string, message: string): void {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>('devinspector:toast', {
      detail: { type, title, message }
    })
  )
}
