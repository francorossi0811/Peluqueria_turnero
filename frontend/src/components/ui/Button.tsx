import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'primaryVino' | 'outline' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

// Tres niveles de énfasis, y la diferencia entre ellos tiene que verse de lejos: en la
// agenda conviven cuatro acciones por turno y antes todas pesaban igual.
//
// - `primary`: relleno sólido. La acción que Ariel quiere hacer en ese momento.
// - `outline`: fondo propio más claro que el crema de la página, con borde. Se despega
//   sin competir. Antes era transparente y se perdía sobre el fondo.
// - `ghost`: sin caja. Acciones de escape o poco frecuentes.
const estilosPorVariante: Record<Variant, string> = {
  primary:
    'bg-miel-fuerte text-sobre-acento border border-miel-fuerte hover:bg-miel active:bg-miel',
  // Alias histórico de `primary` — `vino` dejó de ser un acento propio.
  primaryVino:
    'bg-miel-fuerte text-sobre-acento border border-miel-fuerte hover:bg-miel active:bg-miel',
  outline: 'border border-borde bg-superficie text-tinta hover:bg-superficie-2',
  ghost: 'text-tinta-suave hover:bg-superficie-2 hover:text-tinta',
  danger: 'border border-borde bg-superficie text-vino hover:bg-vino-suave',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-md px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${estilosPorVariante[variant]} ${className}`}
      {...props}
    />
  )
}
