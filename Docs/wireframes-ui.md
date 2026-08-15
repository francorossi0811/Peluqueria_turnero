# Wireframes / Diseño UI
### Turnero — La Peluquería de Ariel Enrique

---

## 1. Qué es este documento

Wireframes de **baja fidelidad**, a propósito: el objetivo de esta etapa es validar qué
pantallas existen, qué información vive en cada una y cómo se conectan — no todavía la
identidad visual final (colores de marca, tipografía, logo). Eso se define recién cuando
el flujo esté validado, para no rehacer trabajo de diseño visual si cambia algo funcional.

El wireframe interactivo completo (13 pantallas, cliente + admin) está publicado como
artifact y se comparte aparte de este documento. Acá queda el inventario de pantallas y
las decisiones de flujo que no se ven a simple vista en el dibujo.

**Tratamiento visual:** paleta cálida (fondo tostado, tinta café, acento miel para
cliente, acento vino para admin, verde para estados positivos, ámbar para bloqueados) para
que el documento ya transmita "peluquería" en vez de leerse como una app genérica. Sigue
siendo baja fidelidad a nivel de estructura — esta paleta es orientativa, no la definitiva
de marca (eso se define en la etapa de desarrollo del frontend).

---

## 2. Inventario de pantallas

### Cliente (sin cuenta, mobile-first)

| # | Pantalla | Cubre |
|---|---|---|
| 1 | Elegir servicio | HU-01 |
| 2 | Elegir día y horario | HU-01, CU-04 |
| 3 | Datos de contacto | HU-01 |
| 4 | Confirmación (con link único) | HU-02 |
| 5 | Gestionar turno vía link (cancelar / reprogramar) | HU-03, HU-04, CU-02 |
| 6 | Turno cancelado | HU-03 |

**Reprogramar (HU-04) no tiene pantalla propia** — reutiliza la pantalla 2 (día/horario),
partiendo del turno existente en vez de una reserva nueva. Evita duplicar la lógica de
disponibilidad en dos lugares distintos de la interfaz.

**En la pantalla 5 el orden de los botones es**: reprogramar y cancelar arriba, después
WhatsApp y llamar a Ariel, y **el de agregar al calendario último**. Agendar se hace una
vez y no se vuelve a tocar; las otras tres son las razones por las que alguien vuelve a
esta pantalla. Los dos de contacto están **siempre**, no solo cuando ya pasó la ventana de
60 minutos: el cartel de "contactá directamente a Ariel" decía qué hacer sin decir cómo, y
este cliente nunca entró a la página principal, donde está el número — llegó por su link.

⚠️ **Estas pantallas SÍ muestran el precio desde el 14/8/2026.** Hasta esa fecha acá decía
lo contrario ("son un dato interno de Ariel… este lado no se tocó") y era la regla de HU-27;
Franco la cambió porque el cliente quiere saber cuánto sale antes de reservar. El precio
acompaña a la duración en la tarjeta del servicio y en los pasos 2, 3 y 4, y aparece también
en la pantalla 5.

- Va **en el mismo renglón que los minutos**, no en uno propio: la tarjeta es una foto con
  texto encima y un cuarto renglón la vuelve un cartel.
- ⚠️ **Nunca en `font-hero`.** Playfair dibuja el `$` con doble barra, que es la convención
  del dólar, y el peso argentino lleva barra simple. Engaña el glifo, no el texto.
- Un servicio sin precio cargado simplemente no lo muestra: `null` no es `$ 0`.
- Lo que **no** se muestra en ninguna de estas pantallas es el **cobro** (cómo pagó y
  cuánto), que sigue siendo solo del panel.

### Admin (Ariel, autenticado, pensado para escritorio/tablet en el mostrador)

