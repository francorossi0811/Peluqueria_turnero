# Wireframes / Diseño UI
### Turnero — La Peluquería de Ariel Enrique | v1

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

**Editar turno (HU-09)** y **marcar Realizado/Ausente (HU-12)** no tienen pantalla propia:
son acciones inline sobre una fila de la agenda diaria/semanal (pantalla 2), no un flujo
separado — son ediciones de un campo, no ameritan una pantalla dedicada.

### El nav del panel: tres destinos

El nav llegó a tener cinco entradas más un botón "Salir", y era demasiado para un panel
que en la práctica se usa para una sola cosa. Quedó así:

| Ítem | Ícono | Qué agrupa |
|---|---|---|
| **Agenda** | calendario | La agenda diaria/semanal y todo lo que se hace sobre ella: cargar turno, bloquear horario y buscar turno, los tres como modales |
| **Horarios y servicios** | reloj | Horario laboral, feriados y servicios — las tres son configuración de cuándo y qué atiende, y ninguna se toca seguido |
| **Mi cuenta** | persona | Usuario, avisos al celular, cambio de contraseña y cerrar sesión |

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

### Avisos que no dependen del celular (HU-20)

Contador en la pestaña entre paréntesis, punto rojo en el ícono de la pestaña, y punto
sobre el ícono de la aplicación instalada. Es el canal que funciona siempre, a diferencia
del aviso push, que depende del sistema operativo de cada dispositivo.

En "Mi cuenta", la sección de avisos pasa a mostrar el resultado **por dispositivo** y
suma una prueba local, que dibuja la notificación sin pasar por internet. Sirve para
distinguir "no llega" de "no se muestra", que antes era imposible de separar a distancia.

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
