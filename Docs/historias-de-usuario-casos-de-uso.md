# Historias de Usuario y Casos de Uso
### Turnero — La Peluquería de Ariel Enrique

---

## 1. Actores

| Actor | Descripción |
|---|---|
| **Cliente** | Persona que reserva un turno. No tiene cuenta ni login. |
| **Administrador (Ariel)** | Dueño y único peluquero. Autenticado con JWT, rol `admin`: puede todo lo de su peluquería. |
| **Administrador general (Franco)** | Rol `super_admin` (HU-26). Lo mismo que el anterior, más administrar las cuentas del panel. Existe para que Ariel nunca quede sin poder entrar. |
| **Sistema** | Procesos automáticos: cálculo de disponibilidad, recordatorios, notificaciones. |

---

## 2. Historias de Usuario

*Las HU-16 en adelante se agregaron después del alcance inicial de v1, en el orden en que
se fueron construyendo — por eso no siguen el agrupamiento por actor de las primeras 15.*

### Cliente

**HU-01 — Reservar turno**
Como cliente, quiero reservar un turno eligiendo servicio, día y horario, para no tener que escribirle a Ariel por WhatsApp y esperar respuesta.
- Solo se muestran horarios realmente disponibles (considerando la duración del servicio elegido). Eso incluye los que quedan **pegados al final de otro turno** y no caen en la grilla redonda: si una Barba termina 17:15, las 17:15 se pueden reservar (ver CU-04).
- **Veo cuánto sale cada servicio** antes de reservar, en la tarjeta y en todo el flujo (enmienda a HU-27 del 14/8/2026 — antes el precio no se mostraba nunca).
- Al confirmar, recibo un link único para administrar mi turno.
- No necesito crear cuenta ni contraseña.
- El teléfono es obligatorio y se valida en dos niveles: **cómo está escrito** (entre 8 y 15 dígitos, admitiendo espacios, guiones, paréntesis y un `+` inicial) y **si el número puede existir** (que la característica sea real). Es el único dato con el que Ariel me puede ubicar si algo cambia, así que no puede quedar en cualquier cosa. El email es opcional, pero si lo dejo tiene que tener formato válido. (Solo es obligatorio **acá**: cuando el turno lo carga Ariel a mano, ver HU-08, puede quedar vacío.)
  - ⚠️ *La segunda regla se agregó el 14/8/2026 y corre en las tres puertas. Antes solo estaba en el endpoint con el que Ariel completa un teléfono, y esa asimetría hacía que un número bien escrito pero inexistente entrara al reservar, dejara el turno sin ficha, y después le dijera "inválido" a Ariel sobre un número que el sistema ya había aceptado. Ahora el error aparece mientras el cliente está ahí para corregirlo, pegado al campo y sin sacarlo del paso de datos.*

**HU-02 — Recibir confirmación**
Como cliente, quiero recibir una confirmación clara de mi turno, para saber que quedó agendado correctamente.
- La confirmación muestra fecha, hora, servicio y el link único. El link queda siempre visible y se puede copiar, haya dejado email o no.
- **Me llega la confirmación por WhatsApp al número que dejé, con el link adentro** (HU-22). Es el canal principal desde la v3.
- Si dejo mi email (es opcional) y el WhatsApp no se pudo mandar, me llega por mail con el link y el turno adjunto para el calendario — así no dependo de copiar el link a mano.
- Si no lo dejé al reservar, la misma pantalla de confirmación me lo ofrece ahí: cargo el mail y lo recibo, sin volver a empezar (ver HU-19).

**HU-03 — Cancelar turno**
Como cliente, quiero poder cancelar mi turno usando mi link único, para liberar el horario si no puedo asistir, sin tener que llamar a Ariel.
- Solo puedo cancelar hasta 60 minutos antes del turno.
- Si intento cancelar dentro de esa ventana, el sistema me explica por qué no puedo y qué hacer (contactar a Ariel directamente).
- **La pantalla tiene siempre a la vista un botón de WhatsApp y uno para llamar.** El aviso de arriba decía "contactá a Ariel" sin decir cómo: el número está en la página principal, a la que nunca entré — llegué por mi link.
- **Cuando la cancelación entra, me llega el mensaje** (HU-22): el comprobante de que el horario quedó liberado de verdad.
- El botón de agregar el turno al calendario quedó **último** en la pantalla. Es lo que se hace una vez y no se vuelve a tocar; reprogramar, cancelar y escribirle a Ariel son las razones por las que vuelvo acá.

**HU-04 — Reprogramar turno**
Como cliente, quiero reprogramar mi turno a otro día/horario usando mi link único, para no tener que cancelar y volver a reservar desde cero.
- Mismas reglas de horario disponible que al reservar por primera vez.
- Mismo límite de 60 minutos antes del turno original.
- El turno viejo queda con estado "Reprogramado" (no se borra), y se crea el nuevo vinculado a él.

**HU-05 — Recibir recordatorio**
Como cliente, quiero recibir un recordatorio antes de mi turno, para no olvidarme.
- Cubierto en parte por HU-19: el evento de calendario trae su propia alarma 2 horas antes, así que me avisa mi propio celular. Un recordatorio mandado por el sistema (WhatsApp o mail) queda fuera de alcance — ver §5.

### Administrador (Ariel)

**HU-06 — Ver agenda diaria**
Como Ariel, quiero ver todos los turnos del día de un vistazo, para organizarme sin tener que abrir el cuaderno.

**HU-07 — Ver agenda semanal**
Como Ariel, quiero ver la semana completa, para planificar con anticipación (ej. si quiero tomarme una tarde libre).
- La semana va del primer al último día que trabajo. Hoy eso es martes a sábado; domingo y lunes no aparecen porque no abro.
- Esos días salen del horario laboral que tengo configurado (HU-14), no están fijos en el sistema: si algún día empiezo a abrir los lunes, la agenda lo suma sola.
- Esa semana se ve como **grilla** (HU-23), no como lista: días en columnas y el tiempo hacia abajo.
- La vista "Día" sigue siendo una lista, que es con la que opero en el celular.

**HU-08 — Cargar turno manual**
Como Ariel, quiero cargar un turno a mano cuando un cliente me escribe o llama, para los que no usan la web directamente.
- Mismas validaciones de disponibilidad que una reserva online (no se pueden pisar turnos).
- Puedo marcar el origen (**presencial / llamada / WhatsApp**) para saber de dónde vino.
  "Presencial" es el cliente de vidriera: no llamó ni escribió, entró y lo atendí. (Hasta el
  14/8/2026 las opciones eran solo "teléfono" y "WhatsApp", así que cada walk-in quedaba
  registrado con un canal falso.)
- **Puedo cargar un turno en un horario que ya pasó, hasta 7 días para atrás** (14/8/2026).
  Muchas veces entran varios clientes de vidriera seguidos, los atiendo y los registro
  después, cuando tengo un rato libre; antes eso era imposible y esos turnos no quedaban en
  ningún lado. La pantalla tiene que dejarlo clarísimo para que no confunda un turno viejo
  con uno que viene: el día y la hora se marcan en ámbar, aparece un cartel antes de
  confirmar y el botón cambia a **"Registrar turno pasado"**. Si el hueco que toqué ya pasó,
  el origen arranca en "Presencial".
  - Más de 7 días atrás no puedo: la agenda es el registro de lo que pasó, no un formulario
    de carga histórica.
  - Es **solo para mí**. El cliente que reserva por la web sigue con su antelación mínima de
    30 minutos y nunca ve una hora que ya pasó.
  - **Un turno realizado no se puede pisar.** Si el rato que quiero usar ya lo ocupa un turno
    que se hizo, no me lo ofrece; para liberarlo tengo que marcar Ausente al que no atendí.
    Un turno **ausente o cancelado** sí libera el rato, como siempre.
