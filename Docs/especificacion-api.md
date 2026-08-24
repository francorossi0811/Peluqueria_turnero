# Especificación de la API REST
### Turnero — La Peluquería de Ariel Enrique

---

## 1. Convenciones generales

- **Base URL:** `/api`
- **Formato:** JSON en request y response (`Content-Type: application/json`). Única
  excepción: `GET /api/turnos/:id/calendario.ics` devuelve `text/calendar` como archivo
  descargable (HU-19).
- **Nombres de campos:** JSON en `camelCase`; las columnas de base de datos están en
  `snake_case` (ver `Docs/modelo-datos.md`) — el mapeo es responsabilidad de la capa de
  backend, no se expone `snake_case` en la API.
- **Fechas y horas:** el negocio opera en un solo huso horario (`America/Argentina/
  Buenos_Aires`), así que `fecha` y `hora` viajan como valores "de pared", sin conversión:
  - `fecha`: `"YYYY-MM-DD"`
  - `hora`: `"HH:mm"`
  - `createdAt` / `updatedAt`: ISO 8601 completo en UTC (son metadatos, no horarios de
    atención).
- **Autenticación:** rutas bajo `/api/admin/*` requieren header
  `Authorization: Bearer <jwt>`. Las rutas públicas (flujo del cliente) no requieren
  autenticación — usan el `id` del turno como token de acceso (ver
  `Docs/modelo-datos.md`, tabla `turnos`).
- **Duración y renovación de la sesión (HU-15):** el token vale 7 días. Cuando ya pasó la
  mitad de su vida, cualquier respuesta de una ruta `/api/admin/*` incluye el header
  `X-Token-Renovado` con un token nuevo, y el cliente **debe** reemplazar el que tenía
  guardado. Así la sesión se extiende sola mientras Ariel use el panel, sin endpoint de
  refresh ni cookies. El header está declarado en `Access-Control-Expose-Headers`, sin lo
  cual el browser no podría leerlo cuando el frontend está en otro dominio.
- **Invalidación por cambio de contraseña (HU-16):** un token emitido antes del último
  cambio de contraseña se rechaza con `401 TOKEN_INVALIDO`, aunque todavía no haya
  vencido.
- **Formato de error:**
  ```json
  { "error": { "codigo": "HORARIO_NO_DISPONIBLE", "mensaje": "Ese horario ya no está disponible." } }
  ```
  Los códigos son identificadores estables en `SCREAMING_SNAKE_CASE`, pensados para que el
  frontend decida qué mostrar sin tener que parsear el mensaje humano.

---

## 2. Endpoints públicos (Cliente — sin autenticación)

### Servicios

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/servicios` | Lista los servicios **activos** (para elegir en el flujo de reserva, HU-01) |

Devuelve `id`, `nombre`, `duracionMinutos`, `precio` y `foto` (la imagen de la landing;
`null` cae a una de stock). No lleva `activo`: acá son todos activos.

⚠️ **`precio` sale desde el 14/8/2026, y eso enmienda a HU-27**, que hasta esa fecha decía
que el precio era interno y el cliente no lo veía nunca. Franco lo cambió: quiere que sepa
cuánto sale antes de reservar. `GET /api/turnos/:id` (el link de gestión) también lo lleva,
dentro de `servicio`, y ahí es **el precio de hoy**, no el del día en que reservó — al revés
que `nombre` y `duracionMinutos`, que son el snapshot.

⚠️ Lo que **sigue sin salir** por la API pública es el **cobro**: `medioPago` y
`montoCobrado` viven en el turno y viajan solo en el DTO de admin. Y el mapeo campo por
campo del controller se mantiene igual de explícito, porque es lo que obliga a decidir dato
por dato qué se publica: sin él, cualquier columna interna que se le agregue al modelo
saldría sola y nada fallaría.

### Disponibilidad — CU-04

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/disponibilidad?servicioId=&desde=&hasta=` | Horarios disponibles para ese servicio entre `desde` y `hasta` (fechas), aplicando `horario_laboral`, `bloqueos_horario`, `feriados` y turnos ya reservados (CU-04) |
| GET | `/api/admin/disponibilidad?servicioId=&desde=&hasta=&incluirPasado=` | 🔒 Lo mismo, con las reglas de Ariel: sin la antelación mínima de 30 min y, con `incluirPasado=true`, los últimos 7 días (HU-08) |

⚠️ **Son dos rutas y no un parámetro de la primera**, por el mismo criterio que
`POST /api/turnos` vs `POST /api/admin/turnos`: es la ruta la que expresa quién pregunta.
Un flag en la ruta pública despegaría la grilla que ve el cliente de lo que realmente puede
reservar, y dejaría un parámetro invitando a que alguien lo cablee a la creación.

La ruta admin **recorta** `desde` en vez de rechazarlo cuando se pide más atrás del piso
(hoy, o hoy − 7 con `incluirPasado`): un 400 por pedir un día de más dejaría la grilla vacía
sin explicar nada. La ventana de 7 días la vuelve a validar `POST /api/admin/turnos`, que
responde **400 `PARAMETROS_INVALIDOS`** si la fecha se pasa.

La ruta **pública** recorta de los dos lados por el mismo motivo: `desde` nunca antes de hoy, y
desde HU-28 `hasta` nunca más allá de **hoy + 90 días**. Si el recorte deja el rango dado vuelta
(se pidió solo días fuera del horizonte), devuelve `{ "disponibilidad": [] }` en vez de un error.
Ese techo es lo que mantiene la promesa del párrafo de arriba en la otra dirección: la grilla no
puede ofrecer un día que `POST /api/turnos` va a rechazar con `FUERA_DE_HORIZONTE`. La ruta admin
**no** tiene techo — Ariel ya toma turnos a meses vista.

