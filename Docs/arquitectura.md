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

No hay una tercera integración saliente: **WhatsApp Business API quedó descartada**, no diferida. El aviso al cliente por WhatsApp estuvo un tiempo "simulado" con un cartel en la pantalla de confirmación, y ese cartel se sacó — anunciar en la interfaz una integración que no se va a construir es peor que no tenerla. El mail cubre el mismo objetivo (que el link llegue solo a algún lado) sin cuenta de negocio ni aprobación de Meta.

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