- **El teléfono es opcional acá**, al revés que en la reserva del cliente (HU-01). Muchas veces cargo el turno con la persona enfrente y no me sé el número de memoria; que fuera obligatorio me trababa el alta por un dato que puedo completar después. Si escribo algo, igual tiene que ser un teléfono válido.
- En el celular puedo elegir el número de mi agenda de contactos en vez de tipearlo. Es una comodidad: donde el navegador no lo permite, el botón directamente no aparece y el campo se escribe a mano.

**HU-09 — Editar turno**
Como Ariel, quiero poder mover un turno a otro horario, para acomodar imprevistos sin tener que cancelarlo y perder los datos del cliente.
- En la interfaz el botón dice **"Reprogramar"**, que es la palabra que uso. Puertas
  adentro no es lo mismo que el reprogramar del cliente (HU-04): acá se mueve el mismo
  turno, allá se crea uno nuevo enlazado al viejo. Esa diferencia es del modelo de datos y
  no de lo que estoy haciendo, así que la pantalla no la nombra.

**HU-10 — Cancelar turno (como admin)**
Como Ariel, quiero poder cancelar cualquier turno en cualquier momento, sin el límite de 60 minutos que tiene el cliente, porque yo sí necesito flexibilidad total.

**HU-11 — Bloquear horario**
Como Ariel, quiero bloquear un rango horario (almuerzo largo, un imprevisto, una tarde libre), para que no aparezca disponible para reservas online.

**HU-12 — Marcar turno como Realizado o Ausente**
Como Ariel, quiero marcar si el cliente vino o no, para llevar un registro (sin consecuencias automáticas en v1, ya que dejamos el sistema de deudas para fase 2).
- Al marcar **Realizado** me pregunta cómo pagó (HU-27). Es parte del mismo gesto: ya estoy tocando el turno que acaba de terminar, y que registrar el cobro fuera un paso aparte significa que me lo olvido.
- **Ausente no pregunta nada**: el que no vino no pagó.

**HU-13 — Configurar servicios**
Como Ariel, quiero poder agregar, editar o desactivar servicios y sus duraciones, sin depender de que alguien le toque el código.
- También le pongo la **foto** que ve el cliente en la web, incluso a uno que acabo de crear (HU-29). ⚠️ **Ampliación del 16/8/2026:** hasta esa fecha la foto solo se podía asignar tocando la base o escribiendo una migración, así que un servicio nuevo se quedaba con una imagen genérica y yo no tenía forma de cambiarla.
- También les pongo el **precio** (HU-27). Me sirve para que el cobro venga con el monto puesto y para los totales.
  - ⚠️ **Enmienda del 14/8/2026: el cliente SÍ ve el precio.** Hasta esa fecha esta línea
    decía "el cliente no lo ve en ningún momento" y era una decisión explícita de HU-27.
    Franco la cambió: el precio se muestra en la tarjeta del servicio, en todo el flujo de
    reserva y en el link de gestión del turno. Lo que sigue siendo **solo mío** es lo del
    cobro —cómo me pagaron y cuánto entró—, que vive en el turno y no sale del panel.
  - El precio que ve el cliente es **el de hoy**, no una foto del día que reservó: es el que
    le voy a cobrar cuando venga. Es la misma regla del monto cobrado, y al revés que la
    duración, que sí queda congelada porque decide la disponibilidad.
- Un servicio puede no tener precio todavía. No es lo mismo que valga $0: cuando no lo cargué, el cobro simplemente no me prellena nada.

**HU-14 — Configurar horario laboral**
Como Ariel, quiero poder cambiar mis días y horarios de atención, para reflejar cambios reales (vacaciones, nuevo horario de invierno, etc.).

**HU-15 — Iniciar sesión**
Como Ariel, quiero acceder a mi panel con mi email y una contraseña, para que nadie más pueda modificar mi agenda.
- **Entro con mi email** (HU-26), no con un nombre de usuario. El nombre sigue existiendo, pero solo como lo que se muestra en el panel: son dos cosas distintas y antes estaban mezcladas en el mismo dato.
- La cuenta se crea una sola vez, al hacer el seed inicial, con el email y la contraseña que se eligen por variable de entorno (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) — no quedan en ningún archivo del repo. De ahí en más la contraseña vive hasheada en la tabla `administradores` y Ariel la cambia desde el panel (HU-16); las variables de entorno no se vuelven a leer.
- La sesión dura 7 días y se renueva sola mientras use el panel: cada request autenticado la extiende, así que teniendo el panel abierto seguido no necesita volver a loguearse. Cerrar el navegador no cierra la sesión.
- Al cambiar la contraseña se cierran las sesiones abiertas en otros dispositivos (HU-16).
- **La flechita de atrás del navegador no me saca de la sesión.** Con la sesión viva, la pantalla de ingreso no se muestra: lleva derecho al panel. Es una aplicación web y Ariel usa el botón de atrás como en cualquier página; que le apareciera el formulario de ingreso le hacía creer que lo había echado, cuando en realidad la sesión seguía abierta y el "adelante" volvía al panel sin pedirle nada.

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
- **También me avisa cuando un cliente cancela desde su link**, con un aviso propio que no reemplaza al de la reserva. Sin esto, un horario que se liberó solo se ve mirando la agenda. Las bajas que hago yo desde el panel no me las avisa: ya las sé.
- Se activa desde "Mi cuenta", por dispositivo, y se puede desactivar y probar desde ahí mismo.
- Cada turno genera su propio aviso: dos reservas seguidas no se pisan entre sí.
- Si el navegador cambia la suscripción por su cuenta, el sistema la renueva solo. Antes eso me dejaba sin avisos sin que nada lo dijera: el panel seguía mostrando "activados".
- **El aviso al celular no es el único canal, y a propósito.** Depende del servicio de notificaciones del sistema operativo, del ahorro de batería y de qué navegador use cada dispositivo — cosas que la aplicación no controla. Por eso existe también HU-20, que funciona siempre.
- La pantalla de prueba distingue **aceptado** de **entregado**: el servidor solo puede saber que el servicio de push tomó el mensaje. Si no aparece en el celular, el problema está en el dispositivo, y el panel lo dice con esas palabras en vez de un "enviado" que engaña.
- Hay una **prueba local**, que dibuja la notificación sin pasar por internet. Sirve para separar los dos problemas posibles: si la local se ve y la otra no, falla la entrega; si no se ve ninguna, falla el permiso o el sistema.
- (En iPhone, Apple solo permite estos avisos si el sitio está agregado a la pantalla de inicio; el panel explica cómo hacerlo cuando detecta ese caso.)

**HU-20 — Ver los avisos sin depender del celular**
Como Ariel, quiero darme cuenta de que entraron turnos nuevos con solo mirar la pestaña del navegador, para no depender de que el aviso del celular funcione.
- La pestaña muestra la cantidad entre paréntesis, como WhatsApp: "(3) La Peluquería…".
- El ícono de la pestaña lleva un punto rojo mientras haya turnos sin ver.
- Con el panel instalado como aplicación, el punto aparece también sobre el ícono en el celular.
- Todo vuelve a la normalidad solo cuando marco los turnos como vistos.
- El panel sigue consultando aunque la pestaña esté en segundo plano (más espaciado, para no cargar el servidor de más): si dejara de consultar, el contador nunca se actualizaría, que es justo cuando hace falta.

