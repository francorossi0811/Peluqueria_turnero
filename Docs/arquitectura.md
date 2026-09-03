# Arquitectura — Turnero La Peluquería de Ariel Enrique

## Capas

1. **Cliente** (navegador, sin cuenta) — interfaz pública de reserva.
2. **Panel admin** (Ariel, autenticado con JWT) — gestión de agenda.
3. **Frontend** — React + Vite, desplegado en Vercel. Consume la API vía Axios (HTTPS/JSON).
4. **Backend** — API REST en Node + Express, desplegado en Render. Valida JWT en las rutas de admin. Contiene toda la lógica de negocio (cálculo de disponibilidad, reglas de cancelación/reprogramación, etc.).
5. **Base de datos** — PostgreSQL en **Neon**. (Hasta la v3 este documento decía "Neon o Supabase", como si estuviera sin decidir; está en Neon desde la v1.)
6. **Servicios externos salientes** — las únicas llamadas que el backend hace hacia afuera:
   - **Web Push** (VAPID, librería `web-push`) para avisarle a Ariel al celular cuando entra un turno (HU-18). Opcional: sin claves configuradas, el resto funciona igual.
   - **Envío de mail** para la confirmación al cliente (HU-19), detrás de una interfaz `Mailer` con dos implementaciones: Brevo en producción y una que escribe por consola en desarrollo (o mientras no haya cuenta creada). Cambiar de proveedor es agregar un archivo.
   - **WhatsApp** (Cloud API de Meta) para la confirmación al cliente (HU-22), que desde la v3 es el canal principal. Mismo molde que el mail: interfaz `Whatsapp` en `services/whatsapp/`, con la Cloud API en producción y una implementación de consola en desarrollo. Se habla por `fetch` nativo, sin dependencia HTTP.

**Por qué WhatsApp pasó de descartado a construido.** Durante la v1 y la v2 figuró como descartado —no diferido— y el motivo era real: la API exigía dedicarle un número, o sea que Ariel tenía que dejar de usar el suyo en la app de WhatsApp Business. *Coexistence* (Meta, mayo de 2026) permite el mismo número en los dos lados a la vez sin perder los chats, y eso sacó el único bloqueante que importaba. El mail no se quitó: pasó a ser el respaldo.

**Los dos avisos al cliente están detrás del mismo punto de salida.** `notificaciones.service.ts` es el único lugar que decide por dónde sale la confirmación, y los controllers siguen llamando a una sola función. Por eso agregar WhatsApp no tocó ninguno de los cuatro lugares que la disparan.

**El teléfono se normaliza al salir, no al entrar.** `utils/validaciones.ts` acepta el número como lo escribe la persona y lo guarda tal cual, porque Ariel lo lee para llamar; `utils/telefono.ts` lo traduce a E.164 recién al momento de mandar el mensaje. Separarlo así evita que un requisito de un proveedor externo cambie lo que se ve en la agenda. Se usa `libphonenumber-js` y no una expresión regular propia porque sacar el `15` de un celular argentino exige saber dónde termina la característica, y las argentinas van de 2 a 4 dígitos.

## Decisiones y por qué

- **Frontend y backend desacoplados.** Se despliegan y escalan por separado; es el patrón esperado en un proyecto de portfolio con "arquitectura modular".
- **Toda regla de negocio vive en el backend, nunca solo en el frontend.** El frontend puede deshabilitar un botón para dar buena UX, pero el backend vuelve a validar todo (disponibilidad, ventana de 60 min, etc.) porque no se puede confiar en lo que mande el cliente.
- **El cliente no tiene cuenta.** Su identidad para gestionar un turno puntual es el link único (token no adivinable), no una sesión con contraseña.
- **El admin sí tiene cuenta real (JWT)** porque tiene control total sobre la agenda de todos.
- **La API es REST**, no GraphQL ni RPC — más simple de razonar, documentar y testear para el alcance de este proyecto.