| # | Pantalla | Cubre |
|---|---|---|
| 1 | Login | HU-15 |
| 2 | Agenda diaria | HU-06 |
| 3 | Agenda semanal | HU-07 |
| 4 | Cargar turno manual (modal) | HU-08 |
| 5 | Bloquear horario (modal, con confirmación) | HU-11, CU-03 |
| 6 | Buscar turno (modal, para reenviar un link perdido) | Caso borde "cliente pierde su link único" |
| 7 | Horarios y servicios (horario laboral + feriados + servicios) | HU-13, HU-14 |
| 8 | Mi cuenta (usuario + apariencia + avisos + contraseña + cerrar sesión) | HU-16, HU-18, HU-21 |
| 9 | Clientes (listado + ficha en modal + etiquetas en modal) | HU-25 |
| 10 | Detalle de un turno (modal, desde la grilla semanal) | HU-25, HU-09, HU-10 |
| 11 | Pedir el link de restablecimiento (dentro del login) | HU-26 |
| 12 | Elegir una contraseña nueva (a la que lleva el link del mail) | HU-26 |
| 13 | Administradores (solo el administrador general) | HU-26 |
| 14 | Cobros (total del período + desglose por medio + lista de turnos) | HU-27 |
| 15 | Cobrar un turno (modal, desde "Realizado" o desde el turno) | HU-27 |

**Editar turno (HU-09)** y **marcar Realizado/Ausente (HU-12)** no tienen pantalla propia:
son acciones inline sobre una fila de la agenda diaria/semanal (pantalla 2), no un flujo
separado — son ediciones de un campo, no ameritan una pantalla dedicada.

**El cobro (HU-27) sí tiene modal, y es la excepción que confirma esa regla.** No es la
edición de un campo: son dos datos —medio y monto— más una decisión, cobrar ahora o dejarlo
pendiente. Eso no entra en una fila. Que se abra solo al tocar "Realizado", y no desde un
botón propio, es lo que evita que registrar el cobro sea un paso aparte que se olvida.

**Las cuatro acciones están en los dos lados.** El detalle de un turno (pantalla 10) lleva
Realizado · Ausente · Reprogramar · Cancelar, con la misma jerarquía que la fila de la
vista Día: las dos primeras destacadas, las otras dos sin caja detrás de un divisor. Hasta
la v3 el detalle tenía solo reprogramar y cancelar, y era un agujero: desde la grilla
semanal no se podía cerrar un turno —lo más frecuente de todo— sin cambiar de vista.

### Entrar con el email, y el "me olvidé la contraseña" (HU-26)

- El campo dice **Email**, no Usuario. El nombre sigue existiendo pero solo se muestra; ya
  no es con lo que se entra. "Mi cuenta" muestra los dos, con un "Entrás con: …" bien
  explícito — si no, Ariel no tendría dónde ver qué tipear en el login.
- **"Me olvidé la contraseña" solo aparece si el servidor puede mandar mails.** Sin eso el
  mensaje se imprime en el log del servidor: el botón prometería un mail que no llega,
  justo cuando la persona ya no puede entrar.
- Pedir el link y elegir la contraseña son dos pantallas del mismo flujo. La primera dice
  *"si esa dirección tiene una cuenta, le mandamos un mail"* — y no "listo, te lo
  mandamos"— porque el backend responde igual exista o no la cuenta, y el texto no puede
  delatar lo que el endpoint se cuida de no decir.
- La segunda valida el largo y que las dos coincidan **mientras se escribe**, no al
  enviar: un viaje al servidor para decir algo que el navegador ya sabe es tiempo perdido.
  Al guardar entra directo al panel.

### Administradores: la única pantalla con rol (HU-26)

Es lo único que Ariel no ve. El resto del panel es gestionar su peluquería y lo puede
entero — vale decirlo porque invita a buscar una segunda diferencia que no existe.

- El ítem del nav no se le renderiza, y si escribe la URL a mano lo redirige a la agenda.
  **Las dos cosas son comodidad**: quien decide es el backend, que responde 403.