**HU-21 — Ver el panel con fondo oscuro**
Como Ariel, quiero poder poner el panel en fondo oscuro con letras claras, porque uso lentes y el fondo claro me cansa la vista en una jornada larga.
- Es la opción por defecto, así no tengo que configurarlo en ninguno de mis dispositivos.
- Hay un interruptor en "Mi cuenta" para volver al claro, y la elección se recuerda en ese dispositivo.
- **Solo cambia el panel.** Lo que ven los clientes queda siempre como está, porque el diseño ya estaba aprobado.
- Se mantiene la estética: misma tipografía, mismo ámbar de marca, mismos componentes. Cambian los valores de color, no el diseño.

**HU-22 — Recibir los avisos de mi turno por WhatsApp**
Como cliente, quiero que los avisos de mi turno me lleguen por WhatsApp, porque es donde miro los mensajes — no uso el mail.
- Llega al número que dejé al reservar, con el servicio, la fecha y la hora.
- Trae un botón que abre directamente mi turno, para cancelar o reprogramar sin buscar nada.
- También me llega si el turno lo cargó Ariel a mano y le di mi número: es la única forma de que yo tenga el link.
- Si reprogramo, me llega la confirmación nueva con el link nuevo, y me avisa que el anterior ya no sirve.
- **Si se cancela, también me llega el aviso**, cancele yo desde mi link o lo cancele Ariel desde el panel. Ese segundo caso es el más importante de los tres mensajes: es la única forma de que me entere de que no me esperan.
- El aviso de cancelación **no trae el link de mi turno**, porque ese turno ya no se gestiona. Trae un botón para sacar otro.
- **Si no se pudo mandar** (no dejé teléfono, el número no se entiende, o el envío falló), me llega por mail como antes. Nunca me quedo sin aviso por los dos lados a la vez.

*Son tres mensajes distintos —confirmado, reprogramado y cancelado—, cada uno aprobado por Meta por separado. Los textos están en `Docs/plantillas-whatsapp.md`; los tres comparten las mismas variables a propósito, para que el sistema no tenga que armar cada uno por su lado.*

*Notas de implementación, porque son las dos cosas que pueden fallar en silencio:*
- *El número se traduce al formato internacional antes de mandarlo. En Argentina eso significa resolver el `0`, el `15` y el `9` de celular: `351 459 3325` tiene que salir como `5493514593325`. Si sale sin el `9`, WhatsApp lo acepta igual y el mensaje no llega nunca.*
- *WhatsApp responde cuando **acepta** el mensaje, no cuando lo **entrega**. O sea que un número que existe pero no tiene WhatsApp se ve igual que un envío exitoso, y en ese caso el respaldo por mail no se dispara. Distinguirlos requiere los webhooks de estado de Meta, que no están hechos.*

**HU-23 — Ver la semana como grilla, con los huecos a la vista**
Como Ariel, quiero ver la semana entera con los días en columnas y las horas hacia abajo, para saber de un vistazo **dónde tengo huecos** — que es lo que venía haciendo en una planilla aparte.
- Los días que trabajo son las columnas; el tiempo va hacia abajo, con una línea cada 20 minutos.
- **Un turno ocupa exactamente lo que dura.** Uno de 35 minutos se ve más largo que uno de 20: en la planilla los dos ocupaban una celda igual y eso se perdía.
- El corte entre la mañana y la tarde se dibuja, como la franja que usaba de referencia en la planilla.
- El día de hoy va resaltado y **una línea roja marca la hora actual**, como en Google
  Calendar. **La hora del margen izquierdo a esa altura también se pone en roja**, así
  ubico el momento sin seguir la línea con el dedo hasta el borde.
- **La línea baja sola** a medida que pasa el tiempo, sin que yo recargue nada.
- **El turno que estoy atendiendo se marca con un borde más grueso, no con otro color.**
  Su color tiene que seguir diciendo su estado: si se pintara de rojo, mientras dura no
  podría distinguir uno reservado de uno al que el cliente faltó. En la vista Día lleva
  además una marca "Ahora".
- **El color dice el estado, y solo eso:** miel lo que viene, verde lo que ya se hizo,
  rojo el que no vino. Los tres se ven igual de claros con el fondo claro y con el oscuro.
- **Los feriados tienen su propio color** (violeta), distinto del de un horario bloqueado.
  Son dos motivos distintos por los que un rato no está disponible: si se ven iguales, no
  puedo saber cuál estoy mirando.
- **Toco un hueco y cargo un turno ahí mismo**, con el día y la hora ya puestos.
- **Dos turnos que comparten un rato se ponen lado a lado, cada uno en media columna**, y
  ninguno tapa al otro. Que se pisen **no es un error**: si a los 10 minutos el cliente no
  vino, lo marco Ausente y meto a otro en lo que queda del rato — para eso sirve marcarlo.
  Antes los dos se dibujaban uno encima del otro y el de abajo desaparecía de la pantalla.
  Si se pisan tres van en tres columnas, y los que no se pisan entre sí comparten columna,
  así los bloques no se angostan más de lo necesario. **Un turno que no comparte el rato
  con nadie —el caso normal— se sigue viendo del ancho entero.**
- Los ratos en los que no abro (por ejemplo las 9 de la mañana un martes, que solo abro el sábado) se ven rayados y no se pueden tocar: mostrarlos como libres sería mentir.
- Los horarios que ya pasaron tampoco se tocan — miro semanas anteriores para saber quién vino, no para cargar turnos ahí.
- Cada turno muestra el nombre **en mayúsculas y en blanco**, para leerlo de lejos: uso lentes. El color del turno lo dan el fondo y el borde, no la letra.
- El color dice el estado: verde realizado, rojo ausente, y el pendiente se parte en dos según **cuándo**: **blanco** el que está abierto (hoy, o un día que ya pasó y quedé sin cerrar) y **amarillo** el que todavía va a pasar. Un turno que todavía no vi lleva un anillo alrededor.
- ⚠️ *Enmienda del 23/8/2026:* antes el blanco era solo el de **hoy**, así que un turno de ayer que no marqué volvía a amarillo y se veía igual que uno de la semana que viene. Justo el que tengo que ir a cerrar era el que quedaba disfrazado de futuro. Ahora el amarillo quiere decir una sola cosa: **todavía no llegó**.
- Los feriados se ven en la grilla: el día lleva el nombre del feriado arriba, y el rato en que no atiendo queda rayado — en un feriado de medio día, la tarde entera.
- Un turno ya reservado en la tarde de un feriado de medio día **se sigue viendo**. El feriado deja de ofrecer horarios nuevos, no borra los que ya estaban.

- Cada turno muestra la **marca del cliente** (HU-25): los círculos de color de sus
  etiquetas, al lado del nombre. Sin texto — el color habla solo, que es para lo que lo
  usaba en la planilla.
- Si le puse un apodo al cliente, el turno muestra **el apodo** y no el nombre con el que
  reservó: "Flaco" es como lo tengo yo, no "Juan Ignacio Pérez".
- **Toco un turno y se abre su detalle**, no el reprogramar. Primero veo de quién es —con
  su ficha, sus etiquetas y mis observaciones— y recién ahí decido si lo reprogramo o lo
  cancelo. Antes el toque me abría directo la pantalla de mover el horario, que es lo que
  menos hago.
