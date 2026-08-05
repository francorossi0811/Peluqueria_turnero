// HU-18 — Alta y baja de las notificaciones push del panel de Ariel.

/** La clave VAPID viene en base64url; `applicationServerKey` espera bytes crudos.
 *
 * Se construye sobre un `ArrayBuffer` explícito (y no con `new Uint8Array(largo)`)
 * porque el tipo por defecto es `ArrayBufferLike`, que incluye `SharedArrayBuffer` y no
 * satisface lo que pide `applicationServerKey`. */
export function base64UrlABytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const conPadding = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  )
  const binario = atob(conPadding)
  const bytes = new Uint8Array(new ArrayBuffer(binario.length))
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export function soportaPush(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function esIOS(): boolean {
  // iPadOS moderno se presenta como Mac con pantalla táctil, de ahí el segundo chequeo.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** En iPhone, el push solo funciona si el sitio está instalado en la pantalla de inicio
 * — desde una pestaña normal de Safari no hay forma. Esto detecta si ya está instalado. */
export function estaInstaladaComoApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari en iOS no soporta display-mode, usa esta propiedad propia.
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export function permisoActual(): NotificationPermission | null {
  return soportaPush() ? Notification.permission : null
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js')
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportaPush()) return null
  const registro = await navigator.serviceWorker.getRegistration()
  return (await registro?.pushManager.getSubscription()) ?? null
}

/** Pide permiso para notificar.
 *
 * **Tiene que ser lo primero que corra en el handler del click, sin ningún `await`
 * antes.** El navegador solo acepta este pedido mientras siga vigente la "activación
 * transitoria" que otorga al tocar un botón, y esperar una respuesta de red o el
 * registro del service worker la consume.
 *
 * Chrome es permisivo y lo acepta igual, así que un orden equivocado funciona en Android
 * y falla **solo en iPhone**: Safari lo rechaza sin siquiera mostrar el diálogo, lo que
 * se ve como "el botón no hace nada". Por eso esto está separado de `crearSuscripcion`,
 * que sí necesita esperar a la red. */
export async function pedirPermiso(): Promise<NotificationPermission> {
  return Notification.requestPermission()
}

/** Crea la suscripción. Llamar solo después de que `pedirPermiso` devolvió 'granted'. */
export async function crearSuscripcion(
  clavePublica: string,
): Promise<PushSubscriptionJSON> {
  const registro = await registrarServiceWorker()
  await navigator.serviceWorker.ready

  const suscripcion = await registro.pushManager.subscribe({
    // Obligatorio en Chrome: no se admiten pushes sin payload visible para el usuario.
    userVisibleOnly: true,
    applicationServerKey: base64UrlABytes(clavePublica),
  })

  return suscripcion.toJSON()
}

/** Da de baja en el navegador. Borrarla del backend es responsabilidad del llamador. */
export async function desuscribirse(): Promise<string | null> {
  const suscripcion = await suscripcionActual()
  if (!suscripcion) return null
  const endpoint = suscripcion.endpoint
  await suscripcion.unsubscribe()
  return endpoint
}