- Sobre la cuenta propia no se muestran "cambiarle la contraseña" ni el cambio de rol,
  solo la marca "(vos)". Para cambiarse la contraseña está "Mi cuenta", que pide la actual.
- **"Datos" sí está en todas las filas, incluida la propia.** Es donde se corrige el nombre
  o el email. Existe porque un email cargado no se podía cambiar por ningún lado, y como el
  login es por email eso dejaba la cuenta rota sin arreglo desde la aplicación.
- La contraseña que el administrador general le fija a otro **se muestra en claro**, a
  propósito: la tiene que poder leer para dictársela. Es temporal y la otra persona la
  cambia al entrar.
- Una cuenta sin email se marca en rojo con "esta cuenta no puede entrar". Es la forma de
  que una cuenta muerta no pase desapercibida ahora que el login es por email.
- **Borrar pide confirmación, y la confirmación reemplaza la fila** en vez de aparecer al
  lado. Es el mismo patrón que cancelar un turno, y por el mismo motivo: si los botones
  nuevos aparecieran junto a los viejos, el click de confirmar caería donde hasta recién
  había otra acción.

### El nav del panel: cinco destinos

El nav llegó a tener cinco entradas más un botón "Salir", y era demasiado para un panel
que en la práctica se usa para una sola cosa. Quedó así:

| Ítem | Ícono | Qué agrupa |
|---|---|---|
| **Agenda** | calendario | La agenda diaria/semanal y todo lo que se hace sobre ella: cargar turno, bloquear horario, buscar turno y el detalle de un turno, los cuatro como modales |
| **Clientes** | dos personas | Las fichas y sus etiquetas (HU-25) |
| **Cobros** | billete | Lo que entró, por período y por medio de pago (HU-27) |
| **Horarios y servicios** | reloj | Horario laboral, feriados y servicios — las tres son configuración de cuándo y qué atiende, y ninguna se toca seguido |
| **Mi cuenta** | persona | Cuenta (nombre + con qué email entra), avisos al celular, cambio de contraseña y cerrar sesión |
| **Administradores** | llave | Solo para el administrador general (HU-26): quién puede entrar al panel |

**"Clientes" es sección propia y "Buscar turno" es modal, y la diferencia no es
arbitraria.** En Clientes Ariel se queda un rato: repasa fichas, pone apodos, etiqueta.
A "Buscar turno" entra a resolver una cosa puntual y sale. La forma sigue a eso.

Dos decisiones detrás de eso:

- **"Buscar turno" no es una sección, es una acción sobre la agenda.** Se usa cuando un
  cliente escribe porque perdió su link; uno no "se queda" ahí. Como modal, además, queda
  al lado de las otras dos acciones de la agenda en vez de competir con ellas desde el nav.
- **"Salir" ya no está en el nav.** Ariel tiene el panel abierto casi todo el día en la
  tablet del mostrador: un botón permanente arriba a la derecha es un click accidental
  esperando pasar, y volver a entrar cuesta tipear la contraseña con las manos ocupadas.
  Vive abajo de todo en "Mi cuenta", donde hay que ir a buscarlo.

Las rutas viejas (`/admin/servicios`, `/admin/horario`, `/admin/buscar`) redirigen en vez
de desaparecer, porque Ariel puede tener alguna guardada en favoritos.

---

## 2 bis. Ajustes de interfaz después del uso real (v3)

Cambios que salieron de que Ariel usara la aplicación de verdad, no del diseño en papel.

### Panel en modo oscuro (HU-21)

Ariel usa lentes y el fondo crema le cansa la vista en una jornada larga. **Solo cambia el
panel**: el lado del cliente queda como estaba, porque ese diseño ya estaba aprobado.

Es la misma interfaz con otros valores de color, no un rediseño: misma tipografía, mismo
ámbar de marca, mismos componentes. Es un oscuro **cálido** y no gris neutro, para no
perder la identidad crema/ámbar. Por defecto viene oscuro, con un interruptor en "Mi
cuenta" para volver al claro; la elección se recuerda por dispositivo.

