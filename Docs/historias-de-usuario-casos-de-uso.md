# Historias de Usuario y Casos de Uso
### Turnero — La Peluquería de Ariel Enrique | v1

---

## 1. Actores

| Actor | Descripción |
|---|---|
| **Cliente** | Persona que reserva un turno. No tiene cuenta ni login. |
| **Administrador (Ariel)** | Dueño y único peluquero. Autenticado con JWT. |
| **Sistema** | Procesos automáticos: cálculo de disponibilidad, recordatorios, notificaciones. |

---

## 2. Historias de Usuario

*Las HU-16 en adelante se agregaron después del alcance inicial de v1, en el orden en que
se fueron construyendo — por eso no siguen el agrupamiento por actor de las primeras 15.*

### Cliente

**HU-01 — Reservar turno**
Como cliente, quiero reservar un turno eligiendo servicio, día y horario, para no tener que escribirle a Ariel por WhatsApp y esperar respuesta.
- Solo se muestran horarios realmente disponibles (considerando la duración del servicio elegido).
- Al confirmar, recibo un link único para administrar mi turno.
- No necesito crear cuenta ni contraseña.

**HU-02 — Recibir confirmación**
Como cliente, quiero recibir una confirmación clara de mi turno, para saber que quedó agendado correctamente.
- La confirmación muestra fecha, hora, servicio y el link único.
- Si dejo mi email (es opcional), me llega la confirmación por mail con el link y el turno adjunto para el calendario — así no dependo de copiar el link a mano.
- (El envío por WhatsApp sigue simulado, para cuando Ariel tenga cuenta de negocio. El mail sí es real.)

**HU-03 — Cancelar turno**
Como cliente, quiero poder cancelar mi turno usando mi link único, para liberar el horario si no puedo asistir, sin tener que llamar a Ariel.
- Solo puedo cancelar hasta 60 minutos antes del turno.
- Si intento cancelar dentro de esa ventana, el sistema me explica por qué no puedo y qué hacer (contactar a Ariel directamente).

**HU-04 — Reprogramar turno**
Como cliente, quiero reprogramar mi turno a otro día/horario usando mi link único, para no tener que cancelar y volver a reservar desde cero.
- Mismas reglas de horario disponible que al reservar por primera vez.
- Mismo límite de 60 minutos antes del turno original.
- El turno viejo queda con estado "Reprogramado" (no se borra), y se crea el nuevo vinculado a él.

**HU-05 — Recibir recordatorio**
Como cliente, quiero recibir un recordatorio antes de mi turno, para no olvidarme.
- Recordatorio simulado en v1 (marca en el panel de Ariel), real cuando se conecte WhatsApp Business API.

### Administrador (Ariel)

**HU-06 — Ver agenda diaria**
Como Ariel, quiero ver todos los turnos del día de un vistazo, para organizarme sin tener que abrir el cuaderno.

**HU-07 — Ver agenda semanal**
Como Ariel, quiero ver la semana completa, para planificar con anticipación (ej. si quiero tomarme una tarde libre).

**HU-08 — Cargar turno manual**
Como Ariel, quiero cargar un turno a mano cuando un cliente me escribe o llama, para los que no usan la web directamente.
- Mismas validaciones de disponibilidad que una reserva online (no se pueden pisar turnos).
- Puedo marcar el origen (teléfono / WhatsApp) para saber de dónde vino.

**HU-09 — Editar turno**
Como Ariel, quiero poder mover un turno a otro horario, para acomodar imprevistos sin tener que cancelarlo y perder los datos del cliente.

**HU-10 — Cancelar turno (como admin)**
Como Ariel, quiero poder cancelar cualquier turno en cualquier momento, sin el límite de 60 minutos que tiene el cliente, porque yo sí necesito flexibilidad total.

**HU-11 — Bloquear horario**
Como Ariel, quiero bloquear un rango horario (almuerzo largo, un imprevisto, una tarde libre), para que no aparezca disponible para reservas online.

**HU-12 — Marcar turno como Realizado o Ausente**
Como Ariel, quiero marcar si el cliente vino o no, para llevar un registro (sin consecuencias automáticas en v1, ya que dejamos el sistema de deudas para fase 2).

