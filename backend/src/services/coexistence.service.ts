import { prisma } from '../config/prisma'
import { configWhatsapp } from '../config/env'

/** Los dos tipos de sincronización, en el orden en que Meta los pide. El orden importa:
 * `history` solo tiene sentido después de que el estado de la app se sincronizó. */
export const TIPOS_DE_SYNC = ['smb_app_state_sync', 'history'] as const
export type TipoDeSync = (typeof TIPOS_DE_SYNC)[number]

const HOST_GRAPH = 'https://graph.facebook.com'

/** Se intentó una sincronización que ya se había ejecutado (o intentado) antes. */
export class YaSincronizadoError extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje)
    this.name = 'YaSincronizadoError'
  }
}

/** Falló la llamada a Meta. La fila queda en `error` y el reintento queda bloqueado. */
export class SincronizacionFallidaError extends Error {
  constructor(
    readonly tipo: TipoDeSync,
    readonly detalle: string,
  ) {
    super(`La sincronización "${tipo}" falló: ${detalle}`)
    this.name = 'SincronizacionFallidaError'
  }
}

export interface ResultadoSync {
  syncType: TipoDeSync
  requestId: string | null
}

/** El cuerpo de cada POST. Función aparte y exportada para poder fijarlo con un test: el
 * valor de `sync_type` es lo único que distingue las dos llamadas, y equivocarlo no da un
 * error visible sino la sincronización que no era. */
export function cuerpoDeSync(tipo: TipoDeSync): {
  messaging_product: 'whatsapp'
  sync_type: TipoDeSync
} {
  return { messaging_product: 'whatsapp', sync_type: tipo }
}

/** HU-22 — Las dos llamadas de sincronización de Coexistence, en orden.
 *
 * ⚠️ **Cada una se puede ejecutar una sola vez en la vida del número**, y hay 24 horas de
 * plazo desde que el negocio terminó el Embedded Signup. Si una se repite o falla, Meta
 * obliga a desvincular y rehacer el flujo entero. Por eso esto **no corre solo** en ningún
 * arranque ni webhook: lo dispara una persona desde el panel y mira el resultado.
 *
 * ⚠️ La fila se inserta **antes** de llamar a Meta. Al revés —llamar y después registrar—
 * una caída en el medio dejaría la llamada hecha y sin rastro, y el próximo intento la
 * repetiría: el único desenlace sin arreglo. Insertando primero, el peor caso es una fila
 * marcada como usada sin `request_id`, que se resuelve con soporte de Meta.
 *
 * ⚠️ Si la primera falla, la segunda **no se ejecuta**: `history` sin el estado de la app
 * sincronizado no tiene sentido, y gastaría la única oportunidad de la segunda llamada. */
export async function sincronizarCoexistence(): Promise<ResultadoSync[]> {
  const config = configWhatsapp()
  if (!config.token || !config.phoneNumberId) {
    throw new SincronizacionFallidaError(
      'smb_app_state_sync',
      'no hay credenciales de WhatsApp configuradas (WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID).',
    )
  }

  const resultados: ResultadoSync[] = []

  for (const tipo of TIPOS_DE_SYNC) {
    resultados.push(
      await ejecutarUnaSync(tipo, {
        token: config.token,
        phoneNumberId: config.phoneNumberId,
        version: config.versionCoexistence,
      }),
    )
  }

  return resultados
}

async function ejecutarUnaSync(
  tipo: TipoDeSync,
  credenciales: { token: string; phoneNumberId: string; version: string },
): Promise<ResultadoSync> {
  await reservarLaUnicaOportunidad(tipo)

  const url = `${HOST_GRAPH}/${credenciales.version}/${credenciales.phoneNumberId}/smb_app_data`

  let res: Response
  let cuerpo: string
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credenciales.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpoDeSync(tipo)),
    })
    cuerpo = await res.text()
  } catch (err) {
    // Ni siquiera se pudo hablar con Meta. La fila queda en `error` igual: no hay forma de
    // saber si la llamada llegó del otro lado, y asumir que no llegó es justamente la
    // suposición que puede costar el reintento.
    const detalle = err instanceof Error ? err.message : String(err)
    await marcarError(tipo, `no se pudo llamar a Meta: ${detalle}`)
    throw new SincronizacionFallidaError(tipo, detalle)
  }

  // La respuesta completa, siempre, salga bien o mal: es lo que se le muestra a soporte.
  console.log(
    `[coexistence] ${tipo} → HTTP ${res.status} ${res.statusText} · respuesta: ${cuerpo}`,
  )

  if (!res.ok) {
    await marcarError(tipo, cuerpo)
    throw new SincronizacionFallidaError(tipo, `HTTP ${res.status} — ${cuerpo}`)
  }

  const requestId = leerRequestId(cuerpo)
  if (!requestId) {
    // Un 200 sin `request_id` es raro y hay que poder verlo: sin ese id, soporte de Meta no
    // puede rastrear la llamada. No se trata como error —la sincronización sí ocurrió— pero
    // queda dicho en el log y la fila guarda el cuerpo entero.
    console.warn(
      `[coexistence] ${tipo} respondió 200 pero sin request_id. Cuerpo: ${cuerpo}`,
    )
  }

  await prisma.coexistenceSincronizacion.update({
    where: { syncType: tipo },
    data: {
      estado: 'ok',
      requestId,
      respuesta: cuerpo,
      terminadoEn: new Date(),
    },
  })

  return { syncType: tipo, requestId }
}