- Desde ese detalle también **marco Realizado o Ausente** (HU-12), con las mismas cuatro
  acciones y en el mismo orden que en la vista Día. Antes desde la semana solo podía
  reprogramar o cancelar: para cerrar un turno —que es lo que más hago— tenía que cambiar
  de vista.

- Cada turno **realizado** muestra si ya lo cobré (HU-27): una marca discreta cuando sí, y
  una que llama la atención cuando todavía no. Es lo único que necesito de la plata acá —
  el monto lo miro en el detalle o en Cobros.
  **No es un color más**: el color del bloque sigue diciendo el estado y nada más, porque
  pintar dos cosas distintas con la misma señal es exactamente el problema que tenía la
  planilla.

**HU-25 — Tener una ficha de cada cliente**
Como Ariel, quiero tener una ficha por cliente con mi apodo, mis marcas y mis
observaciones, para dejar de llevar eso en la planilla y tenerlo al lado del turno.
- **La misma persona se reconoce sola por el teléfono.** Dos turnos con el mismo número
  son el mismo cliente, sin que yo tenga que unir nada. El nombre no sirve para eso: el
  mismo cliente escribe "Juan", "juan perez" y "Juan P." según el día.
- Le pongo **mi apodo**: en la planilla anoto "Flaco", "Jubilado bici", "Roja". Ese apodo
  es el que veo después en la agenda.
- Le pongo **etiquetas**, que son insignias que armo yo: un círculo del color que elijo
  más el texto que quiero ("Suele cancelar", "VIP", "Vive lejos"). Las administro desde el
  panel, no vienen de una lista fija.
- Le guardo **fotos** de cómo le quedó el corte, hasta 5 por ficha, y las borro cuando ya no
  me sirven (HU-29). ⚠️ **Ampliación del 16/8/2026:** hasta esa fecha la ficha solo tenía
  texto, y "el mismo de la otra vez" dependía de que me acordara.
- **Cuando reserva alguien que no tenía ficha, el sistema le pone solo la etiqueta
  "Nuevo".** Así, mirando la agenda, sé que a esa persona no la tengo fichada todavía y
  que vale la pena ponerle el apodo o una observación cuando la atienda.
  - Se pone **una sola vez**, al crear la ficha: la segunda reserva del mismo número no la
    vuelve a poner, porque para entonces ya no es nuevo.
  - **No se saca sola.** La saco yo desde la ficha, que es el gesto de "ya la conozco".
  - La puedo renombrar y cambiarle el color como cualquier otra, y el automatismo la sigue
    encontrando: el sistema no la busca por el nombre.
  - Si la borro, los clientes nuevos simplemente dejan de marcarse. La pantalla de
    etiquetas avisa cuál es la automática, para que borrarla no sea una sorpresa.
- Escribo **observaciones** libres, que es lo que hoy anoto al margen del cuaderno.
- Veo el **historial completo** de esa persona, incluidos los turnos que canceló. Que haya
  cancelado tres veces es justo lo que quiero ver.
- Busco por apodo, por nombre o por teléfono, sin tener que acordarme en qué campo estaba.
- Un turno que cargué **sin teléfono** (HU-08) todavía no tiene ficha: sin número no hay
  con qué reconocer a la persona. Puedo cargarle el número desde el turno y la ficha se
  crea sola en ese momento.

*Por qué no se integra con Drive:* de la planilla en Drive lo que servía era poder abrirla
desde el celular o desde la computadora del local, y eso una aplicación web ya lo da. Una
integración por OAuth sería un trámite entero para resolver algo que ya está resuelto.

*Sobre exportar **las fichas** a una planilla:* se construyó y se sacó. Ariel no la pidió, y
el motivo por el que estaba —"llevarse los datos"— resultó ser un problema que él no tiene:
las fichas las consulta en el panel, que es donde están al lado del turno. Es funcionalidad
que existía porque era fácil de hacer, no porque hiciera falta.

⚠️ *Esto **no** contradice a HU-30, que exporta la agenda.* La diferencia es justo la que
hace que una sobre y la otra no: exportar las fichas duplicaba una pantalla que ya existe,
mientras que la agenda exportada es el **registro histórico** que reemplaza a la planilla de
Drive, algo que el panel no muestra en ningún lado porque el panel enseña el presente. Y esa
la pidió Franco.

*Por qué las etiquetas son configurables y no un casillero de "cliente problemático":* la
planilla usa un color para marcar clientes porque es lo único que Sheets sabe hacer.
Heredar esa limitación sería quedarnos con lo peor de la planilla.

*Un detalle del código de colores de la planilla:* mezcla dos cosas distintas. El
amarillo/naranja describe al **cliente** y el azul/violeta describe **un pago puntual**.
Acá van separadas: la etiqueta vive en el cliente y vale para todos sus turnos; el medio
de pago de un turno concreto es HU-27, y no se dice con un color sino con el dato.

**HU-24 — En los feriados trabajo medio día**
Como Ariel, quiero que los feriados se carguen solos y que por defecto se tomen como **medio día**, porque es lo que hago casi siempre, y poder cambiarlo cuando no.
- Los feriados de Argentina se cargan solos, sin que yo los tipee.
- Por defecto atiendo **medio día**: solo el primer tramo del día (hoy, de 10 a 13).
- Puedo cambiar cada feriado a **día completo** o a **no atiendo**.
- **Mi decisión no se pisa**: si vuelvo a actualizar la lista de feriados, lo que elegí queda.
- Solo veo los feriados que caen en días que trabajo. Uno que cae domingo o lunes no me cambia nada, así que no me lo preguntan.
- Tampoco veo los que ya pasaron: sobre un feriado de marzo, en agosto no hay nada que decidir.
- Si un feriado se decreta a mitad de año, tengo un botón para volver a buscar la lista.
- Cuando un feriado es de medio día, el cliente ve por qué hay menos horarios que de costumbre.

**HU-26 — Entrar con mi email, y poder recuperarlo si me lo olvido**
Como Ariel, quiero entrar con mi email en vez de un nombre de usuario, y tener un "me olvidé la contraseña", para no depender de que alguien me la resetee a mano.
- Entro con mi **email**. El nombre que se ve arriba en el panel sigue siendo el mío, pero ya no es con lo que entro.
- Si me olvido la contraseña, pido un link por mail y elijo una nueva. **El link vale 30 minutos y sirve una sola vez**: apenas lo uso, deja de funcionar.
- Al terminar quedo adentro del panel, sin tener que volver a tipear lo que acabo de elegir.
- Cambiar la contraseña —por este camino o desde "Mi cuenta"— cierra las sesiones abiertas en otros dispositivos, igual que en HU-16.
- **El botón solo aparece si el sistema puede mandar mails de verdad.** Si no puede, no está: un botón que promete un mail que no llega es peor que no tener botón, y encima aparecería justo cuando ya no puedo entrar.

**Como Franco (administrador general), además:**
- Tengo mi propia cuenta, separada de la de Ariel.
- Veo las cuentas que existen, creo una nueva, y le puedo **fijar una contraseña** a otra cuenta. Eso es lo que hace que Ariel nunca quede afuera aunque el mail falle.
- **Es lo único que Ariel no puede hacer.** Todo el resto del panel —agenda, clientes, servicios, horarios, feriados, bloqueos— es gestionar su peluquería, y lo puede entero. No hay una segunda diferencia escondida.
- No puedo cambiarme el rol a mí mismo ni dejar el sistema sin ningún administrador general: son dos accidentes que no tendrían arreglo desde la aplicación.
- Sobre mi propia cuenta no aparece "cambiarle la contraseña": para eso está "Mi cuenta", que pide la actual. Si no, esta pantalla sería una forma de cambiar la contraseña sin saber la anterior — o sea, de aprovechar una sesión robada.

