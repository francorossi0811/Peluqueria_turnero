import type { ReactNode } from 'react'

// Badge chico usado como "etiqueta de sección" en la landing y en el wizard de
// reserva — mismo estilo que el diseño de Claude (Turnos.dc.html / Peluqueria
// Ariel Enrique.dc.html).
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="bg-kicker-fondo text-kicker-texto mb-3 inline-block rounded px-2.5 py-1 text-xs font-medium tracking-wider uppercase">
      {children}
    </span>
  )
}
