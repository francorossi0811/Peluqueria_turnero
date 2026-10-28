import { useEffect, useState } from 'react'
import { DIAS_CORTOS, diaSemana, hoyIso, sumarDias } from '../utils/fecha'
import type { DisponibilidadDia } from '../types/api'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** `"YYYY-MM"` de una fecha ISO. Se trabaja con strings y no con `Date` por lo mismo que
 * el resto de `utils/fecha.ts`: `YYYY-MM-DD` se parsea en UTC y en Argentina correría el
 * borde un día. */
function mesDe(fechaIso: string): string {
  return fechaIso.slice(0, 7)
}

function mesSumado(mes: string, cantidad: number): string {
  const [anio, numero] = mes.split('-').map(Number)
  const total = anio * 12 + (numero - 1) + cantidad
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** Los días del mes, en orden. */
function diasDelMes(mes: string): string[] {
  const dias: string[] = []
  for (let d = `${mes}-01`; mesDe(d) === mes; d = sumarDias(d, 1)) dias.push(d)
  return dias
}

interface CalendarioMesProps {
  dias: DisponibilidadDia[]
  fecha: string | null
  onElegirFecha: (fecha: string) => void
  /** El texto de por qué un día no tiene lugar, para el `title` de su casilla. */
  motivoDelDia: (dia: DisponibilidadDia) => string
}

/** El selector de día del cliente, como un calendario de un mes (pedido de Franco,
 * 27/10/2026): con 30 días la fila de botones de antes ocupaba unas siete filas en el
 * celular antes de llegar a los horarios.
 *
 * Los 30 días casi siempre caen en dos meses, de ahí las flechas. Se ve el mes del día
 * elegido, y si el día elegido cambia de mes —el "Ver ese día" del cartel de día lleno—
 * el calendario lo sigue.
 *
 * Igual que la fila de botones, **se ven todos los días**: los que no tienen lugar quedan
 * en gris pero se pueden tocar para leer por qué. Los que caen fuera de los 30 días no se
 * pueden tocar: no hay nada que decir de ellos. */
export function CalendarioMes({
  dias,
  fecha,
  onElegirFecha,
  motivoDelDia,
}: CalendarioMesProps) {
  const primerMes = mesDe(dias[0].fecha)
  const ultimoMes = mesDe(dias[dias.length - 1].fecha)
  const [mes, setMes] = useState(mesDe(fecha ?? dias[0].fecha))

  useEffect(() => {
    if (fecha) setMes(mesDe(fecha))
  }, [fecha])

  const porFecha = new Map(dias.map((d) => [d.fecha, d]))
  const delMes = diasDelMes(mes)
  const hoy = hoyIso()
  const [anio, numero] = mes.split('-').map(Number)

  const botonFlecha =
    'text-tinta border-borde hover:border-miel flex h-9 w-9 items-center justify-center rounded-full border text-lg transition disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-borde'

  return (
    <div className="mb-4 max-w-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-tinta font-semibold">
          {MESES[numero - 1]} {anio}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Mes anterior"
            disabled={mes <= primerMes}
            onClick={() => setMes(mesSumado(mes, -1))}
            className={botonFlecha}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={mes >= ultimoMes}
            onClick={() => setMes(mesSumado(mes, 1))}
            className={botonFlecha}
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_CORTOS.map((d) => (
          <p key={d} className="text-tinta-tenue pb-1 text-xs">
            {d}
          </p>
        ))}

        {/* Casillas vacías hasta el día de la semana en que arranca el mes. */}
        {Array.from({ length: diaSemana(delMes[0]) }, (_, i) => (
          <span key={`vacio-${i}`} />
        ))}

        {delMes.map((iso) => {
          const dia = porFecha.get(iso)
          const numeroDia = Number(iso.slice(8))
          const esHoy = iso === hoy

          if (!dia) {
            return (
              <span
                key={iso}
                className="text-borde flex aspect-square items-center justify-center text-sm"
              >
                {numeroDia}
              </span>
            )
          }

          const conLugar = dia.horarios.length > 0
          const elegido = iso === fecha
          const estilo = elegido
            ? conLugar
              ? 'border-miel bg-miel text-superficie font-semibold'
              : 'border-tinta-tenue bg-superficie-2 text-tinta-suave'
            : conLugar
              ? 'border-borde text-tinta hover:border-miel font-medium'
              : 'border-transparent text-tinta-tenue hover:border-borde-suave'

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onElegirFecha(iso)}
              title={conLugar ? undefined : motivoDelDia(dia)}
              aria-pressed={elegido}
              className={`relative flex aspect-square items-center justify-center rounded-lg border text-sm transition ${estilo}`}
            >
              {numeroDia}
              {/* Hoy, marcado con un punto para no competir con el día elegido. */}
              {esHoy && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${elegido && conLugar ? 'bg-superficie' : 'bg-miel'}`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