## Fuera de alcance

⚠️ Acá decía **"Integración con WhatsApp Business API — descartada, no diferida"**, y para
la v3 eso ya era falso: el canal está construido y es el principal (ver arriba y HU-22). La
línea quedó contradiciendo al propio documento tres párrafos más arriba. Lo que sigue
pendiente de WhatsApp **no es código**, son los trámites con Meta.

Lo que sí sigue fuera de alcance:

- **Dentro de WhatsApp:** los webhooks de estado de Meta (entregado / leído / rebotado), el
  recordatorio previo al turno y la respuesta automática al que escribe primero. ⚠️ Sin
  webhooks, el respaldo por mail cubre el envío que **falla**, no el que **rebota**: Meta
  responde cuando acepta el mensaje, no cuando lo entrega.
- **Cobro online / seña** (Mercado Pago), pagos parciales, historial de precios y
  facturación.
- Sistema de deudas por ausencias y multi-peluquero.

## Decisiones de la v3

- **El bloque de turnos se calcula como un turno único (HU-31).** Un bloque de N turnos
  pegados ocupa exactamente el mismo rato que un solo turno de la duración total, así que
  "¿dónde entran los tres seguidos?" se le pregunta a `calcularHorariosDelDia` con la suma de
  las duraciones. **No hay un buscador de huecos aparte**, que habría sido reimplementar CU-04
  al lado de CU-04 — con el riesgo clásico de que las dos cuentas se despeguen. De la reutilización
  salen gratis dos reglas que si no habría que programar y mantener: el bloque no cruza el
  descanso (cada franja se evalúa por separado) y no se pasa del cierre.
  - La contracara: el cliente manda **una sola hora**, la del primero, y el backend deriva las
    demás encadenando duraciones. Un bloque con huecos o superpuesto dejó de ser representable,
    así que la validación que hacía falta cuando cada turno traía su hora —y el error propio que
    la explicaba— se borraron en vez de mantenerse.

- **La reserva en grupo es el primer `$transaction` del proyecto (HU-31).** Hasta el 23/8/2026
  no había ninguno: cada escritura era una sola sentencia, y lo que impedía el daño real —dos
  personas sobre el mismo rato— era el `EXCLUDE` de la base, no una transacción. Con 2 o 3
  turnos que tienen que entrar juntos eso deja de alcanzar, y `prisma.$transaction([...])`
  garantiza que si el segundo choca, el primero tampoco queda.
  - Es la variante de **array** y no la interactiva (`$transaction(async tx => …)`) a propósito.
    La interactiva invita a meter las validaciones adentro, y para eso habría que pasarle el
    `tx` a `obtenerHorariosDelDia` y a toda la capa de disponibilidad, que hoy usa el `prisma`
    singleton importado a nivel de módulo. Sería refactorizar media capa para perseguir algo que
    el proyecto ya decidió **no** perseguir: la carrera entre validar y escribir está aceptada
    (está escrito en `validarLimiteSemanal` y en `crearTurno`), porque el daño real lo tapa el
    `EXCLUDE`. La transacción está para la **atomicidad del grupo**, no para serializar.
  - ⚠️ `vincularCliente` queda **afuera**, corriendo antes. Si la transacción falla, la ficha
    queda creada sin turnos: es una ficha vacía, no un dato falso —la persona existe y dejó su
    teléfono— y es exactamente lo que ya pasaba cuando `crearTurno` chocaba contra el `EXCLUDE`
    después de haber vinculado. Meterla adentro obligaría a pasar el `tx` a `clientes.service`.
  - Verificado contra Neon, porque no era obvio: el SQLSTATE `23P01` **sobrevive** anidado
    dentro del `$transaction` en la misma ruta (`meta.driverAdapterError.cause.code`) que ya
    leía `esViolacionDeSolapamiento`, así que el choque sigue devolviendo 409 y no 500.