*Una cuenta sin email no puede entrar*, porque el login es por email. La pantalla de administradores las marca en rojo y el seed lo avisa al correr: es la forma de que una cuenta muerta no pase desapercibida.

**HU-27 — Registrar cómo me pagaron, y ver cuánto entró**
Como Ariel, quiero anotar cómo me pagó cada cliente y ver cuánto entró en el día, la
semana o el mes, para dejar de llevar eso de memoria y en la planilla.
- **Me lo pregunta cuando marco el turno como Realizado.** Es el momento en que la persona
  está pagando; si fuera una pantalla aparte, no la abriría nunca.
- Elijo entre **efectivo, transferencia y Mercado Pago**. Son los que uso; no necesito
  armarme una lista como con las etiquetas.
  - ⚠️ *Enmienda del 21/8/2026:* acá decía "los cuatro que uso" e incluía **tarjeta**.
    Franco la sacó porque Ariel no cobra con tarjeta: con el cliente enfrente, una opción
    que nunca es la correcta solo sirve para tocarla sin querer. **El valor sigue existiendo
    en la base** — se sacó de lo que se puede *elegir*, no de lo que se puede *mostrar*, así
    que si alguna vez se cobró así, esa plata se sigue viendo y sumando.
- El **monto viene puesto** con el precio del servicio (HU-13) y lo puedo cambiar ahí
  mismo, para el que le hago un descuento o el jubilado.
- **Puedo marcar Realizado sin registrar el cobro** y cargarlo después. A veces me pagan
  más tarde, o estoy apurado con otro cliente esperando. Ese turno me queda marcado como
  pendiente y lo completo desde el turno o desde la lista de cobros.
- Si me equivoqué, lo **corrijo** desde el mismo turno.
- En la **agenda semanal** veo de un vistazo a quién me falta cobrarle, sin abrir nada.
- Tengo una sección **Cobros** con el total del período, cuánto entró por cada medio de
  pago, y la lista de quién pagó qué. Miro hoy, esta semana, este mes, o el rango que
  quiera.
- **Desde esa misma lista toco un turno y le cargo el cobro**, o le corrijo el que tiene.
  Es donde veo juntos los que me faltan; tener que ir a buscar cada uno a su día en la
  agenda haría que la lista me señale el problema y no me deje resolverlo.
- **Los turnos que todavía no cobré se cuentan aparte y no se suman al total.** Prefiero
  que me diga "faltan 3" antes que un número redondo que no cierra con la caja y no sé por
  qué.

*Sobre el precio y el momento en que se toma:* el monto sale del precio que el servicio
tiene **el día que se cobra**, no del que tenía cuando el cliente reservó. Con los precios
moviéndose, un turno sacado hace tres semanas se cobra a lo que sale hoy — que es lo que
Ariel efectivamente cobra. Es a propósito distinto de la **duración**, que sí se congela al
reservar (ver §4): la duración decide si el turno entra en la agenda, así que cambiarla
movería turnos ya dados; el precio no afecta nada hasta el momento de cobrar.

⚠️ *Sobre que el cliente vea los precios — **esto cambió el 14/8/2026**.* Acá decía que el
cliente no los veía porque era lo que había pedido Ariel, y que "el flujo de reserva no se
tocó en nada". **Franco lo revirtió:** el precio se muestra en la tarjeta del servicio, en
todo el flujo de reserva y en el link de gestión.

El riesgo que motivaba la regla vieja sigue siendo cierto y ahora es responsabilidad de
Ariel: **un precio publicado que no se actualiza es peor que ninguno.** Lo que lo hace
manejable es que el precio que se muestra es siempre el de hoy —no una foto del día de la
reserva—, así que apenas lo edita en el panel, lo que ve el cliente cambia. Lo que **no** ve
sigue siendo el cobro: cómo pagó y cuánto entró.

*Por qué los medios de pago son una lista fija y las etiquetas no:* en las etiquetas
(HU-25) el texto que escribe Ariel *es* el contenido, y por eso se configuran. Acá el
conjunto es cerrado y estable, y el desglose necesita categorías fijas para poder sumarse.

*Lo que esto no es:* no se cobra nada por el sistema. No hay seña, ni pasarela de pago, ni
link para que el cliente pague online. Es el registro de una plata que ya cambió de manos
en el local — el equivalente de la columna de color de la planilla, con el dato adentro en
vez de en el color.

### Cliente (continuación)

**HU-19 — Agregar el turno a mi calendario**
Como cliente, quiero agregar el turno al calendario de mi celular, para que me lo recuerde y para no depender de guardar un link.
- El botón está en la pantalla de confirmación y también al abrir el link de gestión.
- El evento incluye el link para cancelar o reprogramar en su descripción.
- Si dejé mi email **y la confirmación salió por mail** (ver HU-22: el mail es el respaldo de WhatsApp), el turno viene además adjunto ahí (HU-02). El botón de la pantalla de confirmación está siempre, así que el calendario nunca depende del canal por el que me avisaron.
- Si reprogramo, el evento del calendario se actualiza en lugar de duplicarse.
- El evento avisa solo 2 horas antes, sin depender de cómo tenga configurado el calendario cada uno. Dos horas dejan margen para reacomodarse y siguen estando fuera de la ventana de 60 minutos, así que todavía puedo cancelar o reprogramar online.
- Si reservé **sin** dejar email, la pantalla de confirmación me lo ofrece ahí mismo y me manda el link con el turno adjunto. Se puede una sola vez por turno: el id del turno es el token de acceso, así que sin ese límite cualquiera con el link podría hacer que el sistema mande mails a direcciones arbitrarias. El email queda guardado, así que una reprogramación posterior también me llega.

### Administrador (Ariel)

**HU-28 — Que una sola persona no me llene la agenda**
Como Ariel, quiero que nadie pueda acaparar mis horarios reservando de a montones, para que la agenda siga sirviendo aunque reservar sea gratis y no cobre seña.
- Una misma persona puede tener **hasta 6 turnos reservados en cualquier tramo de 7 días corridos**. El séptimo de esa semana se rechaza con un mensaje que explica qué pasa y le ofrece escribirnos por WhatsApp.
- ⚠️ *Enmienda del 23/8/2026 — el tope era 3 y pasó a 6.* Lo pidió Ariel junto con la reserva en grupo (HU-31): hay clientas que vienen con los hijos y sacan tres turnos seguidos, y con 3 no les alcanzaba ni para eso, menos para volver ellas esa misma semana. Una familia no es lo que este límite quiere frenar. **La consecuencia hay que decirla: esto también afloja el tope del que reserva de a uno**, que ahora puede sacar 6 en la semana. Sostener "3 por pasada pero 6 por semana" pediría una columna de grupo en `turnos` —una migración sobre la tabla del EXCLUDE escrito a mano— para defender un caso que todavía no ocurrió.
- La "semana" es una **ventana móvil, no lunes a domingo**. Con la semana del calendario alguien podría sacar 3 turnos de viernes a domingo y 3 más de lunes a martes: seis en cinco días, todos legales. La ventana móvil no tiene esa costura.
- Se puede reservar **hasta 90 días adelante**. Antes no había ningún tope hacia el futuro y la API aceptaba un turno para dentro de dos años.
- **Cuentan solo los turnos reservados.** Un cancelado o un ausente liberaron el rato y un realizado ya pasó: ninguno de los tres le gasta un cupo a nadie. Si el cliente cancela uno, el lugar se le libera enseguida.
- Los dos límites valen igual al **reprogramar**, que es el otro momento en que un cliente elige una fecha. Al mover un turno no se lo cuenta contra sí mismo, así que acomodarlo dentro de su propia semana siempre funciona; lo que no se puede es amontonarlo en una semana ajena que ya esté llena.
- **Nada de esto me alcanza a mí.** Los turnos que cargo desde el panel no tienen tope ni de cantidad ni de fecha: yo sé a quién estoy atendiendo. Es la misma asimetría que ya existe en HU-08 y HU-10.

