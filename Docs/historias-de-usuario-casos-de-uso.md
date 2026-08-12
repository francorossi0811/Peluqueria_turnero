# Historias de Usuario y Casos de Uso
### Turnero — La Peluquería de Ariel Enrique | v1

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
- Solo se muestran horarios realmente disponibles (considerando la duración del servicio elegido).
- Al confirmar, recibo un link único para administrar mi turno.
- No necesito crear cuenta ni contraseña.
- El teléfono es obligatorio y se valida de verdad: entre 8 y 15 dígitos, admitiendo espacios, guiones, paréntesis y un `+` inicial. Es el único dato con el que Ariel me puede ubicar si algo cambia, así que no puede quedar en cualquier cosa. El email es opcional, pero si lo dejo tiene que tener formato válido. (Solo es obligatorio **acá**: cuando el turno lo carga Ariel a mano, ver HU-08, puede quedar vacío.)

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
- Puedo marcar el origen (teléfono / WhatsApp) para saber de dónde vino.
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
- También les pongo el **precio** (HU-27). Es un dato mío: me sirve para que el cobro venga con el monto puesto y para los totales, y **el cliente no lo ve en ningún momento**.
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
- El color dice el estado: ámbar reservado, verde realizado, rojo ausente. Un turno que todavía no vi lleva un anillo alrededor.
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

*Sobre exportar a una planilla:* se construyó y se sacó. Ariel no la pidió, y el motivo por
el que estaba —"llevarse los datos"— resultó ser un problema que él no tiene: las fichas
las consulta en el panel, que es donde están al lado del turno. Es funcionalidad que
existía porque era fácil de hacer, no porque hiciera falta.

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
- Elijo entre **efectivo, transferencia, Mercado Pago y tarjeta**. Son los cuatro que uso;
  no necesito armarme una lista como con las etiquetas.
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

*Por qué el cliente no ve los precios:* es lo que pidió Ariel. Y además, un precio
publicado que no se actualiza es peor que ninguno — el sistema le estaría mintiendo al
cliente sin que nadie se entere. El flujo de reserva no se tocó en nada.

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
  - *Nota: esto no le avisa al cliente — el turno queda cancelado y Ariel se lo comunica por WhatsApp a mano. Es el caso donde más se nota que no hay aviso automático de cancelación: el cliente se entera recién si abre su link. Con el email ya guardado el mecanismo existiría (un mail de "Ariel canceló tu turno"), pero es funcionalidad nueva, no está implementada.*

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
