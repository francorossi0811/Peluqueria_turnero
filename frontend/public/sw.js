// Service worker del panel de Ariel (HU-18).
//
// Vive en `public/` y no en `src/` porque Vite copia `public/` tal cual a la raíz del
// build: eso le da alcance sobre todo el sitio ("/"), que es lo que hace falta para
// recibir push. Un archivo procesado desde `src/` terminaría en /assets/ y solo tendría
// alcance sobre esa carpeta.
//
// A propósito NO cachea nada: no queremos que la app funcione offline (mostraría una
// agenda desactualizada, que es peor que no mostrar nada). Solo recibe notificaciones.

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
    self.registration.showNotification(datos.title, {
      body: datos.body,
      // PNG y no SVG: Android no rasteriza SVG en las notificaciones y deja el hueco
      // vacío.
      icon: '/icono-192.png',
      // Reemplaza la notificación anterior en vez de apilar una por cada turno.
      tag: 'turno-nuevo',
      renotify: true,
      data: { url: datos.url },
    }),
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
