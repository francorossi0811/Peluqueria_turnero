// Fuente de feriados: Nager.Date (https://date.nager.at), API pública y gratuita, sin
// registro ni API key.
//
// Se eligió sobre las alternativas por tres motivos concretos: devuelve `localName` en
// español (así el feriado se muestra con el nombre que la gente usa, no traducido), tiene
// los años futuros cargados con anticipación —2027 ya responde— y es un GET sin
// credenciales, así que lo cubre el `fetch` nativo de Node sin sumar dependencias.
//
// Limitación conocida: trae los feriados nacionales, no los "días no laborables con fines
// turísticos" que el gobierno decreta año a año. Por eso existe el botón de resincronizar
// en el panel, y por eso Ariel puede editar la modalidad de cada uno a mano.

const URL_BASE = 'https://date.nager.at/api/v3/PublicHolidays'
const PAIS = 'AR'

/** La forma de la respuesta de Nager, recortada a lo que usamos. */
interface FeriadoNager {
  date: string
  localName?: string | null
  name?: string | null
}

export interface FeriadoImportado {
  fecha: Date
  nombre: string
}

export const FUENTE = 'nager.date'

/** Función pura — traduce la respuesta de Nager a filas de `feriados`.
 *
 * Separada del fetch para poder testear el mapeo sin red, que es donde están las
 * decisiones: cuál de los dos nombres gana y cómo se ancla la fecha. */
export function mapearFeriados(datos: unknown): FeriadoImportado[] {
  if (!Array.isArray(datos)) return []

  const feriados: FeriadoImportado[] = []

  for (const crudo of datos as FeriadoNager[]) {
    // `localName` es el nombre en español ("Día del Trabajador"); `name` es el inglés
    // ("Labour Day"). Preferimos el local: es el que Ariel y sus clientes reconocen.
    const nombre = crudo?.localName?.trim() || crudo?.name?.trim()
    if (!crudo?.date || !nombre) continue

    // Anclada a medianoche UTC, igual que el resto de las fechas del proyecto: la columna
    // es `DATE` y compararla contra un Date con hora local desplazaría el día.
    const [anio, mes, dia] = crudo.date.split('-').map(Number)
    if (!anio || !mes || !dia) continue

    feriados.push({ fecha: new Date(Date.UTC(anio, mes - 1, dia)), nombre })
  }

  return feriados
}

/** Trae los feriados de un año. Lanza si la API falla — el llamador decide qué hacer,
 * y en el arranque eso es loguear y seguir. */
export async function obtenerFeriadosDelAnio(
  anio: number,
): Promise<FeriadoImportado[]> {
  const res = await fetch(`${URL_BASE}/${anio}/${PAIS}`)

  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    throw new Error(
      `Nager.Date respondió ${res.status}: ${detalle.slice(0, 200)}`,
    )
  }

  return mapearFeriados(await res.json())
}
