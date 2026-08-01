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
| 6 | Configurar servicios | HU-13 |
| 7 | Configurar horario laboral + feriados | HU-14 |

**Editar turno (HU-09)** y **marcar Realizado/Ausente (HU-12)** no tienen pantalla propia:
son acciones inline sobre una fila de la agenda diaria/semanal (pantalla 2), no un flujo
separado — son ediciones de un campo, no ameritan una pantalla dedicada.

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