Tres detalles que decidieron la implementación:

- **El color se define en un solo lugar y los componentes no se enteran.** Toda la paleta
  vive en variables; el tema oscuro las redefine. Por eso el cambio son unas cuarenta
  líneas y no una reescritura de las ocho pantallas.
- **Cuidado con los colores escritos a mano.** Cinco valores estaban puestos directamente
  en los componentes en vez de pasar por la paleta, y eran justo los únicos que no
  cambiaban de tema. Pasaron a ser tokens con nombre de rol (`sobre-acento`, `destacado`,
  `velo`).
- **Los banners de error eran la trampa.** En claro, el color de error vale lo mismo que
  el del texto normal; sin redefinirlo también, quedaban negro sobre negro. Se verificó
  que los veinte pares de color del panel cumplen contraste AA.

### La semana, de martes a sábado (HU-07)

La vista semanal mostraba siete días corridos desde donde estuviera parado, así que
siempre entraban el domingo y el lunes, que no trabaja. Ahora va del primer al último día
laboral, tomados del horario configurado — no de una lista fija. Anclada en domingo, para
que parado un domingo o un lunes vea la semana que **empieza**.

### Las horas, siempre en 24 h

Ariel veía "10:00 a.m." donde el resto de la aplicación dice "10:00". El campo de hora
nativo del navegador elige el formato según el idioma **del navegador**, no del sitio, y
no hay forma de forzarlo desde la página. Se reemplazó por dos listas desplegables (hora y
minutos), que además en el celular abren la rueda de selección, más rápida que tipear.

Los campos de fecha siguen siendo los nativos: el calendario desplegable se entiende igual
en cualquier idioma.

### Teléfono opcional al cargar un turno (HU-08)

Deja de bloquear el alta. Se agrega "Elegir de mis contactos", que solo aparece donde el
navegador lo soporta —Chrome en Android— y en el resto directamente no se renderiza, para
no dejar un botón que no hace nada.

⚠️ **El error del teléfono va pegado al campo, en los dos formularios** (14/8/2026). Antes,
en la carga manual el rechazo del servidor aparecía en un cartel arriba del botón, lejos del
input, y en la reserva del cliente lo mandaba de vuelta al paso del horario con un mensaje
genérico — o sea, lo alejaba justo del campo que tenía que corregir y le hablaba de otra
cosa. Ahora el mensaje sale abajo del input, con el borde en rojo, y el wizard **se queda en
el paso de datos**.

### Qué lleva la landing (pantalla 1)

La landing **no es una ruta**: es el paso 1 del wizard de reserva, que vive en `/`. Por eso
"volver al inicio" resetea el wizard en vez de navegar, y por eso cambiarla es recortar ese
paso y no editar una página aparte.

Quedó en cuatro bloques: **hero → Servicios → Beneficios → Contacto**, con el nav en
Servicios · Contacto · Reservar turno.

- **"Productos" se borró** (13/8/2026): la peluquería no tiene una vidriera de productos, así
  que era una sección inventada.
- **"Beneficios" se sacó y volvió** (14/8/2026), ahora titulada *"Beneficios de venir a este
  salón"*. Son tres tarjetas con foto: **Gel modelador**, Equipo de calidad y Atención
  personalizada. El primero cambió de una foto de stock genérica al gel, que es el único
  producto que Ariel vende de verdad.
- ⚠️ **La foto del gel es un flyer publicitario vertical con el precio impreso.** Encuadra
  bien en la tarjeta `4/5` porque el recorte se come las bandas negras de arriba y abajo,
  pero el precio del flyer va a quedar viejo y su paleta rojo/azul no es la del sitio. Está
  así porque es la foto que hay.
