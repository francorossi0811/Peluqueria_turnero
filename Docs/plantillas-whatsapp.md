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

---

## Lo que se aprendió conectando (18/8/2026)

Notas del primer intento real de conexión contra la Cloud API. Nada de esto se dedujo
leyendo la documentación de Meta: salió de chocarse con cada cosa.

### Las plantillas son por WABA, y hay dos

La cuenta tiene **dos** cuentas de WhatsApp Business, no una:

| WABA | Id | Número | Plataforma |
|---|---|---|---|
| `Test WhatsApp Business Account` | `1542689076797799` | +1 555-201-4849 (test de Meta) | `CLOUD_API` |
| `La Peluqueria` | `328067332270903` | el de Ariel | `ON_PREMISE` |

Una plantilla vive en **una** WABA. Las que se cargaron para probar con el número de test
**no le sirven al número real**: hay que volver a crearlas en la otra. Por API son un
minuto, pero el reloj de la revisión de Meta arranca de cero cada vez.

⚠️ **La WABA real no acepta ni siquiera crear plantillas todavía.** Devuelve un
`error_subcode 2494160`, *"Esta cuenta de WhatsApp Business no tiene permiso para crear ni
actualizar plantillas"*. No es el token ni el texto: es la misma causa que el
`ON_PREMISE` de la tabla — ese número no está habilitado en la Cloud API. **Coexistence
desbloquea las dos cosas a la vez**, y hasta que esté no hay nada que hacer de este lado.

### Crear las plantillas por API, no por el formulario

`POST /<WABA_ID>/message_templates` con el JSON de la plantilla. Es preferible al
formulario de WhatsApp Manager por un motivo concreto: los tres errores contra los que
este archivo ya venía advirtiendo —el orden de las variables, la categoría *marketing* en
lugar de *utility*, y la variable de más en el botón de `turno_cancelado`— son todos
errores de tipeo en ese formulario. Por API el texto se copia de acá y no hay dónde
equivocarse. Meta las revisa igual y tarda lo mismo.

La forma del cuerpo es `components: [BODY, FOOTER, BUTTONS]`, con `example.body_text`
como lista de listas (Meta pide un valor de muestra por variable) y `example` en el botón
solo cuando la URL lleva `{{1}}`.

### ⚠️ La lista de autorizados del número de test compara literal

Esto es lo que más tiempo comió. El número de prueba solo le puede escribir a hasta 5
destinatarios cargados y verificados a mano en el panel, y **el string tiene que coincidir
exactamente con el que se tipeó ahí**:

- Cargado en el panel sin el `9`, un envío a `54…` es **aceptado**.
- El mismo destino con el `9` (`549…`) rebota con **`131030` — *Recipient phone number not
  in allowed list***.
- Pero el `wamid` que devuelve el envío aceptado decodifica a `549…`: **Meta le agrega el
  `9` solo y lo entrega al mismo lugar.**

⚠️ **No es un defecto de `aE164`.** Nuestro `utils/telefono.ts` agrega el `9` y hace bien
—es lo que WhatsApp usa para identificar celulares argentinos—; la lista de autorizados es
una restricción **exclusiva del número de prueba** y en producción no existe. La
consecuencia práctica es sólo para probar: hay que cargar el número de prueba **con el
`9`**, porque es la forma en la que el backend lo va a mandar siempre.

### El token temporal vence a una hora fija del día

No dura 24 h desde que se genera: muere a una hora redonda, así que uno recién copiado
puede quedar con minutos de vida. Se regenera en developers.facebook.com → la app →
WhatsApp → API Setup. **El token permanente** (el de *system user*, que es el que va a
Render) se saca desde el paso "Enviar mensaje" del checklist de producción.

### Del checklist de "Configuración de producción" de Meta, dos ítems no van

- **Webhooks** — fuera de alcance (ver la advertencia del final de este archivo): no hay
  endpoint que los reciba. Además no entregan datos de producción mientras la app esté
  sin publicar.
- **"Envía un mensaje" desde el panel** — sirve para mandar uno a mano; el envío por
  nuestro propio adaptador prueba más y ya se hizo.

Lo que **sí** hace falta de ese checklist es **la información de pago**: sin método de
pago Meta no deja enviar mensajes iniciados por el negocio, que es exactamente lo nuestro
(le escribimos primero al cliente). Las *utility* son gratis sólo dentro de la ventana de
24 h que abre el cliente, y nuestros tres avisos normalmente caen fuera.

### Qué quedó verificado y qué no

- ✅ El transporte llega: mensaje recibido en un celular real.
- ✅ El adaptador `cloud.whatsapp.ts` envía de verdad — se probó con una plantilla ya
  aprobada de la misma forma que `turno_cancelado` (cuerpo de 3 variables + botón de URL
  **estática**), y Meta la aceptó.
