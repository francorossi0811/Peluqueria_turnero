# Especificación de la API REST
### Turnero — La Peluquería de Ariel Enrique | v1

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

### Disponibilidad — CU-04

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/disponibilidad?servicioId=&desde=&hasta=` | Horarios disponibles para ese servicio entre `desde` y `hasta` (fechas), aplicando `horario_laboral`, `bloqueos_horario`, `feriados` y turnos ya reservados (CU-04) |

Response:
```json
{
  "disponibilidad": [
    { "fecha": "2026-08-04", "horarios": ["10:00", "10:30", "17:00", "17:30"] },
    { "fecha": "2026-08-05", "horarios": [] }
  ]
}
```

### Turnos — HU-01 a HU-04, CU-01, CU-02

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/turnos` | Crea una reserva (CU-01) |
| GET | `/api/turnos/:id` | Detalle del turno (el link único que recibe el cliente apunta acá) |
| POST | `/api/turnos/:id/cancelar` | Cancela el turno, valida ventana de 60 min (CU-02) |
| POST | `/api/turnos/:id/reprogramar` | Reprograma a un nuevo horario, valida ventana de 60 min + disponibilidad (CU-02, HU-04) |
| GET | `/api/turnos/:id/calendario.ics` | El turno como evento de calendario (HU-19). Devuelve `text/calendar`, no JSON. Público por el mismo motivo que `GET /api/turnos/:id`: el id *es* el token |

`POST /api/turnos` acepta además `clienteEmail` (opcional, HU-19). Un string vacío se
trata como "no dejó email"; uno con formato inválido responde `400 PARAMETROS_INVALIDOS`.
Si hay email, se envía la confirmación con el link y el `.ics` adjunto — también al
reprogramar, porque reprogramar genera un turno nuevo y por lo tanto un link nuevo.

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

**POST `/api/turnos/:id/cancelar`** — sin body. Response `409` si faltan menos de 60
minutos:
```json
{ "error": { "codigo": "FUERA_DE_VENTANA_CANCELACION", "mensaje": "Ya no podés cancelar online. Contactá directamente a Ariel." } }
```

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
| POST | `/api/auth/login` | `{ "usuario": "...", "password": "..." }` → `{ "token": "<jwt>" }`. Credenciales incorrectas: `401 CREDENCIALES_INVALIDAS` (no distingue usuario inexistente de contraseña incorrecta) |
| GET | `/api/admin/me` | `{ "usuario": "ariel" }` — la cuenta del admin logueado |
| PATCH | `/api/admin/password` | `{ "passwordActual": "...", "passwordNueva": "..." }` → `{ "token": "<jwt nuevo>" }` (HU-16) |

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
| POST | `/api/admin/turnos` | Carga manual de un turno (HU-08); body igual al público más `"origen": "telefono" \| "whatsapp"` |
| PATCH | `/api/admin/turnos/:id` | Mover un turno a otro horario (HU-09), sin límite de 60 min |
| POST | `/api/admin/turnos/:id/cancelar` | Cancela sin límite de 60 min (HU-10) |
| PATCH | `/api/admin/turnos/:id/estado` | `{ "estado": "realizado" \| "ausente" }` (HU-12) |
| POST | `/api/admin/turnos/marcar-vistos` | `{ "ids": ["<uuid>", …] }` → `{ "marcados": n }`. Apaga la marca "Nuevo" (HU-17) |

Los turnos en la vista de admin incluyen además `vistoPorAdmin` (HU-17) y `clienteEmail`
(HU-19). Los que se cargan por `POST /api/admin/turnos` nacen con `vistoPorAdmin: true`:
no tiene sentido marcarle como nuevo a Ariel algo que acaba de escribir él.

### Notificaciones push — HU-18

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/push/clave-publica` | `{ "clavePublica": "<VAPID>" }`. `503 PUSH_NO_CONFIGURADO` si el servidor no tiene claves VAPID |
| POST | `/api/admin/push/suscripciones` | Body: el `PushSubscription.toJSON()` del navegador. Idempotente por `endpoint` |
| DELETE | `/api/admin/push/suscripciones` | `{ "endpoint": "..." }` |
| POST | `/api/admin/push/prueba` | Manda un aviso de prueba → `{ "enviadas": n }` |

La clave pública se sirve por API y no se compila dentro del frontend a propósito: una
copia de build-time se desincroniza de la del servidor sin que nadie lo note, y genera
suscripciones a las que después no se les puede enviar nada.

### Servicios — HU-13

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/servicios` | Todos los servicios (incluye inactivos) |
| POST | `/api/admin/servicios` | Crear servicio |
| PATCH | `/api/admin/servicios/:id` | Editar nombre/duración/`activo`. No hay `DELETE`: se desactiva |

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

### Feriados

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/feriados?anio=` | Feriados cargados para ese año |
| PATCH | `/api/admin/feriados/:id` | `{ "bloquea": false }` — Ariel "destapa" un feriado puntual para atender igual |

La sincronización con la fuente externa de feriados corre como job de backend (no como
endpoint disparado por el usuario); se detalla en la etapa de implementación del backend.

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

Paginación de listados largos, rate limiting, versionado de la API (`/api/v1`) y el
detalle de la sincronización de feriados con la fuente externa — se definen en la etapa
de implementación del backend si hacen falta, no cambian el contrato ya descripto acá.

---

**Siguiente etapa:** Wireframes / diseño UI.