- El hero dice "Corte, barba y **estilo**" desde que se eliminó el servicio Color.
- La banda de Beneficios no lleva separador propio: su fondo oscuro la separa sola del
  contacto.

### Registrar un turno que ya pasó (HU-08)

Ariel atiende clientes de vidriera y los registra cuando tiene un rato libre, así que el
modal de carga ofrece los últimos **7 días** además de las próximas dos semanas. El pedido
de Franco fue textual: *"que sea interactivo y que no se preste para confusión"*. Cuatro
señales, de la más débil a la más fuerte:

1. **Los chips de día y de hora que ya pasaron se pintan en ámbar** (`alerta`), y se tocan
   igual que los demás: el color informa, no bloquea. La partición Mañana/Tarde no se toca —
   es la lectura que Ariel tiene incorporada de la planilla, y un tercer grupo "Ya pasó" se
   comería los otros dos en un día entero pasado.
2. Un renglón arriba de los horarios cuando el día elegido pasó entero.
3. **Un cartel ámbar arriba de los botones** con el día y la hora en texto largo: *"⚠ Estás
   registrando un turno que YA PASÓ · martes 11 de agosto · 15:20"*. Va pegado al botón y no
   arriba de todo, porque para cuando llega ahí ya se olvidó de qué chip tocó.
4. **El botón cambia de texto**: "Cargar turno" → **"Registrar turno pasado"**, y el título
   del modal también. Es la defensa más fuerte: lo último que toca dice qué hace.

Se decidió **no** poner un checkbox de confirmación. Ariel va a hacer esto seguido y el
cartel más el botón renombrado ya cierran el hueco; si en el uso resulta poco, agregarlo son
cinco líneas.

En la grilla semanal, los huecos de días pasados **vuelven a ser tocables** dentro de esos 7
días (antes estaban muertos, porque el backend no los aceptaba). Más viejo que eso siguen
muertos, para no reintroducir el defecto original —un hueco que abre un modal donde no se
puede elegir nada— corrido una semana. **El hueco pasado no lleva color propio**: el fondo
verde de la columna ya dice que ese día pasó, y pintarle un segundo tratamiento encima sería
repetir el error de la planilla, donde un mismo color quería decir dos cosas.

El **origen** pasó de dos opciones a tres (Presencial · Llamada · WhatsApp) y arranca en
"Presencial" cuando el hueco elegido ya pasó, que es el caso real del cliente de vidriera.

### Ir a una fecha sin pasar las flechitas

La barra de la agenda tenía `‹ fecha ›` y "Hoy", así que llegar a una fecha lejana era
clickear de a un día o de a una semana. Se agregó un **selector de fecha nativo entre la
flecha derecha y "Hoy"**: `‹ etiqueta ›` son una unidad ("dónde estoy parado") y
`[fecha] [Hoy]` la otra ("saltar a otro lado").

- En vista Semana no hace falta ningún caso especial: el rango se ancla al domingo, así que
  elegir un jueves muestra la semana del jueves.
- Sin fecha mínima ni máxima: la agenda es el registro de lo que pasó, tiene que poder
  mirarse entera para atrás y para adelante.
- ⚠️ A 375 px las cinco piezas no entran en un renglón, así que el grupo envuelve en dos.

**El buscador de turnos gana "Ver ese día"**, que es la otra mitad del mismo pedido: buscar
por nombre es la forma natural de llegar a una fecha cuando uno no se acuerda cuál era, y
hasta ahora el modal te decía dónde estaba el turno y no te llevaba. Dice "Ver ese día" y no
"Ver el turno" a propósito: la búsqueda devuelve los cinco estados y la agenda dibuja tres,
así que prometer el turno y aterrizar en un día donde no aparece sería peor que no ofrecerlo.

### Avisos que no dependen del celular (HU-20)