*Por qué el límite es por ficha de cliente y no por dispositivo ni con una seña:* la identidad que el sistema ya tiene es el teléfono normalizado (HU-25), y es la única que se sostiene sola sin pedirle un dato nuevo a nadie. Una seña resolvería el problema de raíz, pero es una pasarela de pago entera y sigue fuera de alcance (ver la sección 5).


*Lo que esto no cubre, y conviene tenerlo escrito:* quien escriba **un número distinto en cada reserva** se saltea el límite, porque para el sistema es otra persona. Taparlo pide o un límite por IP —que castiga a la familia que reserva desde la misma casa— o verificar el teléfono con un código, que le agrega un paso a **todas** las reservas para frenar un caso que todavía no ocurrió. Se decidió cubrir lo realista —la misma persona acaparando horarios, y la reserva a años vista— y dejar anotado el resto. Si alguna vez pasa de verdad, la respuesta ya existe y no es código: Ariel cancela esos turnos desde el panel, y el aviso al cliente sale solo (HU-22).

**HU-29 — Fotos en las fichas y en los servicios**
Como Ariel, quiero guardar fotos de cómo quedó el corte en la ficha de cada cliente, y ponerle una foto propia a cada servicio, para no depender de mi memoria ni dejar la web con una imagen genérica.
- En la ficha sumo **las fotos que hagan falta** por persona. Es lo que resuelve el "quiero el mismo de la otra vez", que en la planilla de papel no tenía dónde vivir. (Hasta el 23/8/2026 había un tope de 5 y lo pedí sacar: sé que ocupan, y prefiero cuidarlo yo antes de que el sistema me corte en la mitad de un trabajo.)
- **Puedo borrar las viejas**, y las borro yo: si no, el tope se convierte en una pared y el espacio se llena de fotos que ya no le sirven a nadie. En "Mi cuenta" veo cuántas hay y cuánto pesan, así decido con un número y no a ojo.
- A cada servicio le pongo **una** foto, y se la puedo poner también a uno que acabo de crear. Antes un servicio nuevo quedaba con una imagen de stock y no había forma de cambiarla desde el panel.
- Las fotos **se achican solas** antes de guardarse: una de 1,4 MB del celular queda en ~150 KB, con el lado más largo en 900 px. No tengo que hacer nada.
- Si a un servicio le saco la foto, vuelve a mostrarse la que tenía antes, o una genérica si nunca tuvo.

*Por qué las fotos se achican, y qué reemplazó al tope de 5 (enmienda del 23/8/2026):* los archivos se guardan en la base de datos, y el plan gratuito que usa el proyecto son 0,5 GB. Eso se sostenía con **dos** números: la compresión a ~150 KB y el tope de 5 fotos por ficha. Ariel pidió sacar el segundo, así que **queda uno solo**, y con él el techo dejó de ser estructural: ya no hay nada que impida que una sola ficha se lleve el espacio de cien.

Lo que ocupa ese lugar es el **medidor de "Mi cuenta"**, que por eso dejó de ser informativo: muestra el espacio usado **contra un presupuesto de 400 MB** (no los 500 de Neon — la misma base guarda turnos y clientes, y un medidor que llega al 100% cuando la base ya no acepta escrituras no avisa nada). Con ~150 KB por foto son ~2.700 fotos de margen, sobre ~230 clientes por mes: el problema no es inminente, pero pasó a depender de que alguien mire el número. **Si alguna vez se llena, lo que hay que mover es dónde viven los archivos —un bucket—, y eso no cambia una sola pantalla.**

*Por qué en la base y no en un servicio de imágenes:* no había **ningún** lugar donde un archivo subido sobreviviera — la carpeta pública del frontend se arma al compilar y el disco del servidor se borra en cada reinicio. Un servicio tipo Cloudinary pedía cuenta nueva y trámite externo, que es exactamente lo que tiene frenado a WhatsApp (HU-22). Como la aplicación solo maneja la URL `/api/imagenes/<id>`, mudarse a un bucket más adelante no cambia una sola pantalla.

*Sobre quién puede ver una foto:* la lectura es **pública para el que conoce el identificador**, que es el mismo criterio del link del turno (HU-01). No es un descuido: una etiqueta `<img>` no puede mandar credenciales, así que pedirlas rompería la galería del panel y la web a la vez. Es aceptable porque acordamos que son **fotos del corte, sin caras**. ⚠️ **Si algún día se le sacan fotos a la cara de alguien, esto hay que revisarlo**: la salida es traer la imagen con la sesión y dibujarla desde memoria, y ahí sí se puede exigir estar logueado para las de ficha.

**HU-31 — Reservar para mí y para los míos en una sola vez**
Como clienta que viene con los hijos, quiero sacar los turnos de todos de una sola pasada y seguidos, para no tener que cargar mis datos tres veces ni que nos toquen horarios sueltos.

- Elijo un servicio y lo primero que me pregunta es **cuántos turnos** quiero sacar, de 1 a 6. Después digo qué se hace cada uno: pueden ser servicios distintos (dos cortes de varón y uno de mujer).
- El sistema **busca un hueco donde entremos todos seguidos** y me ofrece solo esos horarios. La hora que elijo es la del primero; los demás arrancan cuando termina el anterior.
- Antes de confirmar veo **de qué hora a qué hora** nos queda el bloque entero, y el total a pagar.
- Los datos se cargan **una sola vez, al final**: un nombre por turno, y **un solo teléfono y un solo mail** para todos.
- Puedo **sacar uno** del bloque si me equivoqué en la cantidad, sin rehacer todo.
- Se confirman **todos o ninguno**: no me puede quedar el primero reservado y el resto no.
- Cada turno queda con **su propio link** para reprogramarlo o cancelarlo por separado, y el mensaje de WhatsApp que le mando a Ariel los lleva a todos.

*Por qué el bloque va pegado y no son horarios sueltos:* es lo que la persona quiere de verdad —venir una vez y salir con todos atendidos— y además es lo que hace que el cálculo sea exacto. Un bloque de turnos consecutivos ocupa lo mismo que un único turno de la duración total, así que la pregunta "¿dónde entran los tres?" la responde el mismo cálculo de disponibilidad de siempre (CU-04), sin una segunda cuenta que pueda contradecir a la primera. De ahí salen gratis dos cosas: el bloque **no puede cruzar el descanso** ni pasarse del cierre.

*Por qué el cliente manda una sola hora y no una por turno:* las demás las calcula el sistema encadenando duraciones. Un bloque con huecos o superpuesto **dejó de ser representable**, así que no hay nada que validar ahí. Y arregla el empaquetado: una Barba de 15 a las 10:00 hace arrancar al siguiente 10:15, sin esperar al próximo múltiplo de la grilla de 20 minutos.

