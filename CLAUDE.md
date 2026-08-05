# CLAUDE.md

Este archivo le da contexto a Claude Code al abrir este repo. Leelo siempre antes de proponer un plan o escribir código.

## Qué es este proyecto

Turnero web para "La Peluquería de Ariel Enrique" — peluquería unisex, un solo peluquero (Ariel, sin empleados). Hoy gestiona los turnos por WhatsApp y papel; el objetivo es sacarle esa carga de encima sin reemplazar WhatsApp como canal de contacto.

Es un proyecto de portfolio de un estudiante de Ingeniería en Sistemas (4to año). Prioridad: buenas prácticas por sobre velocidad. Nunca generar código sin antes proponer un plan y que sea validado.

## Antes de hacer nada

1. Leé **todo** `Docs/historias-de-usuario-casos-de-uso.md` (requisitos, historias de usuario, casos de uso y casos borde ya definidos y validados).
2. Leé **todo** `Docs/arquitectura.md` (capas del sistema y por qué).
3. Si algo de lo que te piden no está contemplado en esos documentos, preguntá antes de asumir — no improvises reglas de negocio nuevas.

## Stack

- **Frontend:** React + Vite, Tailwind CSS. Deploy en Vercel.
- **Backend:** Node + Express, API REST. Deploy en Render.
- **Auth:** JWT, solo para el panel de Ariel (el cliente no tiene cuenta).
- **Base de datos:** PostgreSQL (Neon o Supabase).

## Reglas de negocio clave (resumen — el detalle está en Docs/)

- Un solo peluquero, no hay selección de estilista.
- El cliente reserva sin cuenta; su turno se administra con un **link único no adivinable** (token), no con login.
- Cliente puede cancelar/reprogramar solo hasta **60 minutos antes**, con **10 minutos de margen** sobre el horario de cierre al calcular disponibilidad.
- La disponibilidad SIEMPRE se recalcula y valida en el backend, nunca solo en el frontend.
- Doble reserva del mismo horario: se previene con una restricción de unicidad a nivel de base de datos, no solo con lógica de aplicación.
- El turno guarda una copia (nombre + duración) del servicio al momento de reservar — si Ariel cambia la duración de un servicio después, los turnos ya reservados no cambian.
- Nunca se borra un turno físicamente: la aplicación no hace `DELETE` sobre `turnos`, todo cambio es un `UPDATE` de `estado` (+ `updated_at`). Al reprogramar, el turno viejo queda en estado `reprogramado` y el nuevo apunta a él con `turno_origen_id`. **No hay tabla de historial/auditoría** — el rastro es ese, no un log de cambios.
- La sesión del admin dura 7 días y se renueva sola mientras use el panel; cambiar la contraseña invalida los tokens emitidos antes (HU-15, HU-16).
- El cliente puede dejar un **email opcional** al reservar: si lo deja, recibe la confirmación con su link único y el turno adjunto para el calendario. Los que no dejan email siguen dependiendo de guardar el link o de escribirle a Ariel.
- **Fuera de alcance:** precios, sistema de deudas por ausencias, multi-peluquero, WhatsApp Business API real (el aviso al cliente por WhatsApp sigue simulado en la interfaz; los avisos a Ariel y el mail al cliente ya son reales).

## Estado actual del proyecto

- ✅ Requisitos, historias de usuario y casos de uso — definidos y validados.
- ✅ Arquitectura de alto nivel — definida y validada.
- ✅ Modelo de datos / ERD — definido y validado.
- ✅ Especificación de la API REST — definida y validada.
- ✅ Wireframes / diseño UI — definidos; la interfaz final sigue el diseño que Franco hizo con la herramienta de diseño de Claude (paleta crema/negro/ámbar, unificada entre cliente y admin).
- ✅ v1 completa: backend, flujo de reserva del cliente y panel de admin, funcionando.
- ✅ v2 completa (tres etapas):
  - Etapa 1 — sesión deslizante que no vence mientras Ariel use el panel, y cambio de contraseña desde "Mi cuenta" (HU-15, HU-16).
  - Etapa 2 — agenda que se actualiza sola con los turnos nuevos marcados, y aviso al celular por Web Push (HU-17, HU-18).
  - Etapa 3 — mail de confirmación al cliente con su link, y "agregar al calendario" (.ics) (HU-02, HU-19).
- ⚠️ Pendiente de configuración (no de código): para que los mails salgan de verdad hay que crear una cuenta gratuita en Brevo y cargar `BREVO_API_KEY`. Sin eso el mail se imprime por consola y todo lo demás funciona igual.

## Forma de trabajo

Avanzar etapa por etapa. Cada etapa se valida con Franco antes de pasar a la siguiente. No generar grandes cantidades de código de una — proponer el plan primero.
