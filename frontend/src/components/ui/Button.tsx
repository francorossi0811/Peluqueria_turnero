import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'primaryVino' | 'outline' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const estilosPorVariante: Record<Variant, string> = {
  primary: 'border border-miel text-miel hover:bg-miel/10 active:bg-miel/20',
  // Sin distinción visual de `primary` — `vino` ya no es un acento propio.
  primaryVino: 'border border-miel text-miel hover:bg-miel/10 active:bg-miel/20',
  outline: 'border border-borde text-tinta hover:bg-superficie-2',
  ghost: 'text-tinta-suave hover:text-tinta',
  danger: 'border border-vino text-vino hover:bg-vino-suave',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-md px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${estilosPorVariante[variant]} ${className}`}
      {...props}
    />
  )
}
