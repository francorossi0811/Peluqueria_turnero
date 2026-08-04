import type { ReactNode } from 'react'

// Badge chico usado como "etiqueta de sección" en la landing y en el wizard de
// reserva — mismo estilo que el diseño de Claude (Turnos.dc.html / Peluqueria
// Ariel Enrique.dc.html).
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="mb-3 inline-block rounded bg-[#5a3b0a] px-2.5 py-1 text-xs font-medium tracking-wider text-white uppercase">
      {children}
    </span>
  )
}
