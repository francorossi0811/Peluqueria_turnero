import type { ReactNode } from 'react'

interface ChipProps {
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}

export function Chip({ selected, disabled, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-sm transition',
        disabled
          ? 'border-borde text-tinta-tenue cursor-not-allowed line-through opacity-60'
          : selected
            ? 'border-miel bg-miel text-superficie'
            : 'border-borde text-tinta hover:border-miel',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
