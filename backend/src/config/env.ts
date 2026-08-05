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
  return { publicKey, privateKey, subject }
}

/** URL pública del frontend, para armar links en los mails (HU-19). Sin barra final. */
export function frontendUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '')
}

/** Se llama una sola vez desde server.ts, antes de escuchar. Mejor que el deploy falle
 * con un mensaje claro a que el backend levante mal configurado. */
export function validarEnvAlArrancar(): void {
  jwtSecret()
  configVapid()
}
