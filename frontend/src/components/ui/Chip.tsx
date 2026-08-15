import type { ReactNode } from 'react'

interface ChipProps {
  selected?: boolean
  disabled?: boolean
  /** HU-08 — `'pasado'` dice que este chip elige un momento que ya ocurrió, para que a
   * Ariel no se le mezcle con lo que viene. Cambia el color y **no la interacción**: se
   * toca igual que cualquier otro, que es justo el punto del cambio.
   *
   * El flujo del cliente nunca lo pasa, así que su grilla se dibuja igual que siempre. */
  tono?: 'normal' | 'pasado'
  title?: string
  onClick?: () => void
  children: ReactNode
}

export function Chip({
  selected,
  disabled,
  tono = 'normal',
  title,
  onClick,
  children,
}: ChipProps) {
  // `disabled` gana sobre todo: un chip que no se puede tocar no necesita decir además
  // cuándo era.
  const estilo = disabled
    ? 'border-borde text-tinta-tenue cursor-not-allowed line-through opacity-60'
    : tono === 'pasado'
      ? selected
        ? 'border-alerta bg-alerta text-superficie'
        : 'border-alerta text-alerta bg-alerta-suave hover:border-alerta'
      : selected
        ? 'border-miel bg-miel text-superficie'
        : 'border-borde text-tinta hover:border-miel'

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={['rounded-full border px-3 py-1.5 text-sm transition', estilo].join(
        ' ',
      )}
    >
      {children}
    </button>
  )
}
