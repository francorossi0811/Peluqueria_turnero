// Service worker del panel de Ariel (HU-18).
//
// Vive en `public/` y no en `src/` porque Vite copia `public/` tal cual a la raíz del
// build: eso le da alcance sobre todo el sitio ("/"), que es lo que hace falta para
// recibir push. Un archivo procesado desde `src/` terminaría en /assets/ y solo tendría
// alcance sobre esa carpeta.
//
// A propósito NO cachea nada: no queremos que la app funcione offline (mostraría una
// agenda desactualizada, que es peor que no mostrar nada). Solo recibe notificaciones.
//
// La URL de la API llega como query string al registrarlo (`/sw.js?api=...`), porque acá
// adentro no existe `import.meta.env` y el backend está en otro dominio que el frontend.
const API = new URL(self.location).searchParams.get('api')

// Sin esto, un service worker nuevo queda en "waiting" hasta que se cierren TODAS las
// pestañas del panel. Ariel tiene el panel abierto en la tablet del mostrador todo el
// día y la PWA instalada en el celular, así que un arreglo acá podía tardar días en
// tomar control. Con `skipWaiting` + `claim`, entra en la próxima carga.
self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let datos = {
    title: 'Nuevo turno',
    body: 'Entró una reserva nueva.',
    url: '/admin',
  }

  try {
    if (event.data) datos = { ...datos, ...event.data.json() }
  } catch {
    // Si el payload no es JSON válido mostramos el aviso genérico igual: es preferible
    // que Ariel sepa que pasó algo a que la notificación se pierda del todo.
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(datos.title, {
        body: datos.body,
        // PNG y no SVG: Android no rasteriza SVG en las notificaciones y deja el hueco
        // vacío.
        icon: '/icono-192.png',
        // Monocromo con transparencia: es lo que Android dibuja en la barra de estado.
        // Sin `badge` pone un cuadrado gris genérico.
        badge: '/badge-96.png',
        // Un tag por turno. Antes era fijo ('turno-nuevo'), así que dos reservas
        // seguidas colapsaban en una sola notificación y Ariel se enteraba de la
        // segunda nomás.
        tag: datos.tag ?? `turno-${Date.now()}`,
        renotify: true,
        // La notificación queda hasta que la toca. Sin esto Android la descarta sola a
        // los pocos segundos si la pantalla está encendida, que es justo cuando Ariel
        // está cortando el pelo y no la mira.
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: datos.url },
      }),
      // Punto en el ícono de la app instalada. Sin número: el conteo exacto lo pone el
      // panel cuando se abre, acá solo sabemos que entró algo.
      self.navigator.setAppBadge?.().catch(() => {}),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = event.notification.data?.url ?? '/admin'

  // Si el panel ya está abierto en alguna pestaña, la enfoca en vez de abrir otra.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((ventanas) => {
        for (const ventana of ventanas) {
          if (ventana.url.includes('/admin') && 'focus' in ventana) {
            return ventana.focus()
          }
        }
        return self.clients.openWindow(destino)
      }),
  )
})

// El navegador puede rotar la suscripción por su cuenta (al actualizarse, al limpiar
// datos del sitio, o si el servicio de push le cambia las credenciales). Sin este
// handler, la suscripción nueva no se registraba en ningún lado: el panel seguía
// diciendo "avisos activados" y el backend seguía mandando a un endpoint muerto.
//
// Corre en el service worker, que no tiene el JWT de Ariel y puede dispararse con el
// panel cerrado — de ahí que `/api/push/renovar` no lleve autenticación. La prueba de
// posesión es conocer el endpoint viejo, que es una URL larga e inadivinable.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(renovarSuscripcion(event))
})

async function renovarSuscripcion(event) {
  const vieja = event.oldSubscription ?? null
  if (!API || !vieja) return

  try {
    // Algunos navegadores ya traen la nueva; el resto exige volver a suscribirse con la
    // misma clave del servidor, que se recupera de la suscripción vieja.
    const nueva =
      event.newSubscription ??
      (await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vieja.options.applicationServerKey,
      }))

    await fetch(`${API}/push/renovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointViejo: vieja.endpoint,
        suscripcion: nueva.toJSON(),
      }),
    })
  } catch (err) {
    // No hay a quién avisarle desde acá. Si falla, Ariel deja de recibir avisos hasta
    // que vuelva a tocar "Activar" — que es exactamente lo que pasaba siempre antes de
    // tener este handler.
    console.error('[sw] no se pudo renovar la suscripción', err)
  }
}