- **El token de "me olvidé la contraseña" no tiene tabla (HU-26).** Es un JWT firmado con
  el secreto global **más el hash actual de la contraseña de esa cuenta**. De ahí sale que
  valga un solo uso: al restablecer, el hash cambia y el token viejo deja de verificar. La
  alternativa de manual —una tabla `password_resets` con su columna `usado_en` y un job que
  limpie los vencidos— agrega estado que se puede desincronizar para conseguir exactamente
  lo mismo. Es el mismo espíritu que `password_changed_at` en la v2: apoyarse en un dato
  que ya existe en vez de inventar una tabla.
- **El rol se lee de la base en cada request, no del JWT.** Está en la misma consulta que
  `requireAuth` ya hacía para saber si el token quedó invalidado por un cambio de
  contraseña, así que no cuesta nada. Si se leyera del token, cambiarle el rol a alguien no
  tendría efecto hasta que venciera su sesión — o sea, hasta 7 días después.
- **El botón de recuperación se esconde solo si no hay mailer real.** Sin cuenta de Brevo
  el mail se imprime en el log del servidor: el botón le prometería a Ariel algo que no va
  a pasar, justo cuando ya no puede entrar, y encima reemplazando la recuperación que sí
  funciona (que el super admin le fije una contraseña). Es el mismo criterio con el que el
  adaptador de consola de WhatsApp no cuenta como enviado.

- **La identidad de un cliente es su teléfono normalizado (HU-25).** Se apoya en
  `utils/telefono.ts`, que ya existía para WhatsApp, y por eso las fichas no trajeron
  ninguna dependencia nueva. El nombre no sirve como identidad: cambia de una reserva a la
  otra y unir por nombre juntaría a dos personas distintas que se llaman igual, en
  silencio.
- **La ficha se resuelve en `crearTurno` y no en los controllers.** Es el único lugar por
  el que pasan las dos formas de crear un turno —la reserva de la web y la carga manual de
  Ariel— así que ninguna puede quedarse sin ficha por olvido. Es el mismo criterio con el
  que `notificaciones.service.ts` es el único punto de salida de los avisos, aunque acá la
  conclusión sea la opuesta (los avisos sí se disparan desde el controller, justamente
  porque la ruta tiene que poder distinguirlos).
- **El precio se toma al cobrar, no al reservar (HU-27).** El turno no guarda un
  `precio_snapshot`, a diferencia de `servicio_duracion_snapshot`, y la asimetría es
  deliberada. La duración se congela porque decide la disponibilidad: si cambiara, movería
  turnos ya agendados. El precio no afecta nada hasta el momento del cobro, y con la
  inflación un turno reservado hace tres semanas se cobra a lo que sale hoy — que es lo que
  Ariel efectivamente cobra. Congelarlo al reservar le haría cobrar precios viejos sin que
  nada lo avise.
- **El cobro son tres columnas en `turnos`, no una tabla `pagos`.** Un pago por turno, sin
  pagos parciales ni historial. Una tabla aparte sería estado que se puede desincronizar
  del turno para conseguir exactamente lo mismo, que es el mismo argumento por el que el
  token de reset de HU-26 no tiene tabla.
- **Los medios de pago son un enum y no una tabla configurable**, al revés que las
  etiquetas de HU-25. Allá el texto que escribe Ariel *es* el contenido y por eso se
  configuran; acá el conjunto es cerrado y el desglose necesita categorías fijas para poder
  sumarse. Una tabla para cuatro valores que no cambian sería generalidad especulativa.
- **En los cobros, la base filtra y la aplicación suma.** Es la excepción al reflejo de
  "agregá en SQL", y tiene un motivo concreto: la pantalla siempre devuelve la lista de
  turnos del período, así que las filas ya están en memoria cuando hay que totalizarlas —
  un `groupBy` sería un segundo viaje a Neon para derivar algo que ya se trajo. De paso
  `resumirCobros` queda como función pura, que es lo único que se puede testear de verdad
  sin base.
