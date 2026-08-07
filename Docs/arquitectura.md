# Arquitectura — Turnero La Peluquería de Ariel Enrique | v1

## Capas

1. **Cliente** (navegador, sin cuenta) — interfaz pública de reserva.
2. **Panel admin** (Ariel, autenticado con JWT) — gestión de agenda.
3. **Frontend** — React + Vite, desplegado en Vercel. Consume la API vía Axios (HTTPS/JSON).
4. **Backend** — API REST en Node + Express, desplegado en Render. Valida JWT en las rutas de admin. Contiene toda la lógica de negocio (cálculo de disponibilidad, reglas de cancelación/reprogramación, etc.).
5. **Base de datos** — PostgreSQL en Neon o Supabase.
6. **Servicios externos salientes** — las únicas llamadas que el backend hace hacia afuera:
   - **Web Push** (VAPID, librería `web-push`) para avisarle a Ariel al celular cuando entra un turno (HU-18). Opcional: sin claves configuradas, el resto funciona igual.
   - **Envío de mail** para la confirmación al cliente (HU-19), detrás de una interfaz `Mailer` con dos implementaciones: Brevo en producción y una que escribe por consola en desarrollo (o mientras no haya cuenta creada). Cambiar de proveedor es agregar un archivo.
   - **WhatsApp** (Cloud API de Meta) para la confirmación al cliente (HU-22), que desde la v3 es el canal principal. Mismo molde que el mail: interfaz `Whatsapp` en `services/whatsapp/`, con la Cloud API en producción y una implementación de consola en desarrollo. Se habla por `fetch` nativo, sin dependencia HTTP.

**Por qué WhatsApp pasó de descartado a construido.** Durante la v1 y la v2 figuró como descartado —no diferido— y el motivo era real: la API exigía dedicarle un número, o sea que Ariel tenía que dejar de usar el suyo en la app de WhatsApp Business. *Coexistence* (Meta, mayo de 2026) permite el mismo número en los dos lados a la vez sin perder los chats, y eso sacó el único bloqueante que importaba. El mail no se quitó: pasó a ser el respaldo.

**Los dos avisos al cliente están detrás del mismo punto de salida.** `notificaciones.service.ts` es el único lugar que decide por dónde sale la confirmación, y los controllers siguen llamando a una sola función. Por eso agregar WhatsApp no tocó ninguno de los cuatro lugares que la disparan.

**El teléfono se normaliza al salir, no al entrar.** `utils/validaciones.ts` acepta el número como lo escribe la persona y lo guarda tal cual, porque Ariel lo lee para llamar; `utils/telefono.ts` lo traduce a E.164 recién al momento de mandar el mensaje. Separarlo así evita que un requisito de un proveedor externo cambie lo que se ve en la agenda. Se usa `libphonenumber-js` y no una expresión regular propia porque sacar el `15` de un celular argentino exige saber dónde termina la característica, y las argentinas van de 2 a 4 dígitos.

## Decisiones y por qué

- **Frontend y backend desacoplados.** Se despliegan y escalan por separado; es el patrón esperado en un proyecto de portfolio con "arquitectura modular".
- **Toda regla de negocio vive en el backend, nunca solo en el frontend.** El frontend puede deshabilitar un botón para dar buena UX, pero el backend vuelve a validar todo (disponibilidad, ventana de 60 min, etc.) porque no se puede confiar en lo que mande el cliente.
- **El cliente no tiene cuenta.** Su identidad para gestionar un turno puntual es el link único (token no adivinable), no una sesión con contraseña.
- **El admin sí tiene cuenta real (JWT)** porque tiene control total sobre la agenda de todos.
- **La API es REST**, no GraphQL ni RPC — más simple de razonar, documentar y testear para el alcance de este proyecto.

## Fuera de alcance

Integración con WhatsApp Business API — descartada, no diferida (ver arriba y §5 de
`historias-de-usuario-casos-de-uso.md`).

## Decisiones de las etapas de v2

- **Renovación de sesión por header, no refresh token.** El backend devuelve un token nuevo en `X-Token-Renovado` cuando el actual pasó la mitad de su vida. Un par access/refresh con tabla de sesiones sería lo de manual, pero entre Vercel y Render implica cookies cross-site y bastante complejidad para un sistema de un solo usuario. El header exige `Access-Control-Expose-Headers`, si no el mecanismo funciona en localhost y es un no-op en producción.
- **`password_changed_at` rompe a propósito el "stateless" del JWT.** Validar el token pasa a hacer una consulta a base. Sin eso, cambiar la contraseña no cerraría las sesiones ya abiertas y la funcionalidad daría una sensación falsa de seguridad.
- **El aviso a Ariel se dispara desde el controller público, no desde el service.** Así la carga manual (HU-08) no genera aviso, y es la ruta —no un flag— la que expresa "esto vino de un cliente". Va después de responder y sin `await`: un push o un mail caído no pueden hacer fallar una reserva ya guardada.
- **El `.ics` se genera en el backend, no en el navegador.** Un solo lugar de generación, y así el mail puede apuntar a la misma URL. Se escribió a mano (~50 líneas) en vez de traer una dependencia porque es función pura y por lo tanto fácil de testear de verdad.
