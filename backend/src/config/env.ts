// Único lugar donde nos apartamos de la convención `process.env.X ?? fallback` que usa
// el resto del backend, y por un motivo concreto: un JWT_SECRET vacío no rompe nada de
// forma visible — firma y verifica tokens usando la cadena vacía como secreto, así que
// cualquiera que sepa eso puede emitir un token de admin válido. Preferimos morir en el
// arranque antes que servir con un secreto vacío.
//
// DATABASE_URL no está acá a propósito: ya falla ruidosamente en la primera query.
// PORT tampoco: su `?? 3000` es un default legítimo.

/** Lanza si falta JWT_SECRET. Es perezosa (no se evalúa al importar el módulo) para que
 * los tests puedan importar auth.service.ts sin necesidad de un .env cargado. */
export function jwtSecret(): string {
  const valor = process.env.JWT_SECRET
  if (!valor) {
    throw new Error(
      'Falta la variable de entorno JWT_SECRET. Sin ella los tokens del panel de ' +
        'admin se firmarían con un secreto vacío. Ver backend/.env.example.',
    )
  }
  return valor
}

export interface ConfigVapid {
  publicKey: string
  privateKey: string
  subject: string
}

// Las claves VAPID son un par de curva P-256 en base64url: la pública es un punto sin
// comprimir (1 byte de prefijo + 32 de X + 32 de Y = 65) y la privada es el escalar (32).
const BYTES_CLAVE_PUBLICA = 65
const BYTES_CLAVE_PRIVADA = 32

function bytesDeBase64Url(valor: string): number {
  try {
    return Buffer.from(valor.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      .length
  } catch {
    return -1
  }
}

/** Valida el largo de una clave VAPID.
 *
 * Existe porque una clave mal pegada no rompe el arranque: `web-push` recién la valida
 * al enviar el primer aviso, y como los avisos son fire-and-forget con su propio
 * `catch`, el error queda enterrado en los logs y el push simplemente nunca llega. Pasó
 * en producción — la clave pública se había pegado cortada — y no se detectó hasta
 * revisar los logs a mano. Mejor no arrancar. */
function validarClaveVapid(
  nombre: string,
  valor: string,
  bytesEsperados: number,
): void {
  const bytes = bytesDeBase64Url(valor)
  if (bytes === bytesEsperados) return

  throw new Error(
    `${nombre} inválida: decodifica a ${bytes < 0 ? 'algo que no es base64url' : bytes + ' bytes'}, ` +
      `se esperaban ${bytesEsperados}. Suele ser un copiado incompleto o las dos claves ` +
      `cruzadas — la pública tiene 87 caracteres y la privada 43. Generá un par nuevo ` +
      `con \`npx web-push generate-vapid-keys\`.`,
  )
}

/** Configuración de Web Push (HU-18), o `null` si no está configurada.
 *
 * Es opcional a propósito: el aviso dentro del panel (HU-17) no depende del push, así
 * que la app tiene que poder correr sin claves VAPID — en desarrollo, o si Ariel nunca
 * activa las notificaciones. */
export function configVapid(): ConfigVapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKey && !privateKey && !subject) return null
  if (!publicKey || !privateKey || !subject) {
    // Configurada a medias es casi siempre un error de deploy, no una decisión: mejor
    // avisar fuerte que quedar con un push que falla en silencio.
    throw new Error(
      'Configuración de Web Push incompleta: hacen falta VAPID_PUBLIC_KEY, ' +
        'VAPID_PRIVATE_KEY y VAPID_SUBJECT juntas (o ninguna de las tres). ' +
        'Ver backend/.env.example.',
    )
  }

  validarClaveVapid('VAPID_PUBLIC_KEY', publicKey, BYTES_CLAVE_PUBLICA)
  validarClaveVapid('VAPID_PRIVATE_KEY', privateKey, BYTES_CLAVE_PRIVADA)

  return { publicKey, privateKey, subject }
}

/** URL pública del frontend, para armar links en los mails (HU-19). Sin barra final. */
export function frontendUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(
    /\/$/,
    '',
  )
}

export interface ConfigWhatsapp {
  /** `null` cuando no hay credenciales: se usa el adaptador de consola. */
  token: string | null
  phoneNumberId: string | null
  plantillaConfirmado: string
  plantillaReprogramado: string
  /** Son **dos** plantillas y no una: ver `TipoAviso` en notificaciones.service. */
  plantillaCanceladoCliente: string
  plantillaCanceladoNegocio: string
  idioma: string
  version: string
}

/** Configuración de WhatsApp (HU-21).
 *
 * A diferencia de `configVapid()`, esta **nunca devuelve `null`**: los nombres de
 * plantilla y el idioma hacen falta igual cuando no hay credenciales, porque el adaptador
 * de consola los imprime. Lo que dice si hay canal real es `token`.
 *
 * Que se pueda correr sin credenciales es a propósito, por el mismo motivo que el mail:
 * reservar no puede depender de que un proveedor externo esté configurado.
 *
 * El criterio todo-o-nada sobre las dos credenciales sí es el de `configVapid()`: media
 * configuración es casi siempre un error de deploy, no una decisión, y sin este chequeo
 * quedaría un canal que falla en silencio. */
export function configWhatsapp(): ConfigWhatsapp {
  const token = process.env.WHATSAPP_TOKEN || null
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || null

  if (Boolean(token) !== Boolean(phoneNumberId)) {
    throw new Error(
      'Configuración de WhatsApp incompleta: hacen falta WHATSAPP_TOKEN y ' +
        'WHATSAPP_PHONE_NUMBER_ID juntas (o ninguna de las dos). ' +
        'Ver backend/.env.example.',
    )
  }

  return {
    token,
    phoneNumberId,
    // ⚠️ `_v2` no es un typo: el nombre `turno_confirmado` quedó bloqueado del lado de
    // Meta al borrar la plantilla anterior para editarle una palabra. Ver
    // Docs/plantillas-whatsapp.md — una plantilla se edita, no se borra y se recrea.
    plantillaConfirmado:
      process.env.WHATSAPP_PLANTILLA_CONFIRMADO || 'turno_confirmado_v2',
    plantillaReprogramado:
      process.env.WHATSAPP_PLANTILLA_REPROGRAMADO || 'turno_reprogramado',
    plantillaCanceladoCliente:
      process.env.WHATSAPP_PLANTILLA_CANCELADO_CLIENTE ||
      'turno_cancelado_cliente',
    plantillaCanceladoNegocio:
      process.env.WHATSAPP_PLANTILLA_CANCELADO_NEGOCIO ||
      'turno_cancelado_negocio',
    idioma: process.env.WHATSAPP_IDIOMA || 'es_AR',
    version: process.env.WHATSAPP_API_VERSION || 'v23.0',
  }
}

/** Se llama una sola vez desde server.ts, antes de escuchar. Mejor que el deploy falle
 * con un mensaje claro a que el backend levante mal configurado. */
export function validarEnvAlArrancar(): void {
  jwtSecret()
  configVapid()
  configWhatsapp()
}