- ✅ `aE164` normaliza los tres formatos de entrada al mismo `549…`.
- 🚧 **Sin verificar: el botón con variable**, o sea `turno_confirmado` y
  `turno_reprogramado`. No había ninguna plantilla aprobada con esa forma para usar de
  banco de pruebas, así que ese camino se cierra recién cuando aprueben las nuestras.

---

## La prueba de punta a punta (20/8/2026)

Las cuatro plantillas quedaron **aprobadas** y el flujo completo se corrió contra el número
de prueba, con el backend apuntado a una branch descartable de Neon
(`prueba-whatsapp-hu22`, borrada al terminar). Producción quedó igual antes y después:
12 turnos, 7 clientes, cero turnos de prueba.

### Las plantillas cambiaron de nombre y son cuatro

| Plantilla | Cuándo sale |
|---|---|
| `turno_confirmado_v2` | al reservar |
| `turno_reprogramado` | al reprogramar |
| `turno_cancelado_cliente` | cancela **el cliente** desde su link |
| `turno_cancelado_negocio` | cancela **Ariel** desde el panel |

⚠️ **`turno_confirmado` se llama `_v2` por un error evitable.** Para cambiarle una palabra
se borró y se recreó, y Meta **bloquea reusar el nombre de una plantilla borrada** durante
un buen rato (`error_subcode 2388023`, que dice "vuelve a intentarlo en menos de un
minuto" y miente: diez minutos después seguía bloqueado). **Una plantilla se edita con un
`POST` sobre su id, no borrándola.** El nombre se absorbe con
`WHATSAPP_PLANTILLA_CONFIRMADO`, que existe exactamente para esto.

⚠️ **Por qué la cancelación son dos plantillas y no una.** El texto lo pidió Franco: cuando
el cliente cancela con tiempo, agradecerle. Pero la misma plantilla la usan los tres
caminos de baja, y "gracias por avisar" es absurdo cuando **el que canceló fue Ariel** —que
es el caso donde el mensaje más importa, porque es la única forma de que el cliente se
entere de que no lo esperan. Partirla obliga a que `TipoAviso` tenga cuatro casos.

**El tono es en singular**: Ariel es uno solo, así que "escribime" y no "escribinos",
"tuve que cancelar" y no "cancelamos". `turno_reprogramado` no necesitó cambios porque no
tenía ninguna primera persona del plural.

### Qué quedó verificado

- Reservar → reprogramar → cancelar, por la API real, con los tres avisos saliendo.
- **El botón con variable**, que era el 🚧 pendiente: el link llegó como
  `https://…/turno/<id>` exacto. Confirma que viaja **solo el id** y que la base vive en la
  plantilla aprobada.
- El rastro en la base: el turno viejo en `reprogramado`, el nuevo con `turno_origen_id`
  apuntándole, y el teléfono guardado **como lo escribió la persona**.

### ⚠️ Se vio, por primera vez, un mensaje aceptado que no se entregó

De los tres avisos del flujo llegaron dos: el de cancelación **no llegó**, y el backend no
tenía nada para loguear porque Meta había respondido que lo aceptaba. Ejecutar el mismo
`enviarAvisoDeCancelacion` de nuevo, sobre el mismo turno, **sí** entregó.

No hay diagnóstico: la causa no se puede saber sin los webhooks de estado, que están fuera
de alcance. La hipótesis —sin confirmar— es que los tres mensajes salieron con segundos de
diferencia al mismo destinatario y el tercero se cayó por algún límite del número de
prueba. **Lo que sí confirma es que la advertencia del final de este archivo no es teórica:
un 200 de Meta no es una entrega, y el respaldo por mail no cubre este caso** porque para
el backend el envío fue exitoso.

### ⚠️ El `9` no se pudo probar, y hay evidencia que contradice lo documentado

La lista de destinatarios del número de prueba **no acepta la forma con `9`** ni cargándola
a mano y verificándola: sigue rechazando con `131030`. Para poder correr el flujo se parcheó
`aE164` **temporalmente y en local** para que no agregue el `9`, y se revirtió al terminar.

Eso deja una consecuencia incómoda: **el flujo completo se probó con la forma que producción
no va a usar.** Y además apareció esto:

- Enviando a `54…` (sin `9`), Meta responde `wa_id: 549…` — o sea que **normaliza sola**.
- Los mensajes enviados así **llegaron todos**.

La nota de la Etapa 2 dice que sin el `9` "el mensaje no llega nunca". **Eso no es lo que se
observó.** No alcanza para cambiar la regla —es un número, en un entorno de prueba, y el
riesgo de equivocarse es que no llegue ningún aviso— pero sí para **volver a medirlo con el
número real de Ariel** en vez de darlo por sabido.
