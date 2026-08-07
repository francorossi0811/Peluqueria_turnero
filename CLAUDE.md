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
- Cuando se entregue, hay dos migraciones que aplicar en producción con `migrate deploy` (`hacer_telefono_opcional` y `diagnostico_push`). No es automático, y sin ellas el backend nuevo falla al guardar un turno sin teléfono.
- ⚠️ **Las suscripciones push viven en la base a la que apuntaba el backend cuando se tocó "Activar".** Cambiar `DATABASE_URL` en Render deja huérfanos todos los dispositivos registrados hasta ese momento: el envío sale, pero a una lista vacía o vieja. Ya pasó — ver la nota del final de la Etapa 1.

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
- La confirmación al cliente sale **por WhatsApp** (HU-22), con el mail como **respaldo**: se manda el mail solo si no hay teléfono, si el número no se puede pasar a E.164, o si el envío falla. El teléfono se **guarda como lo escribió la persona** y se normaliza recién al momento de enviar (`utils/telefono.ts`), nunca al entrar.
- **Fuera de alcance:** precios, sistema de deudas por ausencias, multi-peluquero. Los avisos a Ariel (push), el mail y el WhatsApp al cliente son reales. **WhatsApp dejó de estar fuera de alcance en la v3** — ver abajo.

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
- 🚧 **v3 en curso** — Etapa 1 (arreglos y cambios chicos) ✅ terminada, sin mergear. Etapa 2 (WhatsApp) ✅ código terminado y verificado en local con el adaptador de consola; **falta hacer los trámites con Meta para probarlo con mensajes reales**. Etapa 3 (clientes) por validar. Ver abajo.
- ⚠️ Pendiente de configuración (no de código): para que los mails salgan de verdad hay que crear una cuenta gratuita en Brevo y cargar `BREVO_API_KEY`. Sin eso el mail se imprime por consola y todo lo demás funciona igual.

## v3 — lo que pidió Ariel

Se decidió arrancar por los arreglos chicos (todo local, sin depender de trámites externos) y dejar WhatsApp para después.

El plan original está en `~/.claude/plans/tingly-meandering-mitten.md`, pero **quedó viejo**: describe como pendiente todo lo que ya está hecho. Para saber en qué estado están las cosas, vale esta sección, no ese archivo.

### Etapa 1 — arreglos y cambios chicos ✅ terminada (rama `v3-ajustes-de-ariel`, sin mergear)

Todo hecho y verificado en el navegador:

- **Panel en modo oscuro**, con interruptor en "Mi cuenta" (Ariel usa lentes). Se resuelve redefiniendo las variables CSS bajo `:root[data-tema='oscuro']`; los componentes no saben que existe. El atributo lo pone `useTemaAdmin` en `<html>` — **no** en `AdminLayout`, porque `/admin/login` cuelga fuera del layout, la regla de `body` es global, y `color-scheme` solo sirve en la raíz. El lado del cliente queda siempre en crema.
- **Agenda de martes a sábado**, derivada de `horario_laboral`.
- **Horas siempre en 24 h** (`components/ui/InputHora.tsx`). `<input type="time">` no se puede forzar: usa el idioma del navegador, no el `lang` del documento. Por eso son dos `<select>`.
- **Teléfono opcional en la carga manual**, más "Elegir de mis contactos" (Contact Picker API — existe **solo en Chrome sobre Android**, por eso va detrás de un feature check y no se renderiza en otros lados).
- **Arreglos del push** (HU-18): `pushsubscriptionchange` + `POST /api/push/renovar` (sin auth a propósito — el service worker no tiene el JWT y el evento corre con el panel cerrado; la autorización es conocer el endpoint viejo), `skipWaiting()` + `clients.claim()`, `badge` monocromo, `requireInteraction`, `tag` por turno, `TTL`/`urgency`, y baja de la suscripción vieja antes de suscribir.
- **Push observable**: `enviarATodos` devuelve resultado por dispositivo en vez de un contador, loguea status y host, y lo persiste en columnas nuevas de `push_suscripciones`. Bloque de diagnóstico en "Mi cuenta" con prueba **local** (`showNotification()` directo, sin red) que separa "falla el canal del sistema" de "falla la entrega".
- **Contador en la pestaña** (HU-20), punto en el favicon y `setAppBadge`.
- **Documentación**: HU-20 y HU-21 nuevas, enmiendas a HU-01/07/08/18, tabla `push_suscripciones` en modelo-datos (faltaba desde la v2), API y wireframes.

**Sobre el bug de las notificaciones de Ariel: quedó diagnosticado.** Franco probó en un Android con Chrome y llegan. Eso descarta el backend, las claves VAPID y el cifrado del payload: el problema es Samsung Internet en el celular de Ariel. **Instalarle Chrome es la solución** — y de paso le habilita el selector de contactos. Los arreglos de arriba se hicieron igual porque eran defectos reales.

