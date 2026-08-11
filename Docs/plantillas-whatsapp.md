# Plantillas de WhatsApp (HU-22)

Los textos para cargar en **Meta Business → WhatsApp Manager → Plantillas de mensajes**.
Son tres, una por cada cosa que le puede pasar a un turno.

El cuerpo del mensaje **no vive en el código**: vive aprobado del lado de Meta. Lo único
que viaja desde el backend son los valores de las variables (ver
`construirMensajeWhatsapp` en `backend/src/services/notificaciones.service.ts`). Por eso
este archivo es la fuente de verdad de lo que dicen los mensajes.

## Lo que comparten las tres

| | |
|---|---|
| **Categoría** | Utility (⚠️ **no** Marketing: Marketing se cobra siempre y puede quedar bloqueada por las preferencias del cliente) |
| **Idioma** | Español (ARG) — `es_AR`, el mismo valor de `WHATSAPP_IDIOMA` |
| **Encabezado** | Ninguno |
| **Pie de página** | `La Peluquería de Ariel Enrique` |
| **Variables del cuerpo** | `{{1}}` nombre · `{{2}}` servicio · `{{3}}` fecha y hora |

⚠️ **Las tres usan las mismas tres variables, en el mismo orden, a propósito.** Así el
armador del backend sirve para las tres sin ramificar, y el único lugar donde se decide
qué mandar es el nombre de la plantilla. Si al cargarlas en Meta se cambia el orden en
una, el mensaje sale mezclado y **nada del lado nuestro lo delata** — hay un test
(`notificaciones.service.test.ts`) que fija el orden justamente por eso.

Ejemplos para el formulario de Meta (pide un valor de muestra por variable):

- `{{1}}` → `Juan Pérez`
- `{{2}}` → `Corte de pelo`
- `{{3}}` → `martes, 4 de agosto a las 15:00`

---

## 1. `turno_confirmado`

**Cuerpo:**

```
¡Hola {{1}}! Tu turno quedó confirmado ✂️

*{{2}}*
📅 {{3}}
📍 Pastor Taboada 10, Córdoba

Podés cancelar o reprogramar hasta 60 minutos antes desde el botón de abajo. Pasada esa hora, escribinos por acá y lo vemos.
```

**Botón** — tipo *Visitar sitio web* → **URL dinámica**

- Texto del botón: `Gestionar mi turno`
- URL: `https://<dominio>/turno/{{1}}`
- Ejemplo: `https://<dominio>/turno/7c9e6679-7425-40de-944b-e07fc1f90ae7`

⚠️ La `{{1}}` del botón es **independiente** de las del cuerpo (Meta las numera aparte) y
solo viaja el id del turno: la base de la URL es parte de la plantilla. `<dominio>` tiene
que ser exactamente el mismo valor de `FRONTEND_URL` en Render, si no el link abre en la
nada.

---

## 2. `turno_reprogramado`

**Cuerpo:**

```
¡Listo {{1}}! Tu turno quedó reprogramado 🔁

*{{2}}*
📅 {{3}}
📍 Pastor Taboada 10, Córdoba

Este es tu nuevo link: el anterior ya no sirve. Podés cancelar o reprogramar hasta 60 minutos antes desde el botón de abajo.
```

**Botón** — igual que el de `turno_confirmado` (URL dinámica, `Gestionar mi turno`).

⚠️ Lo de "el anterior ya no sirve" no es una frase de relleno: reprogramar **crea un turno
nuevo**, con su propio link, y deja el viejo en estado `reprogramado`. El cliente que
guarde el mensaje anterior va a caer en un turno que ya no existe.

---

## 3. `turno_cancelado`

**Cuerpo:**

```
Hola {{1}}, cancelamos tu turno.

*{{2}}*
📅 {{3}}

Liberamos el horario. Cuando quieras sacás otro desde el botón de abajo, o escribinos por acá.
```

**Botón** — tipo *Visitar sitio web* → **URL estática**

- Texto del botón: `Reservar otro turno`
- URL: `https://<dominio>`

⚠️ **Esta es la única de las tres sin variable en el botón**, y el backend lo sabe
(`variableBotonUrl` va `undefined` cuando el tipo es `cancelado`). Mandarle una variable a
una plantilla que no la declara es un 400 de Meta. Va sin link de gestión porque un turno
cancelado ya no se gestiona: ofrecer "gestionar mi turno" ahí sería prometer una acción
que no existe.

El mismo texto sirve para las dos formas de cancelar —el cliente desde su link, o Ariel
desde el panel— y por eso dice "cancelamos" y no "cancelaste". El segundo caso es el más
importante de los dos: es la **única** forma de que el cliente se entere de que no lo
esperan.

---

## Después de que Meta las apruebe

1. Cargar en Render `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` (van juntas: con una
   sola el backend no arranca, a propósito).
2. Los nombres de las plantillas ya están como default en el código
   (`turno_confirmado`, `turno_reprogramado`, `turno_cancelado`). Solo hacen falta las
   variables `WHATSAPP_PLANTILLA_*` si en Meta terminan con otro nombre.
3. Probar los tres flujos con un número real: reservar, reprogramar y cancelar.

⚠️ Mientras no haya `WHATSAPP_TOKEN`, los tres mensajes se imprimen en la consola del
servidor **y además sale el mail** de respaldo. Eso es deliberado: sin ese detalle,
desplegar esto antes de terminar el trámite apagaría el mail en silencio.

⚠️ Un 200 de Meta significa "lo aceptó", no "le llegó". Los webhooks de estado
(entregado / leído / rebotado) están fuera de alcance, así que un número que existe pero
no tiene WhatsApp se ve igual que un envío exitoso. El respaldo por mail cubre el envío
que falla, no el que rebota.