Contador en la pestaña entre paréntesis, punto rojo en el ícono de la pestaña, y punto
sobre el ícono de la aplicación instalada. Es el canal que funciona siempre, a diferencia
del aviso push, que depende del sistema operativo de cada dispositivo.

En "Mi cuenta", la sección de avisos pasa a mostrar el resultado **por dispositivo** y
suma una prueba local, que dibuja la notificación sin pasar por internet. Sirve para
distinguir "no llega" de "no se muestra", que antes era imposible de separar a distancia.

### Fichas de clientes e insignias (HU-25)

Las etiquetas se dibujan como **círculos de color**, y cambian de forma según cuánto lugar
hay:

- **En la grilla de la semana, solo el círculo.** Ahí el alto lo dicta la duración del
  turno: uno de 20 minutos son 34 píxeles, en los que entran dos renglones y no tres. Se
  probó primero con las insignias abajo del servicio y en pantalla se veía el defecto —
  quedaban cortadas por el borde del bloque. Van en el mismo renglón que el nombre, y el
  que cede espacio es el nombre, que ya se recorta con puntos suspensivos.
- **Al abrir el turno, el círculo con su nombre al lado**, que es donde el color deja de
  ser un código y pasa a decir qué significa.

**El anillo alrededor del círculo usa el color del texto**, no un gris fijo. Ariel elige
el color libremente, así que tarde o temprano va a elegir uno casi igual al fondo: negro
sobre el panel oscuro, blanco sobre el claro. Como el color del texto por definición
contrasta contra la superficie en los dos temas, el anillo también. Verificado con una
etiqueta `#ffffff` y una `#000000` en los dos temas.

**Tocar un turno en la grilla abre su detalle, no el reprogramar.** Antes abría directo la
pantalla de mover el horario: la acción menos frecuente de todas, a un toque de distancia,
y sin forma de ver quién era el cliente sin tocarle el turno. Ahora el detalle muestra
servicio, horario, estado, la ficha con sus insignias y observaciones, y recién al final
los dos botones: **Reprogramar** y **Cancelar turno**.

**La vista Día no cambió** en cuanto a acciones: siguen inline en cada fila, que es el
flujo con el que Ariel opera durante la jornada — meterle un modal en el medio lo haría
más lento.

### El color dice el estado, y el reloj se dice aparte

Tres estados, tres colores, iguales en los dos temas: **miel** lo que viene, **verde** lo
realizado, **rojo** el ausente. Antes `ausente` era un neutro en la grilla y un
ámbar-naranja en la vista Día — tres colores distintos para el mismo estado según dónde lo
miraras.

**El turno en curso no cambia de color.** Se marca con un borde de 3 px y nada más. Se
probó pintándolo de rojo y estaba mal: mientras duraba, un turno reservado y uno al que el
cliente faltó se veían idénticos, justo en el momento en que más importa la diferencia. Lo
que dice "ahora" es el modelo de Google Calendar:

- una **línea roja horizontal** a la hora actual,
- la **hora del margen izquierdo** a esa altura, también en rojo,
- y el bloque de ese momento con el borde más grueso.

La línea **baja sola**: tiene su propio reloj (`useMinutosAhora`) y no depende del refetch
de la agenda, que con la pestaña en segundo plano baja a un pedido cada 3 minutos — y
volver a la pestaña y encontrar la línea atrasada es exactamente cuando se la mira.

⚠️ La hora del margen se pinta **solo si hoy está entre los días visibles**. La columna de
horas es una sola para toda la semana: mirando la semana que viene, una hora en rojo
señalaría una línea que no está dibujada en ninguna columna.

**Violeta = feriado.** El encabezado del día se tiñe y el rato que el feriado le comió se
raya en violeta, distinto del rayado neutro de "ese día no abro". Son dos motivos distintos
por los que un rato no está disponible, y pintarlos igual dejaba a Ariel sin poder saber
cuál estaba mirando. El globito del rayado dice qué feriado es.