*Por qué una sola ficha de cliente y no una por nombre:* la identidad es el teléfono (HU-25), y el teléfono es uno solo. La ficha queda a nombre del primero; el apodo que le ponga Ariel manda sobre eso igual que siempre. ⚠️ Consecuencia asumida: si la mamá reserva **solo** para los hijos, la ficha queda con el nombre de un hijo y su teléfono — que es exactamente lo que ya pasaba reservando de a uno.

*Por qué los turnos no quedan atados entre sí:* una vez creados son independientes en todo sentido —cada uno se cancela, se reprograma, se marca y se cobra solo—, y ninguna regla del negocio los necesita juntos. Atarlos con una columna sería estado que se escribe una vez y no se lee nunca.

⚠️ *Un bloque grande puede no entrar en ningún lado, y hay que decirlo bien:* seis turnos de 30 minutos son 180, que es exactamente lo que dura la franja de la mañana. Con un solo turno ya agendado ese día, el bloque no entra. No es un error —es la agenda diciendo que no hay lugar— pero la pantalla lo dice con esas palabras y propone sacar menos turnos, en vez de mostrar una grilla vacía día tras día.

⚠️ *Lo que se perdió a cambio:* ya no se pueden sacar turnos en **días distintos** en una sola pasada. El bloque es, por definición, un solo día y seguido. Quien quiera dos turnos en días distintos hace el flujo dos veces, que es lo que hacía antes de esta historia.

**HU-30 — Llevarme la agenda a una planilla**
Como Ariel, quiero bajarme la agenda de un período en un Excel, con una hoja por semana y las
cuentas hechas, para tener el registro de lo que pasó fuera del sistema — igual que la
planilla de Drive que usaba antes, pero sin cargarla a mano.
- Elijo el período con un **atajo de "último mes"** o poniendo las fechas a mano. El último
  mes es lo que voy a querer casi siempre.
- Cada **semana es una hoja** aparte, como las pestañas "Semana 1…5" que tenía en Drive.
- Dentro de la hoja los turnos van **agrupados por día**: cada día abre con una banda que
  dice qué día es, cuántos turnos tuvo y **cuánto entró ese día**, y abajo van sus turnos.
- En cada fila veo **hora, cliente, servicio, estado, origen, medio de pago y monto**, y al
  pie de la hoja **cuánto facturé esa semana** con el desglose por medio de pago.
- El **estado va con color** —verde realizado, rojo ausente, mostaza pendiente, gris
  cancelado—, los mismos que uso en la agenda del panel. Lo veo de un vistazo sin leer.
- La **última hoja es el resumen**: el total del período, el mismo desglose, y una línea por
  semana para ver cómo vengo.
- Entran **todos los turnos**, no solo los que cobré: los cancelados y los ausentes también,
  con su estado en una columna. Quiero ver lo que se me cayó, no solo lo que entró.
- El botón está en la agenda, adentro de **"Más opciones"**, junto a bloquear un horario y
  buscar un turno. "Cargar turno" queda afuera del menú porque es lo único que uso todos los
  días.

*Por qué las semanas se agrupan de domingo a sábado aunque las hojas se lean de martes a
sábado:* la hoja se **titula** por su martes y su sábado, que son los días que Ariel abre y
es como quiere leerla. Pero el **corte** es de domingo a sábado, la misma convención que usa
la vista Semana del panel (HU-23). Si la semana empezara el martes, un turno cargado un lunes
—Ariel abre por excepción, o registra a alguien de vidriera (HU-08)— no tendría hoja donde
caer y **desaparecería del archivo sin que nada lo delatara**. Así se lee compacto y no se
pierde nada: la hoja solo dibuja los días que tienen algo.

*Por qué los cancelados entran y los reprogramados no:* un cancelado ocurrió como decisión —
alguien pidió ese rato y lo soltó— y es información que Ariel quiere. Un **reprogramado**, en
cambio, es la copia vieja del turno que se movió (§4): el bueno ya aparece por su cuenta en la
fecha nueva, así que listarlo sería mostrar dos veces la misma visita, una de ellas en un
horario que no ocurrió.

*Por qué el color dice el estado y no el medio de pago:* es la regla de HU-23, la que
gobierna la grilla del panel, y acá se sostiene igual. Pintar por medio de pago era la otra
opción obvia y es **exactamente el defecto de la planilla de Drive** que este proyecto ya
decidió no heredar (ver HU-25): allá un color describía al cliente y otro describía un pago,
mezclados en la misma celda, y no había forma de saber cuál de los dos ejes se estaba
mirando. El medio de pago tiene su propia columna, con el nombre escrito.

*Sobre agrupar por día:* la fecha deja de ser una columna repetida en cada fila y pasa a ser
la **banda que abre el bloque**. ⚠️ El costo, que conviene saber: una planilla con bandas
adentro **no se puede ordenar ni filtrar** con las herramientas de Excel sin romper la
agrupación. Se aceptó porque este archivo se lee —es el reemplazo de la planilla de Drive,
que también se leía— y no se pivotea. Si algún día hiciera falta filtrarlo, la salida es
volver a poner la columna "Día" en cada fila.

*Sobre los cuatro medios de pago:* la tabla de facturación lista **siempre los cuatro**
(efectivo, transferencia y Mercado Pago), incluso los que quedaron en cero — más cualquier
otro que aparezca en los datos, como la `tarjeta` de un cobro viejo. Es lo que
permite comparar una semana con otra de un vistazo, o pegar una debajo de la otra: si cada
hoja mostrara solo los medios con movimiento, ninguna tendría la misma forma.

*Lo que esto no es:* no es un tablero ni un informe con gráficos. Es la agenda con las cuentas
hechas, en un formato que Ariel puede abrir, filtrar y guardar donde quiera. Los **realizados
sin cobrar** se cuentan aparte y **no** se suman al total, igual que en la sección Cobros
(HU-27), por el mismo motivo: un total al que le faltan turnos sin avisarlo no cierra contra
la caja.

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
  5. **A cada cliente afectado le llega el aviso de cancelación** (HU-22), igual que en las otras dos vías de baja.
  - ⚠️ *Nota (14/8/2026): hasta esta fecha este era el **único** camino de baja que no avisaba. Acá decía que el aviso automático de cancelación "es funcionalidad nueva, no está implementada", y eso dejó de ser cierto con HU-22 — pero el flujo del bloqueo nunca se enganchó, así que el documento y el código se contradecían en direcciones opuestas. Ya está cerrado: es justo el caso donde más falta hacía, porque son varios clientes de una y ninguno lo pidió.*
  - *Los avisos salen **después** de responder y **uno atrás del otro**, no en paralelo: bloquear una semana puede cancelar decenas de turnos, y mandar decenas de mensajes de golpe a la Cloud API es la forma de comerse un rate limit de Meta justo cuando más importa que lleguen.*
  - ⚠️ *El mensaje **no dice el motivo**: la plantilla `turno_cancelado` está aprobada con tres variables y no tiene lugar para él. Cambiarlo implica volver a pasar por la aprobación de Meta.*

### CU-04 — Cálculo de disponibilidad

- **Actor:** Sistema
- **Descripción:** Para un servicio de duración *D*, un horario `H` es válido si:
  1. `H` está dentro del horario laboral configurado ese día.
  2. `H + D` no cae dentro del descanso configurado.
  3. `H + D` no supera el cierre del turno mañana/tarde correspondiente.
  4. No existe otro turno activo que se solape con `[H, H+D)`.
