# Arquitectura — Turnero La Peluquería de Ariel Enrique | v1

## Capas

1. **Cliente** (navegador, sin cuenta) — interfaz pública de reserva.
2. **Panel admin** (Ariel, autenticado con JWT) — gestión de agenda.
3. **Frontend** — React + Vite, desplegado en Vercel. Consume la API vía Axios (HTTPS/JSON).
4. **Backend** — API REST en Node + Express, desplegado en Render. Valida JWT en las rutas de admin. Contiene toda la lógica de negocio (cálculo de disponibilidad, reglas de cancelación/reprogramación, etc.).
5. **Base de datos** — PostgreSQL en Neon o Supabase.
6. **(Fase 2)** WhatsApp Business API — se conecta desde el backend cuando Ariel tenga cuenta de negocio. Hasta entonces, las notificaciones quedan simuladas en la interfaz.

## Decisiones y por qué

- **Frontend y backend desacoplados.** Se despliegan y escalan por separado; es el patrón esperado en un proyecto de portfolio con "arquitectura modular".
- **Toda regla de negocio vive en el backend, nunca solo en el frontend.** El frontend puede deshabilitar un botón para dar buena UX, pero el backend vuelve a validar todo (disponibilidad, ventana de 60 min, etc.) porque no se puede confiar en lo que mande el cliente.
- **El cliente no tiene cuenta.** Su identidad para gestionar un turno puntual es el link único (token no adivinable), no una sesión con contraseña.
- **El admin sí tiene cuenta real (JWT)** porque tiene control total sobre la agenda de todos.
- **La API es REST**, no GraphQL ni RPC — más simple de razonar, documentar y testear para el alcance de este proyecto.

## Fuera de alcance en v1

Integración real con WhatsApp Business API (queda mockeada hasta que exista cuenta de negocio).