Todos son **tokens** (`ahora`, `ausente`, `feriado`, más sus `-suave`), no colores escritos
en el componente. El rojo estaba hardcodeado como `red-500` en la línea de la hora, que es
exactamente el caso que la v3 ya había arreglado en otros cinco lugares: un color escrito
a mano es un color que no cambia con el tema.

`ahora` y `ausente` son el mismo rojo, y están declarados por separado a propósito: no se
confunden porque aparecen en formas distintas —una línea de 2 px contra un bloque relleno—
y tenerlos separados permite cambiarle el rojo a uno sin cambiárselo al otro sin querer.

### Los bloques, con relieve

Sombra muy suave, borde algo más marcado (`/70` en vez de `/40`, que sobre el fondo oscuro
casi no se veía) y radio un poco mayor. Nada más: el objetivo era sacarles la sensación de
plano, no convertirlos en tarjetas. El turno en curso sube la sombra junto con el borde
grueso.

### Los encabezados de la grilla, en dos renglones alineados

Con el nombre del feriado abajo, la columna con feriado tenía tres elementos apilados y las
demás dos, así que los días no alineaban entre columnas. **Centrar el bloque en vertical no
lo arregla — lo mueve:** medido en el DOM, la línea del día quedaba 13 px más arriba en las
columnas con feriado.

Lo que lo arregla es estructural: el segundo renglón existe en **todas** las columnas
aunque esté vacío, y el bloque se apoya arriba. Así el día está siempre a la misma altura y
un nombre largo que se parte en dos crece hacia abajo sin correr nada. El nombre del
feriado se deja envolver en vez de recortarse: "Paso a la Inmortalidad… · medio día"
cortado en "Paso a la Inmo…" no dice ni qué feriado es ni cuánto atiende.

### Cobrar es parte de marcar Realizado (HU-27)

**El cobro no tiene botón propio.** "Realizado" abre el modal, y desde ahí sale todo. Un
botón "Cobrar" al lado sería una acción más compitiendo en una fila que ya tenía cuatro, y
sobre todo sería un paso que se puede saltear: la plata se registra en el momento en que
la persona paga, o no se registra nunca.

- **Los cuatro medios son botones grandes, no un desplegable.** Ariel usa lentes, lo hace
  con el cliente enfrente y decenas de veces por día. Un `<select>` son dos toques y una
  lista chica; cuatro botones en una grilla de 2×2 son uno solo y se leen de lejos. Es el
  mismo criterio con el que las horas dejaron de ser un `<input type="time">`.
- **El monto viene puesto** con el precio del servicio y se puede pisar. El texto de abajo
  dice de dónde salió ("Corte clásico sale $ 9.500") para que cambiarlo se lea como lo que
  es —un descuento en este turno— y no como editar la lista de precios.
- **"Marcar sin registrar el cobro"** va abajo, sin caja. Es la salida, no la acción
  principal, pero tiene que existir: sin ella el gesto más frecuente del día queda trabado
  por un dato que a veces no está.
- Sobre un turno **ya realizado** el mismo modal sirve para completar o corregir, y ahí esa
  salida no aparece: el turno ya está marcado, no hay nada que saltear.

**En la agenda, el cobro se dice con un signo, no con un color.** Los turnos realizados
llevan un `$` gris cuando ya se cobraron y un `$?` ámbar cuando no. El color del bloque
sigue diciendo el estado y nada más (ver arriba): pintar el cobro sería meterle un segundo
eje a la misma señal, que es exactamente el problema del código de colores de la planilla.
El que llama la atención es el pendiente; el cobrado se confirma y se calla. Va en el
renglón del servicio y no en uno propio por lo mismo que las insignias de HU-25 — un turno
de 20 minutos mide 34 px y el tercer renglón queda cortado (medido: contenido 32 px, sin
desborde).

