# CLAUDE.md

Este archivo le da contexto a Claude Code al abrir este repo. Leelo siempre antes de proponer un plan o escribir código.

## Qué es este proyecto

Turnero web para "La Peluquería de Ariel Enrique" — peluquería unisex, un solo peluquero (Ariel, sin empleados). Hoy gestiona los turnos por WhatsApp y papel; el objetivo es sacarle esa carga de encima sin reemplazar WhatsApp como canal de contacto.

Es un proyecto de portfolio de un estudiante de Ingeniería en Sistemas (4to año). Prioridad: buenas prácticas por sobre velocidad. Nunca generar código sin antes proponer un plan y que sea validado.

## ⚠️ Ariel está usando la app AHORA MISMO

La v1 está deployada y Ariel la está probando de verdad, contra la base de **producción**. Eso manda sobre todo lo demás:

- **Trabajar siempre en la rama `v3-ajustes-de-ariel`**, nunca commitear en `main`. Mergear a `main` le cambiaría la app que está probando.
- **No pushear ni mergear sin que Franco lo pida explícitamente.**
- **Todo contra la base de desarrollo.** Antes de correr cualquier migración o script, verificar el host de `DATABASE_URL`: desarrollo es `ep-cool-field-acf4s3g8`. Si no coincide, parar y preguntar.
- Render sirve **producción** y Vercel le apunta ahí. El entorno local (`localhost:3000` + `localhost:5173`) va contra **desarrollo**; `frontend/.env` tiene que decir `http://localhost:3000/api`.
- Cuando se entregue, la migración del teléfono (`DROP NOT NULL`) hay que aplicarla en producción con `migrate deploy`. No es automático.

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
- El cliente puede dejar un **email opcional** al reservar: si lo deja, recibe la confirmación con su link único y el turno adjunto para el calendario. Si no lo dejó, la pantalla de confirmación se lo ofrece ahí mismo (`POST /api/turnos/:id/enviar-confirmacion`, **un solo uso por turno** — el id del turno es el token, así que sin ese límite sería un relay de mails abierto).
- El **teléfono se valida** (8 a 15 dígitos, con espacios/guiones/paréntesis y un `+` inicial) en el frontend y en el backend. La regla vive en `utils/validaciones.ts`, duplicada a propósito en los dos lados: la del backend es la que decide. **Es obligatorio cuando reserva un cliente por la web** (es el único dato con el que Ariel lo ubica) y **opcional cuando el turno lo carga Ariel a mano**, porque no se sabe los números de memoria. La diferencia se hace sobrescribiendo el campo en `bodyManualSchema` (`turnos.controller.ts`), no aflojando `bodySchema`. Si escribió algo, tiene que ser válido igual.
- **Los días que trabaja Ariel salen de la tabla `horario_laboral`** ("sin filas = cerrado"), nunca de una constante en el código. Hoy da martes a sábado. La vista "Semana" de la agenda va del primer al último día laboral, anclada en domingo — si Ariel abre los lunes desde el panel, la agenda lo sigue sola.
- **Fuera de alcance:** precios, sistema de deudas por ausencias, multi-peluquero. Los avisos a Ariel (push) y el mail al cliente son reales. **WhatsApp deja de estar fuera de alcance en la v3** — ver abajo.

## Estado actual del proyecto

- ✅ Requisitos, historias de usuario y casos de uso — definidos y validados.
- ✅ Arquitectura de alto nivel — definida y validada.
- ✅ Modelo de datos / ERD — definido y validado.
- ✅ Especificación de la API REST — definida y validada.
- ✅ Wireframes / diseño UI — definidos; la interfaz final sigue el diseño que Franco hizo con la herramienta de diseño de Claude (paleta crema/negro/ámbar). El lado del cliente es siempre claro; el panel tiene además una variante oscura (v3), que son los mismos tokens con otros valores.
- ✅ v1 completa: backend, flujo de reserva del cliente y panel de admin, funcionando.
- ✅ v2 completa (tres etapas):
  - Etapa 1 — sesión deslizante que no vence mientras Ariel use el panel, y cambio de contraseña desde "Mi cuenta" (HU-15, HU-16).
  - Etapa 2 — agenda que se actualiza sola con los turnos nuevos marcados, y aviso al celular por Web Push (HU-17, HU-18).
  - Etapa 3 — mail de confirmación al cliente con su link, y "agregar al calendario" (.ics) (HU-02, HU-19).
- 🚧 **v3 en curso** — son los cambios que pidió Ariel después de usar la v1 de verdad. Ver abajo.
- ⚠️ Pendiente de configuración (no de código): para que los mails salgan de verdad hay que crear una cuenta gratuita en Brevo y cargar `BREVO_API_KEY`. Sin eso el mail se imprime por consola y todo lo demás funciona igual.

## v3 — lo que pidió Ariel

Plan completo en `~/.claude/plans/tingly-meandering-mitten.md`. Se decidió arrancar por los arreglos chicos (todo local, sin depender de trámites externos) y dejar WhatsApp para después.

### Etapa 1 — arreglos y cambios chicos (en curso, rama `v3-ajustes-de-ariel`)

Hecho y verificado:

- **Panel en modo oscuro**, con interruptor en "Mi cuenta" (Ariel usa lentes). Se resuelve redefiniendo las variables CSS bajo `:root[data-tema='oscuro']`; los componentes no saben que existe. El atributo lo pone `useTemaAdmin` en `<html>` — **no** en `AdminLayout`, porque `/admin/login` cuelga fuera del layout, la regla de `body` es global, y `color-scheme` solo sirve en la raíz. El lado del cliente queda siempre en crema.
- **Agenda de martes a sábado**, derivada de `horario_laboral`.
- **Horas siempre en 24 h** (`components/ui/InputHora.tsx`). `<input type="time">` no se puede forzar: usa el idioma del navegador, no el `lang` del documento. Por eso son dos `<select>`.
- **Teléfono opcional en la carga manual**, más "Elegir de mis contactos" (Contact Picker API — existe **solo en Chrome sobre Android**, por eso va detrás de un feature check y no se renderiza en otros lados).

Pendiente:

- Arreglos del service worker: falta `pushsubscriptionchange`, `skipWaiting()` + `clients.claim()`, `badge`, `requireInteraction`, y el `tag` es fijo (dos turnos seguidos colapsan en una sola notificación).
- Backend de push observable: hoy `enviarATodos` cuenta aceptaciones del servicio de push, **no entregas** — el "enviado a 1 dispositivo" que ve Ariel no significa que le llegó. Faltan logs de status y host, columnas de diagnóstico en `push_suscripciones`, y `POST /api/push/renovar` (sin auth a propósito: el service worker no tiene el JWT).
- Bloque de diagnóstico en "Mi cuenta", con una prueba **local** (`registration.showNotification()` directo) que separa "falla el canal del sistema" de "falla la entrega". Y arreglar el `catch` de `CuentaPage.tsx` que muestra un mensaje sobre iPhone en cualquier plataforma — eso es lo que confundió a Ariel en su computadora.
- Contador en la pestaña + punto rojo en el favicon + `setAppBadge`.
- Documentación (HU-20, enmiendas a HU-01/07/08/18, modelo de datos, API, wireframes).

**Paso 0 antes de tocar el código de push: instalarle Chrome a Ariel** (tiene un Android viejo con Samsung Internet). Es gratis, tarda dos minutos y puede resolver el problema entero — y de paso habilita el selector de contactos.

### Etapa 2 — WhatsApp como canal principal (a validar antes de arrancar)

Ariel quiere que la confirmación del turno, con el link de gestión adentro, llegue por WhatsApp en vez de mail. Lo investigado, para no volver a averiguarlo:

- **Coexistence** (Meta, mayo 2026, ya en todos los países) permite el **mismo número** en la app de WhatsApp Business **y** en la Cloud API a la vez, sin perder chats. Ariel ya usa la app de negocio, así que no cambia de número ni pierde nada. Era el bloqueante histórico.
- **No hay abono de plataforma**; se paga por mensaje. Las plantillas *utility* son **gratis dentro de la ventana de 24 h** que abre el cliente al escribir primero.
- **No hace falta verificar el negocio con Meta**: sin verificar el tope son 250 conversaciones **por día**, y Ariel atiende ~230 clientes **por mes**.
- El link entra como **botón de URL dinámica** con una variable al final: `https://…/turno/{{1}}`.
- Arquitectura: adaptador en `backend/src/services/whatsapp/`, mismo molde que `services/mail/`. `notificaciones.service.ts` ya es el único punto de salida de avisos. **El mail no se borra: pasa a ser el respaldo.**
- ⚠️ Lo más subestimado: **normalizar a E.164**. La regla actual dice explícitamente que no normaliza; WhatsApp necesita `5493514593325` exacto, con el quilombo argentino del `0`, el `15` y el `9`.

### Etapa 3 — reemplazar las planillas de Drive (necesita su propia ronda de diseño)

Ariel lleva dos planillas: una de clientes (con código de colores) y una de recaudación diaria. Franco va a pasar una foto antes de planear esto.

- El código de colores **mezcla dos ejes distintos**: amarillo/naranja describe al *cliente* (si falta seguido o no), azul/violeta describe *un pago puntual* (Mercado Pago / tarjeta). Como una celda tiene un solo color, hoy pierde información. En el modelo van separados: una marca en el cliente, y un medio de pago por turno.
- **No integrar Drive por OAuth**: lo que le sirve de Drive es el acceso multiplataforma, y la app web ya lo es. Corresponde una sección "Clientes" en el panel + exportación a CSV.
- ⚠️ **La contabilidad necesita precios, que están fuera de alcance por escrito.** No es migrar una planilla: es un módulo nuevo con historias de usuario nuevas. Es una decisión de alcance de Franco, no asumirla.

## Forma de trabajo

Avanzar etapa por etapa. Cada etapa se valida con Franco antes de pasar a la siguiente. No generar grandes cantidades de código de una — proponer el plan primero.

Además, para este proyecto:

- **Verificar de verdad, no solo compilar.** Los dos servidores locales y el navegador están a mano: medir los colores calculados, probar los endpoints con datos reales, mirar la pantalla. Varias cosas de la v3 se encontraron así y no con `tsc`.
- **Ritual de migraciones:** siempre `--create-only`, leer el SQL generado y **borrar cualquier línea que toque `turnos_no_solapamiento`** (el `EXCLUDE USING gist` está escrito a mano en la migración inicial y no vive en `schema.prisma`, así que Prisma puede emitir un `DROP CONSTRAINT` al diffear). Después `migrate deploy` y confirmar contra `pg_constraint` que sigue existiendo.
- Si se toca `schema.prisma`, correr `npx prisma generate` — si no, `tsc` falla con tipos viejos.
- **El repo es público.** Los secretos van solo en `backend/.env` (gitignoreado), nunca en `.env.example`. Revisar el diff staged antes de commitear. Las variables `VITE_*` se compilan dentro del bundle público: nunca pueden ser secretas.