/** Toma el turno de esta sincronización, o falla si ya lo tomó alguien.
 *
 * El que decide es el `@unique` de `sync_type`, no un `findFirst` seguido de un `if`: dos
 * requests simultáneos pasarían ese chequeo los dos y ejecutarían las dos llamadas. Es la
 * misma razón por la que la doble reserva de un turno se previene con un constraint. */
async function reservarLaUnicaOportunidad(tipo: TipoDeSync): Promise<void> {
  const yaExiste = await prisma.coexistenceSincronizacion.findUnique({
    where: { syncType: tipo },
  })

  if (yaExiste) throw new YaSincronizadoError(explicarPorQueNoSePuede(yaExiste))

  try {
    await prisma.coexistenceSincronizacion.create({ data: { syncType: tipo } })
  } catch {
    // Perdió la carrera contra otro request entre el `findUnique` y el `create`. El
    // constraint lo atajó, que es exactamente para lo que está.
    throw new YaSincronizadoError(
      `La sincronización "${tipo}" ya está en curso en otra ventana. No se puede ejecutar dos veces.`,
    )
  }
}

/** El mensaje del 409, escrito para alguien que va a leer esto una sola vez en su vida.
 *
 * ⚠️ Nombra la tabla y dice explícitamente que hay que borrar la fila a mano. Sin eso, el
 * que se cruce con una sincronización en `error` no tiene forma de saber que el reintento
 * está bloqueado a propósito ni cómo destrabarlo. */
function explicarPorQueNoSePuede(fila: {
  syncType: string
  estado: string
  requestId: string | null
  iniciadoEn: Date
}): string {
  const cuando = fila.iniciadoEn.toISOString()
  const base = `La sincronización "${fila.syncType}" ya se ejecutó el ${cuando} (estado: ${fila.estado}`
  const conId = fila.requestId ? `${base}, request_id: ${fila.requestId})` : `${base})`

  if (fila.estado === 'ok') {
    return (
      `${conId}. Cada llamada de Coexistence se puede hacer UNA sola vez: repetirla obliga ` +
      `a desvincular el número y rehacer todo el Embedded Signup, así que no se reintenta.`
    )
  }

  return (
    `${conId}. Quedó en un estado no exitoso y el reintento está bloqueado A PROPÓSITO: ` +
    `Meta permite esta llamada una sola vez, y repetirla obliga a desvincular el número y ` +
    `rehacer el Embedded Signup entero. Si confirmaste con soporte de Meta que la llamada ` +
    `NO llegó a procesarse, destrabalo borrando esta fila a mano de la tabla ` +
    `"coexistence_sincronizaciones" (DELETE FROM coexistence_sincronizaciones WHERE ` +
    `sync_type = '${fila.syncType}';) y volvé a ejecutar. No lo hagas sin esa confirmación.`
  )
}

async function marcarError(tipo: TipoDeSync, detalle: string): Promise<void> {
  await prisma.coexistenceSincronizacion.update({
    where: { syncType: tipo },
    data: { estado: 'error', respuesta: detalle, terminadoEn: new Date() },
  })
}

/** Saca el `request_id` de la respuesta sin romperse si el cuerpo no es lo que se espera.
 *
 * Meta lo devuelve en la raíz, pero esto corre una sola vez y no hay margen para que un
 * cambio de forma de la respuesta tire la operación entera: si no se encuentra, se sigue
 * con `null` y el cuerpo crudo queda guardado igual. */
function leerRequestId(cuerpo: string): string | null {
  try {
    const json: unknown = JSON.parse(cuerpo)
    if (typeof json !== 'object' || json === null) return null
    const id = (json as { request_id?: unknown }).request_id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

/** Lo que ya está registrado, para que el panel pueda mostrarlo sin volver a ejecutar nada. */
export async function estadoDeSincronizacion() {
  return prisma.coexistenceSincronizacion.findMany({
    orderBy: { iniciadoEn: 'asc' },
  })
}