Response:
```json
{
  "disponibilidad": [
    { "fecha": "2026-08-04", "horarios": ["10:00", "10:30"], "estado": "disponible", "motivo": null },
    { "fecha": "2026-08-05", "horarios": [], "estado": "bloqueado", "motivo": "Cerrado por mudanza" },
    { "fecha": "2026-08-09", "horarios": [], "estado": "cerrado", "motivo": null },
    { "fecha": "2026-08-11", "horarios": [], "estado": "completo", "motivo": null }
  ]
}
```

`estado` explica **por qué** un día no tiene horarios, y es lo que permite decirle al
cliente algo útil en vez del mismo "no hay turnos" para todo:

| estado | significa |
|---|---|
| `disponible` | hay horarios para reservar |
| `cerrado` | ese día de la semana la peluquería no abre (no hay franjas en `horario_laboral`) |
| `feriado` | feriado con `bloquea = true`; `motivo` trae el nombre del feriado |
| `bloqueado` | Ariel bloqueó el día completo; `motivo` trae lo que él escribió, si escribió algo |
| `completo` | atiende, pero no quedó ningún hueco libre |

`motivo` es `null` salvo en `feriado`, `bloqueado` y —desde HU-24— en un día
`disponible` o `completo` que sea **feriado de medio día**: ahí trae el nombre del feriado
y el horario recortado ("Día del Trabajador: atendemos de 10:00 a 13:00."), porque si no el
cliente ve la mitad de los horarios de siempre y no entiende por qué. Un bloqueo parcial (solo unas horas)
no cambia el estado del día: si quedan huecos sigue siendo `disponible`, y si no queda
ninguno el día figura como `completo`.