**Y hay un segundo caso, distinto, que también quedó explicado.** A Franco no le llegaban avisos a su iPhone aunque a su amigo sí. No era iOS: **una suscripción push pertenece a la base de datos que estaba activa cuando se registró**. Su iPhone se suscribió mientras Render apuntaba a desarrollo; cuando volvió a producción, ese dispositivo dejó de estar en la lista que lee el envío. Se arregla desactivando y volviendo a activar los avisos desde la app deployada.

De ahí salen dos cosas que conviene tener presentes:

- ⚠️ **Defecto conocido, sin arreglar:** el panel dice "avisos activados" mirando **solo el navegador** (`suscripcionActual()` en `lib/push.ts`), nunca al backend. Los dos estados pueden estar desincronizados y la pantalla no lo delata. El endpoint `GET /api/admin/push/dispositivos` ya devuelve lo que hace falta para reconciliarlo; falta usarlo en la UI.
- Un **403** al enviar significa claves VAPID que no coinciden con las que firmaron esa suscripción — típico después de rotarlas. Esa fila no se borra sola (a diferencia de 404/410) y el dispositivo tiene que volver a activarse a mano.

Dos cosas para no olvidar al entregar:

- La migración `hacer_telefono_opcional` (`DROP NOT NULL`) y `diagnostico_push` están aplicadas **solo en desarrollo**. Hay que correr `migrate deploy` en producción.
- ⚠️ `diagnostico_push` lleva `DEFAULT CURRENT_TIMESTAMP` escrito a mano en el `updated_at`: Prisma lo genera sin default y la migración falla sobre una tabla con filas. Es exactamente el motivo del ritual de leer el SQL antes de aplicar.

### Etapa 2 — WhatsApp como canal principal ✅ código terminado (HU-22)

La confirmación del turno, con el link de gestión adentro, sale por WhatsApp; el mail quedó como respaldo. Todo verificado en local con el adaptador de consola.

**Cómo quedó armado:**

- `backend/src/services/whatsapp/` — adaptador con el **mismo molde que `services/mail/`**: interfaz, Cloud API por `fetch` nativo (cero dependencias HTTP) y consola. Se elige por la presencia de `WHATSAPP_TOKEN`.
- `backend/src/utils/telefono.ts` — `aE164()`, la traducción de salida. **No toca `validaciones.ts`**: el número se sigue guardando como lo escribió la persona, porque Ariel lo lee para llamar.
- `notificaciones.service.ts` — intenta WhatsApp y cae al mail. **Los 4 call sites del controller no se tocaron.**
- ⚠️ **El adaptador de consola no cuenta como enviado** (`whatsappEstaConfigurado()` al final de `intentarConfirmacionPorWhatsapp`). Sin ese detalle, desplegar esto antes de terminar los trámites con Meta apagaría el mail en silencio, que hoy es el único canal que funciona.

**Las dos trampas que se encontraron probando, no razonando:**

- ⚠️ **`libphonenumber-js` sola NO alcanza.** Solo agrega el `9` de celular cuando encuentra el `15`: `0351 15 459 3325` → `+5493514593325` ✅, pero **`351 459 3325` → `+543514593325`** (fijo) ❌ — y ese es justo el formato del placeholder de nuestro formulario. Hay que agregar el `9` a mano. Si sale sin él, WhatsApp acepta el número y el mensaje no llega nunca.
- ⚠️ Se importa la metadata **`max`** y no la `min` (la del import por defecto): `min` solo mira la longitud y da por válido cualquier argentino de 10 dígitos aunque la característica no exista.
- Se asume **celular** ante un argentino de 10 dígitos sin `0` ni `15`. Es ambiguo de verdad, pero un fijo no tiene WhatsApp: agregarle el `9` es lo único que le da chance de llegar.

**Lo investigado, para no volver a averiguarlo:**

- **Coexistence** (Meta, mayo 2026, ya en todos los países) permite el **mismo número** en la app de WhatsApp Business **y** en la Cloud API a la vez, sin perder chats. Era el bloqueante histórico.
- **No hay abono de plataforma**; se paga por mensaje. Las plantillas *utility* son **gratis dentro de la ventana de 24 h** que abre el cliente al escribir primero.
- **No hace falta verificar el negocio con Meta**: sin verificar el tope son 250 conversaciones **por día**, y Ariel atiende ~230 clientes **por mes**. La **plantilla** es otro trámite distinto y ese sí hace falta — es el formato aprobado para poder escribirle primero a alguien.
- El link entra como **botón de URL dinámica** con una variable al final: `https://…/turno/{{1}}`. Solo viaja el id del turno; la base es parte de la plantilla.

**Pendiente, y no es código:** cuenta de Meta Business con WABA en la Cloud API, Coexistence activado sobre el número de Ariel, las plantillas `turno_confirmado` y `turno_reprogramado` aprobadas (categoría *utility*), y `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` en Render.

**Fuera de alcance dentro de WhatsApp:** los webhooks de estado de Meta (entregado/leído/rebotado), el recordatorio previo al turno, y la respuesta automática al cliente que escribe primero. ⚠️ Sin webhooks, **el respaldo por mail cubre el envío que falla, no el que rebota**: Meta responde cuando acepta el mensaje, no cuando lo entrega.

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