- Este cálculo es el corazón del sistema — cualquier cambio en servicios u horarios pasa siempre por esta misma función, tanto para reservas nuevas como para reprogramaciones.

**De qué `H` se prueban** (14/8/2026). No alcanza con una grilla fija: los candidatos son la
grilla de 20 minutos anclada al inicio de la franja **más el momento exacto en que termina
cada turno o bloqueo de ese día**.

- El motivo, del uso real: los servicios no duran todos 20 minutos. Una Barba de 15 a las
  17:00 termina 17:15, pero el siguiente horario ofrecido era 17:20; un Corte + Barba de 30
  a las 18:00 termina 18:30 y el siguiente era 18:40. Con la agenda llena eso son 5 a 10
  minutos tirados **por turno**, y a Ariel el sistema le impedía cargar un turno en un rato
  que él tenía libre de verdad.
- Se encadena solo: si alguien reserva a las 17:15 un corte de 20, ese turno termina 17:35 y
  17:35 pasa a ser candidato. La agenda se compacta turno a turno sin ninguna regla extra.
- ⚠️ El horario pegado al final de otro turno **pasa por los mismos cuatro filtros**, en
  particular el 3: si el turno no entra completo antes del cierre, no se ofrece. Hay un test
  que lo fija sobre ese borde.
- Vale igual para el cliente y para Ariel: es una sola cuenta de disponibilidad. Que el
  cliente y el panel vieran grillas distintas es la clase de problema que ya costó caro con
  el margen de antelación.

---

## 4. Casos borde identificados

| Caso | Resolución propuesta |
|---|---|
| Dos clientes reservan el mismo horario casi simultáneamente | Constraint de unicidad a nivel base de datos (no confiar solo en la validación del frontend) |
| Servicio de larga duración cerca del cierre o del descanso | No se ofrece como horario válido si no entra completo (ver CU-04). Vale igual para los horarios pegados al final de otro turno, que son candidatos desde el 14/8/2026 |
| Ariel cambia la duración de un servicio después de que ya hay turnos reservados con la duración vieja | El turno guarda una "foto" del servicio (nombre + duración) al momento de reservar, no una referencia que cambie después |
| Ariel cambia el horario laboral general | Los turnos ya reservados fuera del nuevo horario se mantienen válidos; solo los horarios *nuevos* respetan la config actualizada |
| Cliente pierde su link único | Si dejó email, el link le llegó por mail y además quedó dentro del evento del calendario (HU-02, HU-19). Si no dejó email, no hay recuperación automática: le escribe a Ariel, que busca el turno en su panel y le reenvía el link |
| Cliente reprograma repetidamente para "trabar" horarios | ⚠️ **Enmienda del 15/8/2026:** hasta esta fecha decía "fuera de alcance v1 — posible mejora futura (límite de reprogramaciones)". HU-28 lo cubre **en parte**: reprogramar no puede amontonar más de 3 turnos en una semana ni llevarlos más allá de los 90 días, así que ya no sirve para trabar horarios lejanos ni para concentrarlos. Lo que sigue sin límite es la **cantidad de veces** que se mueve un mismo turno, que no le quita el lugar a nadie |
| Una persona reserva muchos turnos y llena la agenda | Máximo **6** turnos reservados por ficha de cliente en cualquier ventana de 7 días, más un horizonte de 90 días (HU-28). ⚠️ Eran 3 hasta el 23/8/2026; subió con la reserva en grupo (HU-31). Se cuenta por teléfono normalizado, así que **no** frena a quien invente un número distinto en cada reserva — decisión consciente, ver la nota de HU-28 |
| Los turnos de un mismo bloque se pisan entre sí | **No puede pasar.** El cliente manda una sola hora de arranque y el backend deriva las demás encadenando duraciones, así que un bloque con huecos o superpuesto no se puede ni expresar. Esto reemplazó a un chequeo explícito que existía cuando cada turno llevaba su propia hora |
| El rato del bloque se ocupa entre que se elige y se confirma | Los inserts van en una transacción: **o entran todos o no entra ninguno**. No puede quedar el primero reservado y el resto no. El cliente vuelve a elegir una hora de arranque con el bloque intacto |
| Un bloque entero no entra en el tope de la ventana de 7 días | El conteo mira el bloque **completo** contra lo ya agendado, no turno por turno: tres turnos nuevos cuentan como tres. El rechazo llega antes de crear nada |
| El bloque no entra en ningún hueco de los días que se muestran | Puede pasar de verdad: 6 turnos de 30 minutos son 180, lo que dura una franja entera. La pantalla lo dice con esas palabras y ofrece sacar menos turnos, en vez de mostrar la grilla vacía |
| El bloque cruzaría el descanso o el cierre | No se ofrece. Sale gratis de calcular el bloque como un turno único de la duración total: cada franja se evalúa por separado y el turno tiene que entrar completo (CU-04) |

---

## 5. Fuera de alcance en v1 (recordatorio)

Deudas por ausencia · Multi-peluquero · Recuperación autoservicio del link para clientes sin email · Recordatorio automático mandado por el sistema (HU-05: lo cubre en parte la alarma del evento de calendario de HU-19)

*Sobre los precios:* **dejaron de estar fuera de alcance en la v3** (HU-27), igual que
WhatsApp. Estuvieron afuera durante la v1 y la v2 porque el sistema no tenía nada que
hacer con ellos: sin cobros, un precio era un número decorativo, y publicárselo al cliente
sin que nadie lo mantuviera al día era peor que no tenerlo. Lo que cambió es que ahora
existe **para qué**: el precio del servicio es de dónde sale el monto del cobro, y el
cobro es de dónde salen los totales. Sigue sin verlo el cliente — el precio quedó del lado
de Ariel, que es donde tiene un uso.

*Sigue fuera de alcance dentro de los cobros:* el **cobro online** (seña por Mercado Pago
o cualquier pasarela — sería una etapa aparte, con trámites externos como los de
WhatsApp), los **pagos parciales o divididos**, el **historial de precios** de un servicio,
y la **facturación**.

*Sobre WhatsApp:* **dejó de estar fuera de alcance en la v3** (HU-22). Durante la v1 y la v2 lo estuvo, y por un motivo concreto: la API de WhatsApp Business exigía dedicarle un número a la API, o sea que Ariel tenía que dejar de usar su número de siempre en la app de WhatsApp Business. Eso se cayó con *Coexistence* (Meta, mayo de 2026), que permite el mismo número en los dos lados a la vez sin perder los chats. Antes de eso, el aviso al cliente figuró un tiempo como "simulado en la interfaz", con un cartel prometiendo un mensaje que nunca iba a llegar; ese cartel se sacó porque era mentirle al cliente. Ahora el mensaje es real.

*Sigue fuera de alcance dentro de WhatsApp:* los **webhooks de estado** de Meta (saber si el mensaje se entregó, se leyó o rebotó), el **recordatorio previo al turno**, y la **respuesta automática** al cliente que escribe primero.

*Salieron de esta lista: que Ariel cambie su contraseña desde el panel (HU-16), el envío del link por mail (HU-02, HU-19), la confirmación por WhatsApp (HU-22) y los precios (HU-27), todos ya implementados.*

---

**Siguiente etapa:** Arquitectura del sistema (frontend / backend / base de datos y cómo se comunican).