**La sección Cobros es propia y no un pie de la agenda.** Son dos preguntas distintas: la
agenda se mira turno por turno ("¿qué tengo hoy?") y la plata se mira sumada ("¿cuánto hice
esta semana?"). Mismo criterio con el que Clientes es sección y "Buscar turno" es modal.

- Arriba, dos tarjetas: el total grande y el desglose por medio, ordenado de mayor a menor.
- **Lo que falta cobrar se dice en la misma tarjeta del total**, en ámbar: "11 turnos
  realizados sin cobro registrado. No están sumados acá." Es lo que hace confiable al
  número — un total al que le faltan turnos sin avisarlo no cierra contra la caja y no hay
  forma de saber por qué.
- Atajos **Hoy / Esta semana / Este mes** más un rango libre. Tocar una fecha a mano apaga
  el atajo: dejarlo encendido diría que estás viendo "el mes" mientras mirás otra cosa.
- En la lista, **el apodo manda sobre el nombre** y van las insignias del cliente, como en
  el resto del panel.
- ⚠️ **Un monto no va nunca en la tipografía de los títulos.** `font-hero` (Playfair)
  dibuja el `$` con **doble barra**, que es la convención del dólar; el peso argentino se
  escribe con barra simple. El carácter que devuelve `Intl` para `ARS` es el correcto —lo
  que engaña es el glifo—, y estaba justo en el número más grande de la pantalla. Cormorant,
  Lora y la del sistema lo dibujan bien.
- **Cada fila se toca y abre el mismo modal de cobro.** Sin esto, la pantalla que junta los
  cobros pendientes era el único lugar donde no se podían resolver: había que ir a buscar
  cada turno a su día en la agenda. La fila **entera** es el botón —y no un "Registrar" al
  costado— porque es el blanco más grande posible, que es lo que importa en el celular y
  con lentes. Vale para todas las filas, no solo las pendientes: corregir un cobro cargado
  es la misma acción.
- ⚠️ **El monto y el medio se alinean a la izquierda en celular, no a la derecha.** Cuando
  la fila envuelve, `text-right` alinea contra un bloque que se encoge al contenido, así
  que el monto quedaba indentado respecto del medio de pago y con distinta sangría en cada
  fila, según cuál de los dos textos fuera más largo. Se ve solo mirando la pantalla
  angosta.

**El orden del nav lo eligió Ariel: Agenda · Cobros · Clientes · Horarios y servicios · Mi
cuenta.** Sigue su día — primero lo que atiende, después lo que cobró (que es la otra
lectura de lo mismo), después las fichas, y al final lo que casi no toca.

---

## 3. Decisiones de flujo

- **Un solo botón "Cancelar/Reprogramar" según ventana de 60 min.** En vez de ocultar la
  opción, se muestra deshabilitada con el mensaje explicado en HU-03 ("Ya no podés
  cancelar online..."). Deshabilitado-con-explicación es más claro que directamente no
  mostrar el botón.
- **Bloqueo de horario en un solo modal con dos estados.** Si el rango no tiene turnos
  activos, un click alcanza. Si los tiene, el mismo modal muestra la lista y cambia el
  texto del botón a "Confirmar y bloquear (cancela N turnos)" — sin pantalla de
  confirmación separada, para que la decisión y sus consecuencias se vean juntas (CU-03).
- **Selector de hora es el mismo componente en las tres pantallas que lo necesitan**
  (reserva del cliente, reprogramación, carga manual del admin): siempre pega contra el
  mismo cálculo de disponibilidad (CU-04), nunca hay una versión "manual" que se salte la
  validación.

---

## 4. Fuera de alcance de este documento

Identidad visual (paleta de marca, logo, tipografía final), diseño responsive pixel-perfect
y micro-interacciones (animaciones, estados de carga) — se definen en la etapa de
desarrollo del frontend, tomando estos wireframes como base funcional.

---

**Siguiente etapa:** Desarrollo (setup del repo: estructura de carpetas, frontend y
backend).