- **Los horarios candidatos se re-anclan a lo agendado (14/8/2026).** No son solo la grilla
  fija de 20 minutos: también es candidato el momento en que termina cada turno o bloqueo
  (`candidatosDeLaFranja`). Una grilla fija sirve mientras todos los servicios duran lo
  mismo; con duraciones de 15, 20 y 30 minutos deja huecos que existen y no se ofrecen — una
  Barba que termina 17:15 empujaba el siguiente turno a las 17:20. El encadenado sale gratis:
  cada turno nuevo genera su propio candidato al terminar.
- **El pasado se habilita con un flag, no con un margen negativo (HU-08).** `margenMinutos`
  significa "cuánta antelación exijo"; meterle un valor negativo para decir "acepto 7 días
  atrás" mezclaría dos conceptos en una variable y dejaría sin sentido el test que protege
  la antelación del cliente. `permitirPasado` es un booleano aparte, con default `false`.
- **La ruta expresa quién pregunta, también en disponibilidad.** `GET /api/admin/disponibilidad`
  es una ruta nueva detrás de `requireAuth` y no un query param de la pública, por el mismo
  criterio que `POST /api/turnos` vs `POST /api/admin/turnos`. Un flag en la ruta pública
  despegaría la grilla que ve el cliente de lo que puede reservar. De paso arregló un defecto
  que ya existía: los dos modales del panel pedían disponibilidad al endpoint del cliente, así
  que el `margenMinutos: 0` que el backend ya aceptaba era inalcanzable desde la pantalla.
- **Un turno realizado no se pisa, y la regla vive en los dos lados (14/8/2026).** En el
  cálculo de disponibilidad y en el predicado del `EXCLUDE`. Mientras nadie pudiera cargar
  turnos en el pasado la distinción no era alcanzable; con HU-08 ampliada sí. `ausente` queda
  afuera a propósito: liberar el rato al marcarlo es un flujo real, no un descuido.
- **La validación del teléfono vale lo mismo en las tres puertas (14/8/2026).** Tener una
  regla que decide si un dato **entra** y otra distinta que decide si **sirve**, aplicadas en
  momentos distintos, produjo un turno aceptado que no se podía completar después. Cuando dos
  reglas hablan del mismo dato, o corren juntas o una de las dos sobra.
- **El backfill de fichas es un script TypeScript, no SQL dentro de la migración.**
  Traducir un teléfono a E.164 exige saber dónde termina la característica argentina, que
  es lo que resuelve `libphonenumber-js`; reimplementarlo en SQL sería repetir el error que
  la librería está ahí para evitar. La migración crea las tablas vacías y el script las
  llena.

## Decisiones de las etapas de v2

- **Renovación de sesión por header, no refresh token.** El backend devuelve un token nuevo en `X-Token-Renovado` cuando el actual pasó la mitad de su vida. Un par access/refresh con tabla de sesiones sería lo de manual, pero entre Vercel y Render implica cookies cross-site y bastante complejidad para un sistema de un solo usuario. El header exige `Access-Control-Expose-Headers`, si no el mecanismo funciona en localhost y es un no-op en producción.
- **`password_changed_at` rompe a propósito el "stateless" del JWT.** Validar el token pasa a hacer una consulta a base. Sin eso, cambiar la contraseña no cerraría las sesiones ya abiertas y la funcionalidad daría una sensación falsa de seguridad.
- **El aviso a Ariel se dispara desde el controller público, no desde el service.** Así la carga manual (HU-08) no genera aviso, y es la ruta —no un flag— la que expresa "esto vino de un cliente". Va después de responder y sin `await`: un push o un mail caído no pueden hacer fallar una reserva ya guardada.
- **El `.ics` se genera en el backend, no en el navegador.** Un solo lugar de generación, y así el mail puede apuntar a la misma URL. Se escribió a mano (~50 líneas) en vez de traer una dependencia porque es función pura y por lo tanto fácil de testear de verdad.
