import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'primaryVino' | 'outline' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const estilosPorVariante: Record<Variant, string> = {
  primary: 'bg-miel text-superficie hover:opacity-90',
  // Acción principal del panel de admin (acento vino en vez de miel).
  primaryVino: 'bg-vino text-superficie hover:opacity-90',
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