### Turnos — HU-01 a HU-04, CU-01, CU-02

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/turnos` | Crea una reserva (CU-01) |
| GET | `/api/turnos/:id` | Detalle del turno (el link único que recibe el cliente apunta acá) |
| POST | `/api/turnos/:id/cancelar` | Cancela el turno, valida ventana de 60 min (CU-02) |
| POST | `/api/turnos/:id/reprogramar` | Reprograma a un nuevo horario, valida ventana de 60 min + disponibilidad (CU-02, HU-04) |
| GET | `/api/turnos/:id/calendario.ics` | El turno como evento de calendario (HU-19). Devuelve `text/calendar`, no JSON. Público por el mismo motivo que `GET /api/turnos/:id`: el id *es* el token |
| POST | `/api/turnos/:id/enviar-confirmacion` | Carga el email de un turno que no lo tenía y le manda la confirmación (HU-19). **Un solo uso por turno** |

`POST /api/turnos` acepta además `clienteEmail` (opcional, HU-19). Un string vacío se
trata como "no dejó email"; uno con formato inválido responde `400 PARAMETROS_INVALIDOS`.
Si hay email, se envía la confirmación con el link y el `.ics` adjunto — también al
reprogramar, porque reprogramar genera un turno nuevo y por lo tanto un link nuevo.

`clienteTelefono` se valida en **dos niveles**, los dos en `backend/src/utils/validaciones.ts`
y los dos con respuesta `400 PARAMETROS_INVALIDOS`:

1. `esTelefonoValido` — cómo está escrito: dígitos, espacios, guiones, paréntesis y un `+`
   inicial, con entre 8 y 15 dígitos.
2. `esTelefonoUtilizable` — si el número **puede existir**: que `aE164` lo pueda interpretar
   contra la metadata `max` de `libphonenumber-js`, que conoce las características
   realmente asignadas.

⚠️ **Los dos corren en las tres puertas** (este endpoint, `POST /api/admin/turnos` y
`PATCH /api/admin/turnos/:id/telefono`) desde el 14/8/2026. Antes el segundo vivía solo en
el PATCH, y esa asimetría era un defecto real: un número bien escrito pero inexistente
(`2954123456`) entraba en la reserva, el turno quedaba **sin ficha** porque no se lo podía
normalizar, y cuando Ariel lo quería completar a mano el PATCH le decía "inválido" sobre un
número que el sistema ya había aceptado. Una regla decidía si entraba y otra distinta si
servía, en momentos distintos, y el que se comía el problema era el que ya no podía
corregirlo.

La copia del frontend tiene **solo la primera**: la segunda necesita metadata cara para el
bundle público. El backend rechaza y las pantallas muestran su mensaje pegado al campo.

**Obligatorio acá, opcional en `POST /api/admin/turnos`** (HU-08). El cliente que reserva
por la web tiene que dejarlo, porque es el único dato con el que Ariel lo puede ubicar;
Ariel, en cambio, carga turnos con la persona enfrente y sin saberse el número. El schema
de la carga manual **sobrescribe** ese campo en vez de que el público lo afloje, así que
la regla estricta sigue siendo la del flujo público. Vacío significa "no lo sé" y se
guarda como `null`; si viene algo, tiene que ser válido igual.

**POST `/api/turnos`** — body:
```json
{ "servicioId": "uuid", "fecha": "2026-08-04", "hora": "10:00", "clienteNombre": "Juana Pérez", "clienteTelefono": "+54 9 11 ..." }
```
Response `201`:
```json
{ "id": "uuid-del-turno", "estado": "reservado", "fecha": "2026-08-04", "hora": "10:00", "servicio": { "id": "uuid-del-servicio", "nombre": "Corte", "duracionMinutos": 30 } }
```
Response `409` (flujo alternativo CU-01, otro cliente reservó ese horario milisegundos
antes — lo rechaza en última instancia el `EXCLUDE` constraint de la base):
```json
{ "error": { "codigo": "HORARIO_NO_DISPONIBLE", "mensaje": "Ese horario se acaba de ocupar." } }
```
Response `409` — HU-28, los dos topes de la reserva pública. **Los devuelven solo esta ruta y
`POST /api/turnos/:id/reprogramar`**; `POST /api/admin/turnos` no tiene ninguno de los dos:
```json
{ "error": { "codigo": "LIMITE_SEMANAL_ALCANZADO", "mensaje": "Ya tenés 3 turnos reservados para esos días. Cancelá alguno desde tu link o escribinos por WhatsApp." } }
```
```json
{ "error": { "codigo": "FUERA_DE_HORIZONTE", "mensaje": "Por ahora se puede reservar hasta 90 días adelante." } }
```
Son **409 y no 400** por el mismo criterio que `FUERA_DE_VENTANA_CANCELACION`: el request está
bien armado, lo que no da es el estado de las cosas. El límite se cuenta por ficha de cliente
(teléfono normalizado, HU-25), sobre los turnos en estado `reservado` que caen en cualquier
ventana de 7 días corridos alrededor de la fecha pedida.

⚠️ **Los tres códigos de esta ruta son 409**, así que un cliente de API que ramifique por
*status* y no por `codigo` los confunde entre sí. No es hipotético: `ReservarPage` hacía
exactamente eso y hubo que arreglarlo al agregar estos dos, porque le mostraba "ese horario se
acaba de ocupar" a alguien que había llegado a su tope semanal.

**POST `/api/turnos/:id/cancelar`** — sin body. Response `409` si faltan menos de 60
minutos:
```json
{ "error": { "codigo": "FUERA_DE_VENTANA_CANCELACION", "mensaje": "Ya no podés cancelar online. Contactá directamente a Ariel." } }
```
Después de responder dispara dos avisos (HU-22, HU-18), los dos "fire and forget": al
cliente el mensaje de cancelación y a Ariel el push de que se liberó el horario. El de
admin (`/api/admin/turnos/:id/cancelar`) manda solo el primero — Ariel no se avisa a sí
mismo.

**POST `/api/turnos/:id/enviar-confirmacion`** — body `{ "email": "juana@gmail.com" }`.
Guarda el email en el turno y le manda la confirmación con el link y el `.ics`. Response
`200`: `{ "email": "juana@gmail.com" }`.

Es para el cliente que reservó sin dejar email y lo carga después, desde la pantalla de
confirmación. **Solo funciona si el turno todavía no tiene email y está `reservado`**; si
ya tiene, responde `409 TURNO_YA_TIENE_EMAIL`. Ese límite es lo que evita que el endpoint
sea un relay de mails abierto: el id del turno es el token, así que cualquiera con el link
puede llamarlo, y sin el límite se podrían disparar mails a direcciones arbitrarias sin
tope. El chequeo y la escritura son una sola operación atómica (`updateMany` con
`clienteEmail: null` en el `where`), así que dos requests simultáneos no pasan los dos.

Como efecto secundario deseado, el email queda guardado en el turno: si el cliente después
reprograma, la reprogramación también le llega por mail.

**POST `/api/turnos/:id/reprogramar`** — mismo body que la creación (`fecha`, `hora`, y
opcionalmente nuevo `servicioId`). Internamente: valida ventana de 60 min sobre el turno
original, valida disponibilidad del nuevo horario, marca el turno original como
`reprogramado` y crea uno nuevo con `turnoOrigenId` apuntando al viejo. Devuelve el turno
nuevo (mismo shape que el POST de creación).

---

## 3. Endpoints de administración (`/api/admin/*` — JWT requerido)

### Auth y cuenta — HU-15, HU-16

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | `{ "email": "...", "password": "..." }` → `{ "token": "<jwt>" }`. Credenciales incorrectas: `401 CREDENCIALES_INVALIDAS` (no distingue cuenta inexistente de contraseña incorrecta) |
| GET | `/api/auth/recuperacion-disponible` | **Público.** `{ "disponible": true }` si el servidor puede mandar mails (HU-26) |
| POST | `/api/auth/olvide-password` | **Público.** `{ "email": "..." }` → `200` con un mensaje genérico, **exista o no la cuenta** |
| POST | `/api/auth/restablecer-password` | **Público.** `{ "token": "...", "passwordNueva": "..." }` → `{ "token": "<jwt de sesión>" }` |
| GET | `/api/admin/me` | `{ "usuario": "Ariel", "email": "...", "rol": "admin" }` — la cuenta logueada |
| PATCH | `/api/admin/password` | `{ "passwordActual": "...", "passwordNueva": "..." }` → `{ "token": "<jwt nuevo>" }` (HU-16) |

### Login por email y recuperación — HU-26

**La credencial es el email**, no el usuario: `usuario` quedó como el nombre que se
muestra en el panel. Son dos cosas distintas y estaban mezcladas en el mismo campo.

Las tres rutas de recuperación son **públicas por definición**: quien las llama es
justamente alguien que no puede entrar. La protección no es la autenticación sino:

- **`/olvide-password` responde lo mismo exista o no la cuenta.** Si la respuesta cambiara,
  el endpoint sería una forma de averiguar qué direcciones tienen cuenta en el panel. Es el
  mismo motivo por el que el login no distingue "no existe" de "contraseña incorrecta". El
  mail se manda después de responder y sin `await`, como los avisos de turno.
- **El token del mail está firmado con el secreto global más el hash actual de la
  contraseña**, así que se invalida solo al usarse: `400 TOKEN_DE_RESET_INVALIDO`. Vence a
  los 30 minutos. No hay tabla de tokens.

`/recuperacion-disponible` existe para que el login sepa si mostrar el botón. Sin cuenta de
mail configurada el mensaje se imprime en el log del servidor, y un botón que promete un
mail que no llega es peor que no tener botón — sobre todo apareciendo justo cuando la
persona ya no puede entrar. Lo único que expone es un booleano sobre la configuración del
servidor.

`/restablecer-password` devuelve un **token de sesión**: quien probó tener acceso a ese
mail y eligió una contraseña ya está autenticado, y mandarlo al login a tipear lo que
escribió hace dos segundos no agrega seguridad.

### Administración de cuentas — HU-26 (solo `super_admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/administradores` | Las cuentas: nombre, email, rol, cuándo se creó y cuándo cambió la contraseña |
| POST | `/api/admin/administradores` | `{ "usuario", "email", "password", "rol" }` |
| PATCH | `/api/admin/administradores/:id` | `{ "usuario"?, "email"? }` → `204`. Corrige el nombre o el email |
| PATCH | `/api/admin/administradores/:id/password` | `{ "passwordNueva": "..." }` → `204`. Le fija la contraseña a otra cuenta |
| PATCH | `/api/admin/administradores/:id/rol` | `{ "rol": "super_admin" \| "admin" }` → `204` |
| DELETE | `/api/admin/administradores/:id` | Borra la cuenta → `204` |

Un `admin` que las llame recibe `403 NO_AUTORIZADO`. **Esconder la sección en el panel es
comodidad, no seguridad**: la que decide es `requireSuperAdmin` en el backend.

`PATCH …/password` es la recuperación que **no depende de que el mail salga**, y por eso
existe: mientras no haya cuenta de mail configurada, el link de "me olvidé la contraseña"
no llega a ningún lado, y sin esto la única salida sería entrar a la base a mano. Escribe
`password_changed_at`, o sea que cierra las sesiones abiertas de esa cuenta — que es lo que
uno quiere cuando le resetea la contraseña a alguien.

**`PATCH /:id` existe porque un email cargado no se podía cambiar por ningún lado.** El
seed solo lo completa cuando está vacío, así que un mail mal tipeado —o un placeholder
puesto durante el desarrollo— quedaba clavado, y como el login es por email eso deja la
cuenta inutilizable sin entrar a la base a mano. A diferencia de los otros dos, **sí se
puede sobre la cuenta propia**: corregirse el mail no es un privilegio que se pueda abusar
(hay que estar logueado igual), y prohibirlo dejaría al super admin sin forma de arreglar
su propia dirección. No toca la contraseña ni cierra sesiones: cambiar el email no cambia
quién es la persona.

**El `DELETE` borra de verdad, no desactiva.** Un turno nunca se borra porque otras filas
lo referencian; una cuenta de administrador **no está referenciada por ninguna tabla**
(`administradores` no tiene relaciones, y `push_suscripciones` a propósito tampoco), así
que borrarla no deja ningún registro incompleto atrás. Mismo criterio que las etiquetas de
HU-25.

**Sus sesiones mueren solas**: `requireAuth` responde `401 TOKEN_INVALIDO` cuando la fila
del token ya no existe. Verificado — el mismo token que devolvía `200` pasa a `401` apenas
se borra la cuenta.

Los `PATCH` de contraseña y rol y el `DELETE` responden `403 NO_AUTORIZADO` sobre la
**cuenta propia**. En el `DELETE` ese único candado alcanza para no quedarse sin
administrador general: el que llama siempre es un `super_admin` y no puede ser el borrado,
así que después de cualquier borrado queda al menos uno. El `PATCH` de rol sí necesita
además el chequeo del "último `super_admin`", porque ahí el que se degrada puede ser otro. Los dos candados son contra el
mismo accidente —quedarse sin nadie que pueda administrar cuentas— que no tendría arreglo
desde la aplicación. Para cambiarse la contraseña de uno mismo está `PATCH
/api/admin/password`, que pide la actual.

Sobre `PATCH /api/admin/password`:

- Devuelve un token nuevo porque el cambio invalida todos los emitidos antes; el cliente
  tiene que reemplazar el guardado o su propia sesión queda muerta.
- La contraseña nueva debe tener al menos 8 caracteres y ser distinta de la actual;
  si no, `400 PARAMETROS_INVALIDOS`.
- Contraseña actual incorrecta responde **`400`**, no `401`:

  ```json
  { "error": { "codigo": "PASSWORD_ACTUAL_INCORRECTA", "mensaje": "La contraseña actual no es correcta." } }
  ```

  Es deliberado. El request está bien formado y el llamador *sí* está autenticado — lo
  que está mal es el dato. Además, el frontend trata todo `401` como "sesión vencida" y
  desloguea, así que un `401` acá echaría a Ariel por un error de tipeo.

### Agenda y turnos — HU-06 a HU-10, HU-12

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/turnos?desde=&hasta=` | Agenda entre dos fechas (con `desde = hasta` cubre la vista diaria HU-06; un rango de 7 días cubre la semanal HU-07) |
| GET | `/api/admin/turnos/buscar?nombre=&telefono=` | Buscar turnos de un cliente (para reenviar un link perdido, ver caso borde en `historias-de-usuario-casos-de-uso.md`) |
| POST | `/api/admin/turnos` | Carga manual de un turno (HU-08); body igual al público más `"origen": "presencial" \| "llamada" \| "whatsapp"`. Acepta fechas de hasta **7 días atrás**; más viejo que eso responde `400 PARAMETROS_INVALIDOS` |
| PATCH | `/api/admin/turnos/:id` | Mover un turno a otro horario (HU-09), sin límite de 60 min |
| POST | `/api/admin/turnos/:id/cancelar` | Cancela sin límite de 60 min (HU-10) |
| PATCH | `/api/admin/turnos/:id/estado` | `{ "estado": "realizado" \| "ausente" }`, más un `cobro` opcional (HU-12, HU-27) |
| POST | `/api/admin/turnos/marcar-vistos` | `{ "ids": ["<uuid>", …] }` → `{ "marcados": n }`. Apaga la marca "Nuevo" (HU-17) |
| PATCH | `/api/admin/turnos/:id/telefono` | `{ "clienteTelefono": "351 459 3325" }` — le carga el teléfono a un turno que se guardó sin él (HU-08) y lo engancha con su ficha (HU-25) |
| PATCH | `/api/admin/turnos/:id/cobro` | `{ "medioPago": "efectivo", "montoCobrado": 9500 }` — le carga o le corrige el cobro a un turno **ya realizado** (HU-27) |

Sobre `PATCH …/telefono`: va en un endpoint propio y no dentro de `PATCH
/api/admin/turnos/:id` a propósito. Aquel mueve el turno en el tiempo y tiene que
revalidar disponibilidad; esto solo completa un dato de contacto y no puede pisarle el
horario a nadie. Mezclarlos obligaría a mandar fecha y hora para corregir un número. Acá
el teléfono es **obligatorio** —el endpoint existe para completarlo, así que vaciarlo no
es un caso de uso— y no filtra por estado: un turno ya realizado es justo donde más ganas
hay de completar el número, porque la persona ya vino.

**El cobro viaja dentro del `PATCH …/estado` (HU-27)**, no en una llamada aparte:

```json
{ "estado": "realizado", "cobro": { "medioPago": "efectivo", "montoCobrado": 9500 } }
```

Es un solo gesto de Ariel —toca "Realizado", elige el medio— y por lo tanto una sola
escritura: partirlo en dos requests dejaría la puerta abierta a que el segundo falle y el
turno quede marcado sin cobro sin que nadie se entere. `cobro` es **opcional**: se puede
marcar Realizado sin registrarlo y completarlo después.

`medioPago` es uno de `efectivo | transferencia | mercado_pago`, y `montoCobrado`
va en **pesos enteros** (un decimal responde `400`).

⚠️ **`tarjeta` salió del enum aceptado el 21/8/2026**, pero **sigue existiendo en la base**.
Ariel no cobra con tarjeta y Franco la sacó del panel; la API la rechaza también, para que la
regla no viva solo en el frontend. Lo que **no** cambió es la lectura: un turno viejo cobrado
con tarjeta se sigue devolviendo, mostrando y sumando en `GET /api/admin/cobros` y en la
exportación. Sacarla del enum de Postgres sería una migración sobre `turnos`, que es la tabla
donde vive el `EXCLUDE` escrito a mano — mucho riesgo por un valor que nadie usa.

**Un `cobro` con `"estado": "ausente"` responde `400`**, y `PATCH …/cobro` sobre un turno
que no está `realizado` responde `409 TURNO_NO_COBRABLE`. El que no vino no pagó, y un
cancelado nunca llegó a ocurrir: aceptarles un cobro dejaría entrar plata que no existe y
los totales dejarían de cerrar contra la caja.

Sobre `PATCH …/cobro`: existe por el mismo motivo que `PATCH …/telefono`. Si el cobro solo
se pudiera registrar en el momento de marcar Realizado, un turno marcado a las apuradas
quedaría fuera de los totales para siempre. Registrar dos veces **corrige**, no duplica.

⚠️ **`PATCH …/estado` con `"realizado"` puede responder `409 TURNO_SE_SOLAPA_CON_REALIZADO`**
(14/8/2026). Desde que un turno realizado no se puede pisar, el `EXCLUDE` de la base cubre
también ese estado, y el camino para llegar acá es real: Ariel marca Ausente un turno (lo
que libera el rato), mete a otro cliente ahí, y después se acuerda de que al primero sí lo
había atendido. Hay que decidir cuál de los dos se hizo de verdad y marcar Ausente al otro.

Los turnos en la vista de admin incluyen además `vistoPorAdmin` (HU-17), `clienteEmail`
(HU-19), `cliente` (HU-25) y el cobro (HU-27: `medioPago`, `montoCobrado`, `cobradoEn`,
los tres `null` mientras no se haya registrado):

```json
{ "cliente": { "id": "uuid", "telefono": "+5493514593325", "apodo": "Flaco", "nombre": "Juan Pérez",
               "notas": "Degradé bajo.", "etiquetas": [ { "id": "uuid", "nombre": "VIP", "color": "#b68235" } ] } }
```

`cliente` es `null` cuando el turno no tiene teléfono. Viaja **dentro del turno** y no se
pide aparte porque la grilla de la semana dibuja las insignias de todos los turnos a la
vez: pedirlas por separado sería una consulta por turno en pantalla. Los que se cargan por `POST /api/admin/turnos` nacen con `vistoPorAdmin: true`:
no tiene sentido marcarle como nuevo a Ariel algo que acaba de escribir él.

`GET /api/admin/turnos` devuelve, junto a `turnos`, un contador de lo que **no** está en
pantalla:

```json
{ "turnos": [ ... ], "nuevosMasAdelante": 3, "hastaMasAdelante": "2026-08-19" }
```

`nuevosMasAdelante` son los turnos sin ver posteriores a `hasta`, dentro de un horizonte
del mismo largo que el rango consultado (mínimo una semana). Existe porque la agenda solo
trae el rango visible: sin esto, un turno que entra para dentro de tres días es invisible
hasta que Ariel navega hasta ahí. Con la vista diaria el aviso habla de "esta semana"; con
la semanal, de "la semana que viene".

### Notificaciones push — HU-18

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/push/clave-publica` | `{ "clavePublica": "<VAPID>" }`. `503 PUSH_NO_CONFIGURADO` si el servidor no tiene claves VAPID |
| POST | `/api/admin/push/suscripciones` | Body: el `PushSubscription.toJSON()` del navegador. Idempotente por `endpoint`. Guarda el `User-Agent` para poder identificar el dispositivo |
| DELETE | `/api/admin/push/suscripciones` | `{ "endpoint": "..." }` |
| POST | `/api/admin/push/prueba` | Manda un aviso de prueba → `{ "dispositivos": [...] }` |
| GET | `/api/admin/push/dispositivos` | Los dispositivos registrados y el resultado de su último envío. Cada uno trae una `huella` (hash del endpoint) para que el panel reconozca **el suyo** — sin eso no puede detectar que el navegador cree estar suscripto y el servidor no lo conoce. Es un hash y no el endpoint entero porque la URL del endpoint funciona como credencial (ver `/api/push/renovar`) |
| POST | **`/api/push/renovar`** | **Sin autenticación** — ver abajo. `{ endpointViejo, suscripcion }` → `200 { ok: true }`, o `404 SUSCRIPCION_NO_ENCONTRADA` |

La clave pública se sirve por API y no se compila dentro del frontend a propósito: una
copia de build-time se desincroniza de la del servidor sin que nadie lo note, y genera
suscripciones a las que después no se les puede enviar nada.

**`/prueba` devuelve el detalle por dispositivo, no un contador**, y la distinción
importa:

```json
{ "dispositivos": [
  { "servicio": "fcm.googleapis.com", "userAgent": "…", "estado": 201, "ok": true,  "error": null },
  { "servicio": "fcm.googleapis.com", "userAgent": null,  "estado": 403, "ok": false, "error": "…" }
] }
```

`ok: true` significa que el servicio de push **aceptó** el mensaje, no que el celular lo
haya mostrado — de ahí en más decide el sistema operativo del dispositivo. El contador
anterior (`{ "enviadas": n }`) decía lo mismo en los dos casos, y por eso una suscripción
rota con claves VAPID viejas quedó invisible durante semanas.

**`POST /api/push/renovar` no lleva autenticación, y es deliberado.** Lo llama el service
worker desde el evento `pushsubscriptionchange`, que se dispara cuando el navegador rota
la suscripción por su cuenta: ese evento corre **sin el JWT de Ariel** y puede ocurrir con
el panel cerrado, así que ni un header de autorización ni un mensaje a la página son
opciones. La autorización es **conocer `endpointViejo`**: es una URL larga que asigna el
servicio de push y no se puede adivinar, el mismo criterio con el que el id de un turno
funciona como token del link del cliente. Si ese endpoint no está en la base, responde 404
y **no crea nada** — sin ese chequeo sería un alta abierta de suscripciones arbitrarias.

### Clientes y etiquetas — HU-25

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/clientes?buscar=&etiquetaId=` | Las fichas, con visitas, última visita y próximo turno |
| GET | `/api/admin/clientes/:id` | La ficha más su historial completo de turnos |
| PATCH | `/api/admin/clientes/:id` | `{ "apodo", "notas", "etiquetaIds": [...] }`, los tres opcionales |
| GET | `/api/admin/etiquetas` | Las etiquetas configuradas |
| POST | `/api/admin/etiquetas` | `{ "nombre", "color": "#rrggbb" }` |
| PATCH | `/api/admin/etiquetas/:id` | Renombrar o recolorear |
| DELETE | `/api/admin/etiquetas/:id` | Borra la etiqueta y sus asignaciones (`204`) |

**El `buscar` pega contra apodo, nombre y teléfono a la vez**, porque Ariel no piensa en
campos: escribe "flaco" o "459" y espera encontrarlo. Los dígitos se extraen de lo que
escribió antes de buscar contra el teléfono, que está guardado normalizado — si no,
buscar "351 459" no encontraría nada.

`etiquetaIds` se manda **entero, no como delta**: es el mismo criterio que el `PUT` del
horario laboral, y por el mismo motivo — evita exponer un alta y una baja por separado
para algo que la interfaz siempre manda completo. Un id que no existe responde
`404 ETIQUETA_NO_ENCONTRADA` y no aplica ningún cambio.

Un nombre de etiqueta repetido responde `409 ETIQUETA_DUPLICADA`, y un color que no sea
un hexadecimal de seis dígitos, `400 PARAMETROS_INVALIDOS`. El color lo elige Ariel
libremente, pero el **formato** se valida: lo que se guarde ahí termina como color de
fondo en el navegador, y aceptar cualquier string sería aceptar que escriba algo que no
pinta nada.

*Hubo un `GET /api/admin/clientes/export.csv` que devolvía las fichas como CSV. Se sacó a
pedido de Ariel: las consulta en el panel, al lado del turno, y llevárselas a una planilla
no resolvía ningún problema que tuviera.* ⚠️ *Esta línea terminaba diciendo que el `.ics` de
HU-19 volvía a ser "la única excepción al todo es JSON", y dejó de ser cierto el 16/8/2026:
ahora son **dos**, con el `.xlsx` de HU-30. Exportar la agenda no es lo mismo que exportar
las fichas — ver la nota de HU-30 en las historias de usuario.*

**Ninguna ruta crea fichas.** Se crean solas al guardar un turno con teléfono, dentro de
`crearTurno`, que es el único lugar por el que pasan tanto la reserva de la web como la
carga manual de Ariel.

### Cobros — HU-27

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/cobros?desde=&hasta=` | Lo cobrado en el período: total, desglose por medio de pago y la lista de turnos |

```json
{
  "total": 21500,
  "porMedio": [ { "medioPago": "transferencia", "total": 12000, "turnos": 1 },
                { "medioPago": "efectivo", "total": 9500, "turnos": 1 } ],
  "sinRegistrar": 2,
  "turnos": [ { "id": "uuid", "fecha": "2026-08-11", "hora": "11:00", "estado": "realizado",
                "clienteNombre": "Rocío", "cliente": { "...": "igual que en la agenda" },
                "servicio": { "id": "uuid", "nombre": "Corte clásico" },
                "medioPago": "transferencia", "montoCobrado": 12000 } ]
}
```

`estado` viaja aunque acá sean todos `realizado`, y `servicio` viaja como objeto y no como
el nombre pelado, porque desde esta lista se abre el mismo modal de cobro que en la agenda:
necesita el **id** del servicio para leer el precio de hoy. El `nombre` sigue siendo el
snapshot de cuando se reservó — no es una inconsistencia, es la regla de HU-27 con cada
dato en su lugar.

`desde` y `hasta` son **inclusivos en los dos extremos** (con `desde = hasta` se pide un
solo día) y el rango tope es de 425 días — no es una regla de negocio, es la red contra un
`desde` mal tipeado que se lleve la tabla entera.

**Solo entran los turnos `realizado`.** Un cancelado o un reprogramado nunca se cobró, y un
ausente no pagó.

**`sinRegistrar` va aparte y no escondido**, y es la decisión que hace confiable a esta
pantalla: son los turnos realizados del período que todavía no tienen cobro cargado, y
**no están sumados en `total`**. Un total al que le faltan turnos sin decirlo no cierra
contra la caja y no hay forma de saber por qué. `porMedio` viene ordenado de mayor a menor.

`total` es siempre la suma de `porMedio`: se calculan en el mismo lugar justamente para que
no puedan contradecirse, porque van uno al lado del otro en pantalla.

### Exportar la agenda — HU-30

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/agenda/exportar?desde=&hasta=` | La agenda del período como `.xlsx`: una hoja por semana y un resumen al final |

Cada hoja va **agrupada por día** —una banda por día con su subtotal, y los turnos debajo—
y el estado de cada turno se pinta con los colores de HU-23. Eso es presentación y vive en
`utils/excel.ts`; el reparto en semanas y días, en `exportacion.service.ts`.

**No devuelve JSON.** Responde el archivo con
`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y
`Content-Disposition: attachment; filename="agenda-<desde>-a-<hasta>.xlsx"`, con el mismo
molde que `GET /api/turnos/:id/calendario.ics` (HU-19). Son las dos únicas rutas de esta API
que no contestan JSON.

`desde` y `hasta` son inclusivos y el tope es de **425 días**, el mismo de Cobros y no el de
31 de la agenda: acá el caso de uso *es* pedir varios meses de una. Fuera de rango, rango
invertido o fecha mal formada responden `400 PARAMETROS_INVALIDOS` — y esos sí en JSON.

**Entran todos los turnos del período menos los `reprogramado`**, cancelados incluidos. Es
un filtro distinto del de `GET /api/admin/turnos`, que deja afuera a los cancelados: la
agenda dibuja lo que está en pie y la planilla registra lo que pasó.

Los totales de cada hoja y del resumen salen de la **misma función** que alimenta
`GET /api/admin/cobros`, así que el archivo y la pantalla no pueden contradecirse. Valen las
mismas reglas: solo suman los `realizado` con cobro cargado, y los que no lo tienen se
cuentan aparte sin entrar al total.

⚠️ **La descarga necesita el JWT**, así que no se puede abrir con un `<a href>` pelado: el
panel la pide con `responseType: 'blob'` y arma el archivo en el navegador. Como el
`Content-Disposition` no es legible entre dominios sin exponerlo en el CORS, el frontend
arma el nombre por su cuenta con el mismo rango que pidió.

### Servicios — HU-13

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/servicios` | Todos los servicios (incluye inactivos) y **con `precio`** |
| POST | `/api/admin/servicios` | Crear servicio |
| PATCH | `/api/admin/servicios/:id` | Editar nombre/duración/`activo`/`precio`. No hay `DELETE`: se desactiva |

`precio` va en **pesos enteros** y es **nullable**: `null` significa "todavía no le puse
precio", que no es lo mismo que `0`. Mandar `"precio": null` explícitamente es cómo se le
saca el precio a un servicio que ya tenía uno.

⚠️ **Enmienda del 16/8/2026 (HU-29): la foto ya se edita desde el panel.** Hasta esa fecha acá
decía que `foto` se devolvía pero no se podía editar, y que se asignaba en la base o en una
migración. Cambió porque un servicio **nuevo** quedaba con una imagen genérica y Ariel no tenía
forma de arreglarlo.

Sigue **sin** ser un campo de `POST`/`PATCH /admin/servicios`: se sube por su propio endpoint
(ver abajo), porque un archivo y un formulario de texto no comparten ni el tamaño de cuerpo ni
los errores. En el modal del panel eso no se nota — al crear, el servicio se guarda primero y la
foto se sube después con el id que devolvió.

⚠️ El `foto` que sale en las respuestas es **calculado**: si hay una foto subida devuelve
`/api/imagenes/<id>`, y si no, la ruta estática que tenga la columna (`/imagenes/servicio-corte.jpg`).
Los consumidores tienen que tratarlo como una URL opaca, **no** asumir que empieza con
`/imagenes/`: las dos formas las sirven servidores distintos.

### Fotos — HU-29

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/imagenes/:id` | El binario. **Público** — ver la nota de abajo |
| GET | `/api/admin/clientes/:id/fotos` | 🔒 La galería de una ficha: `{ "fotos": [...] }`. **Sin tope de cantidad** desde el 23/8/2026 |
| POST | `/api/admin/clientes/:id/fotos` | 🔒 Suma una foto |
| DELETE | `/api/admin/clientes/:id/fotos/:fotoId` | 🔒 Borra una. `204` |
| PUT | `/api/admin/servicios/:id/foto` | 🔒 Pone o reemplaza la del servicio |
| DELETE | `/api/admin/servicios/:id/foto` | 🔒 La saca; el servicio vuelve a su ruta estática o al stock |
| GET | `/api/admin/almacenamiento` | 🔒 `{ "fotos": 12, "bytes": 1843200, "presupuestoBytes": 419430400 }` — cuánto se ocupa y sobre cuánto |

La subida viaja como **data URL dentro de un JSON**, no como multipart:
```json
{ "datos": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." }
```
Es para no sumar `multer`: el proyecto ya eligió no agregar dependencias cuando la plataforma
alcanza (el adaptador de WhatsApp usa el `fetch` nativo por lo mismo). El costo es el ~33% que
infla base64, despreciable sobre una foto de 150 KB. La respuesta es
`{ "id", "url", "bytes" }`.

Errores: **400 `IMAGEN_INVALIDA`** (no es una data URL, o el formato no está permitido — solo
`image/jpeg`, `image/png` y `image/webp`; ⚠️ **SVG se rechaza a propósito**, es un documento que
puede traer `<script>` y se serviría desde nuestro dominio), **400 `IMAGEN_DEMASIADO_GRANDE`**
(más de 600 KB ya decodificados). ⚠️ **Ya no existe `409 LIMITE_DE_FOTOS`**: el tope de 5 fotos
por ficha se sacó el 23/8/2026 a pedido de Ariel, y con él el error y el campo `maximo` de la
respuesta del listado. El peso por foto **no** cambió.

⚠️ **`GET /api/imagenes/:id` no pide autenticación, ni siquiera para las fotos de las fichas**, y
la autorización es conocer el uuid — el mismo criterio que `GET /api/turnos/:id`, donde el id *es*
el token. El motivo es mecánico: una etiqueta `<img>` **no puede mandar el header
`Authorization`**, así que exigirlo rompería a la vez la galería del panel y la landing. Se
aceptó porque son fotos de cortes sin caras (HU-29). Si eso cambia, la salida es traerlas por
axios como blob y dibujarlas con `URL.createObjectURL`.

La respuesta lleva `Cache-Control: public, max-age=31536000, immutable`. Es correcto porque el id
es inmutable: reemplazar una foto **crea otra fila con otro id**, nunca cambia el contenido de
una existente.

⚠️ **Estas rutas se montan antes del `express.json()` global** y traen su propio parser con un
límite más alto. El global tiene el default de 100 KB y rechazaría una subida con un 413 crudo
antes de llegar al handler. Subir el límite global haría que *toda* la API acepte cuerpos de
megabytes para que dos endpoints puedan; reservar un turno no tiene por qué.

### Horario laboral — HU-14

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/horario-laboral` | Franjas configuradas, agrupadas por día |
| PUT | `/api/admin/horario-laboral` | Reemplaza la configuración completa (se manda la lista entera de franjas; simplifica el caso de agregar/borrar franjas de un día sin necesitar `DELETE` por fila) |

### Bloqueos — HU-11, CU-03

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/bloqueos?desde=&hasta=` | Bloqueos vigentes en un rango |
| POST | `/api/admin/bloqueos` | Crea un bloqueo (ver flujo de confirmación abajo) |
| DELETE | `/api/admin/bloqueos/:id` | Levanta un bloqueo futuro (no reabre turnos ya cancelados por él) |

**POST `/api/admin/bloqueos`** implementa el flujo de dos pasos de CU-03 con un solo
endpoint idempotente:

1. Ariel manda `{ "fechaInicio", "horaInicio", "fechaFin", "horaFin", "motivo" }`.
2. El backend calcula qué turnos activos quedan dentro del rango.
   - Si hay turnos afectados **y** el body no trae `"confirmarCancelaciones": true` →
     responde `409` con la lista, sin crear nada todavía:
     ```json
     { "error": { "codigo": "BLOQUEO_AFECTA_TURNOS", "mensaje": "Hay 2 turnos en ese rango." } ,
       "turnosAfectados": [ { "id": "uuid", "fecha": "2026-08-10", "hora": "10:00", "clienteNombre": "Juana Pérez" } ] }
     ```
   - El frontend muestra esa lista y pide confirmación explícita a Ariel (tal como pide
     CU-03), y reenvía el mismo POST agregando `"confirmarCancelaciones": true`.
   - Con la confirmación (o si no había turnos afectados), crea el bloqueo, cancela esos
     turnos (`estado = "cancelado"`, `motivoCancelacion = "bloqueado por el local"`,
     `bloqueoCancelacionId` apuntando al bloqueo nuevo) y responde `201`.
3. **Después de responder**, le manda a cada cliente afectado el aviso de cancelación
   (HU-22), uno atrás del otro. Vale igual para `PATCH`: editar el rango cancela turnos
   exactamente igual que crearlo, así que avisa exactamente igual.
   - ⚠️ *Esto se enganchó el 14/8/2026. Era el único camino de baja que cancelaba sin
     avisar: el mecanismo existía desde HU-22 y este flujo no lo usaba, así que los clientes
     de un bloqueo se enteraban recién si abrían su link.*
   - Va fuera de la transacción y sin `await`, como el resto de los avisos: un mensaje
     caído no puede hacer fallar un bloqueo ya guardado, y mandar HTTP dentro de una
     transacción la mantendría abierta todo lo que tarde Meta en contestar.

### Feriados

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/feriados?anio=` | Feriados cargados para ese año |
| PATCH | `/api/admin/feriados/:id` | `{ "modalidad": "cerrado" \| "medio_dia" \| "dia_completo" }` — qué hace Ariel ese día (HU-24) |
| POST | `/api/admin/feriados/sincronizar?anio=` | Vuelve a traer los feriados de la fuente externa. Devuelve `{ anio, importados }`, o `502 FUENTE_NO_DISPONIBLE` si la fuente no responde |

La carga inicial corre **al arrancar el backend**, para el año actual y el siguiente (en
diciembre ya se reserva para enero), y **solo para el año que no tenga ninguna fila**: el
plan gratuito de Render duerme y levanta muchas veces por día, y sin esa guarda le
pegaríamos a una API pública gratuita en cada arranque en frío sin motivo.

El `POST …/sincronizar` es la contracara de esa guarda, y es la razón por la que existe un
endpoint disparado por el usuario donde antes este documento decía que iba a ser un job:
sin él, un feriado decretado a mitad de año no entraría nunca. Un cron no existe en el plan
gratuito de Render, y que Ariel decida cuándo refrescar es más predecible que adivinar un
intervalo.

---

## 4. Casos especiales ya cubiertos arriba

- **Concurrencia en la reserva (CU-01, flujo alternativo):** `POST /api/turnos` responde
  `409 HORARIO_NO_DISPONIBLE` si el `EXCLUDE` constraint de la base rechaza el insert por
  solapamiento — el backend no depende de una validación previa en memoria para esto.
- **Ventana de 60 minutos (CU-02):** validada en backend en `cancelar` y `reprogramar`,
  tanto en la ruta pública como — a propósito, sin ese límite — en la de admin (HU-10).
- **Confirmación explícita de bloqueo (CU-03):** ver flujo de dos pasos de
  `POST /api/admin/bloqueos` arriba.

---

## 5. Fuera de alcance de este documento

Paginación de listados largos, rate limiting y versionado de la API (`/api/v1`) — se
definen en la etapa de implementación del backend si hacen falta, no cambian el contrato ya
descripto acá.

La sincronización de feriados salió de esta lista: quedó especificada arriba, en la sección
Feriados.

---

**Siguiente etapa:** Wireframes / diseño UI.