**HU-13 — Configurar servicios**
Como Ariel, quiero poder agregar, editar o desactivar servicios y sus duraciones, sin depender de que alguien le toque el código.

**HU-14 — Configurar horario laboral**
Como Ariel, quiero poder cambiar mis días y horarios de atención, para reflejar cambios reales (vacaciones, nuevo horario de invierno, etc.).

**HU-15 — Iniciar sesión**
Como Ariel, quiero acceder a mi panel con usuario y contraseña, para que nadie más pueda modificar mi agenda.
- La cuenta se crea una sola vez, al hacer el seed inicial, con la contraseña que Ariel elige por variable de entorno (`ADMIN_PASSWORD`) — no queda en ningún archivo del repo. De ahí en más la contraseña vive hasheada en la tabla `administradores` y Ariel la cambia desde el panel (HU-16); la variable de entorno no se vuelve a leer.
- La sesión dura 7 días y se renueva sola mientras use el panel: cada request autenticado la extiende, así que teniendo el panel abierto seguido no necesita volver a loguearse. Cerrar el navegador no cierra la sesión.
- Al cambiar la contraseña se cierran las sesiones abiertas en otros dispositivos (HU-16).

**HU-16 — Cambiar mi contraseña**
Como Ariel, quiero cambiar mi contraseña desde el panel, para poder elegir una que solo yo sepa y cambiarla si sospecho que alguien la tiene.
- Tengo que ingresar la contraseña actual para confirmar que soy yo.
- La nueva tiene que tener al menos 8 caracteres y ser distinta de la actual.
- Si me equivoco en la contraseña actual me lo avisa y me deja seguir en la pantalla — no me cierra la sesión.
- Al cambiarla, las sesiones abiertas en otros dispositivos dejan de valer, pero la que estoy usando sigue activa.

**HU-17 — Ver los turnos nuevos apenas entran**
Como Ariel, quiero que los turnos que reservan por la web aparezcan solos en el panel, para no tener que estar recargando la página durante el día.
- Con el panel abierto, la agenda se actualiza sola cada 30 segundos y al volver a la pestaña.
- Los turnos que todavía no vi quedan destacados y con una marca "Nuevo", para distinguirlos de un vistazo en un día cargado.
- Puedo marcarlos todos como vistos de una. Queda registrado del lado del servidor, así marcarlos en la tablet también los apaga en el celular.
- Los turnos que cargo yo a mano (HU-08) nacen ya vistos: no tiene sentido avisarme de algo que acabo de escribir.

**HU-18 — Aviso en el celular de un turno nuevo**
Como Ariel, quiero que me llegue un aviso al celular cuando entra una reserva, para enterarme aunque tenga el panel cerrado.
- El aviso trae el cliente, el servicio, el día y la hora.
- Solo avisa de las reservas que entran por la web, no de las que cargo yo.
- Se activa desde "Mi cuenta", por dispositivo, y se puede desactivar y probar desde ahí mismo.
- (En iPhone, Apple solo permite estos avisos si el sitio está agregado a la pantalla de inicio; el panel explica cómo hacerlo cuando detecta ese caso.)

### Cliente (continuación)

**HU-19 — Agregar el turno a mi calendario**
Como cliente, quiero agregar el turno al calendario de mi celular, para que me lo recuerde y para no depender de guardar un link.
- El botón está en la pantalla de confirmación y también al abrir el link de gestión.
- El evento incluye el link para cancelar o reprogramar en su descripción.
- Si dejé mi email, el turno viene además adjunto en el mail de confirmación (HU-02).
- Si reprogramo, el evento del calendario se actualiza en lugar de duplicarse.

---

## 3. Casos de uso detallados

### CU-01 — Reservar turno

- **Actor:** Cliente
- **Precondición:** Existen horarios disponibles para el servicio elegido.
- **Flujo principal:**
  1. Cliente elige servicio.
  2. Sistema calcula y muestra días/horarios disponibles según duración del servicio.
  3. Cliente elige horario e ingresa nombre y teléfono.
  4. Sistema valida que el horario siga libre.
  5. Sistema crea el turno (estado: *Reservado*), genera link único y muestra confirmación.
