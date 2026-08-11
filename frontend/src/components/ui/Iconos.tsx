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

/** Clientes — dos personas. Se distingue de "Mi cuenta" en que hay más de una: es la
 * diferencia entre mi cuenta y la gente que atiendo. */
export function IconoClientes({ className = 'h-[18px] w-[18px]' }: PropsIcono) {
  return (
    <svg {...COMUNES} className={className}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3.25 3.25 0 0 1 0 6M17.5 14.2a6.5 6.5 0 0 1 4 5.3" />
    </svg>
  )
}

/** Cobros — billete. La metáfora es la plata en sí y no un gráfico de barras: la sección
 * es sobre lo que entró, y los totales son la lectura, no el objeto (HU-27). */
export function IconoCobros({ className = 'h-[18px] w-[18px]' }: PropsIcono) {
  return (
    <svg {...COMUNES} className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  )
}

/** Administradores — llave. Es la sección de quién puede entrar (HU-26), así que la
 * metáfora es el acceso y no las personas: "Clientes" ya usa el ícono de gente. */
export function IconoLlave({ className = 'h-[18px] w-[18px]' }: PropsIcono) {
  return (
    <svg {...COMUNES} className={className}>
      <circle cx="8" cy="8" r="4" />
      <path d="M10.8 10.8 20 20M17 17l-2 2M20 14l-2 2" />
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
