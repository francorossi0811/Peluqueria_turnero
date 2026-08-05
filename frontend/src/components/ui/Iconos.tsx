// Íconos del nav del panel, escritos a mano.
//
// Sin librería de íconos a propósito: son tres, de trazo simple, y cualquier paquete
// del rubro pesa más que esto. Todos heredan el color del texto (`currentColor`), así
// que el estado activo/inactivo del nav los pinta solo, sin variantes.

interface PropsIcono {
  className?: string
}

const COMUNES = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Agenda — hoja de calendario. */
export function IconoAgenda({ className = 'h-[18px] w-[18px]' }: PropsIcono) {
  return (
    <svg {...COMUNES} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

/** Horarios y servicios — reloj. */
export function IconoReloj({ className = 'h-[18px] w-[18px]' }: PropsIcono) {
  return (
    <svg {...COMUNES} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

/** Mi cuenta — persona. */
export function IconoPersona({ className = 'h-[18px] w-[18px]' }: PropsIcono) {
  return (
    <svg {...COMUNES} className={className}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}