- **Flujo alternativo — horario ocupado en el paso 4:**
  4a. Otro cliente reservó ese horario milisegundos antes. Sistema informa "ese horario se acaba de ocupar" y refresca los horarios disponibles.

### CU-02 — Cancelar / reprogramar vía link

- **Actor:** Cliente
- **Precondición:** El cliente tiene el link único de su turno.
- **Flujo principal (cancelar):**
  1. Cliente abre el link.
  2. Sistema muestra el detalle del turno y las opciones disponibles.
  3. Cliente elige "Cancelar".
  4. Sistema valida que falten más de 60 minutos.
  5. Sistema cambia el estado a *Cancelado* y libera el horario.
- **Flujo alternativo — menos de 60 minutos:**
  4a. Sistema deshabilita la opción y muestra: "Ya no podés cancelar online. Contactá directamente a Ariel."
- **Flujo principal (reprogramar):** igual al de reserva (CU-01) pero partiendo de un turno existente; al confirmar, el turno original pasa a *Reprogramado* y queda enlazado al nuevo.

### CU-03 — Bloquear horario con turno existente

- **Actor:** Administrador
- **Precondición:** Ariel intenta bloquear un rango horario.
- **Flujo principal:**
  1. Ariel selecciona el rango a bloquear.
  2. Sistema detecta que hay uno o más turnos activos en ese rango.
  3. Sistema le muestra la lista de turnos afectados y pide confirmación explícita.
  4. Si confirma, esos turnos pasan a *Cancelado* (con motivo "bloqueado por el local") y el rango queda bloqueado.
  - *Nota: en v1 esto no dispara notificación real al cliente (solo queda registrado); cuando conectemos WhatsApp real, este es el primer caso donde un aviso automático es importante.*

### CU-04 — Cálculo de disponibilidad

- **Actor:** Sistema
- **Descripción:** Para un servicio de duración *D*, un horario `H` es válido si:
  1. `H` está dentro del horario laboral configurado ese día.
  2. `H + D` no cae dentro del descanso configurado.
  3. `H + D` no supera el cierre del turno mañana/tarde correspondiente.
  4. No existe otro turno activo que se solape con `[H, H+D)`.
- Este cálculo es el corazón del sistema — cualquier cambio en servicios u horarios pasa siempre por esta misma función, tanto para reservas nuevas como para reprogramaciones.

---

## 4. Casos borde identificados

| Caso | Resolución propuesta |
|---|---|
| Dos clientes reservan el mismo horario casi simultáneamente | Constraint de unicidad a nivel base de datos (no confiar solo en la validación del frontend) |
| Servicio de larga duración (ej. Color, 90 min) cerca del cierre o del descanso | No se ofrece como horario válido si no entra completo (ver CU-04) |
| Ariel cambia la duración de un servicio después de que ya hay turnos reservados con la duración vieja | El turno guarda una "foto" del servicio (nombre + duración) al momento de reservar, no una referencia que cambie después |
| Ariel cambia el horario laboral general | Los turnos ya reservados fuera del nuevo horario se mantienen válidos; solo los horarios *nuevos* respetan la config actualizada |
| Cliente pierde su link único | Si dejó email, el link le llegó por mail y además quedó dentro del evento del calendario (HU-02, HU-19). Si no dejó email, no hay recuperación automática: le escribe a Ariel, que busca el turno en su panel y le reenvía el link |
| Cliente reprograma repetidamente para "trabar" horarios | Fuera de alcance v1 — lo anotamos como posible mejora futura (límite de reprogramaciones) |

---

## 5. Fuera de alcance en v1 (recordatorio)

Precios · Deudas por ausencia · Multi-peluquero · WhatsApp Business API real · Recuperación autoservicio del link para clientes sin email · Recordatorio automático antes del turno (HU-05 sigue simulado; el evento de calendario de HU-19 lo cubre en parte, con la alarma del propio celular)

*Salieron de esta lista: que Ariel cambie su contraseña desde el panel (HU-16) y el envío del link por mail (HU-02, HU-19), ambos ya implementados.*

---

**Siguiente etapa:** Arquitectura del sistema (frontend / backend / base de datos y cómo se comunican).
