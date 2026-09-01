# CLAUDE.md

Este archivo le da contexto a Claude Code al abrir este repo. Leelo siempre antes de proponer un plan o escribir código.

## Qué es este proyecto

Turnero web para "La Peluquería de Ariel Enrique" — peluquería unisex, un solo peluquero (Ariel, sin empleados). Hoy gestiona los turnos por WhatsApp y papel; el objetivo es sacarle esa carga de encima sin reemplazar WhatsApp como canal de contacto.

Es un proyecto de portfolio de un estudiante de Ingeniería en Sistemas (4to año). Prioridad: buenas prácticas por sobre velocidad. Nunca generar código sin antes proponer un plan y que sea validado.

## ⚠️ Ariel está usando la app AHORA MISMO

La v1 está deployada y Ariel la está probando de verdad, contra la base de **producción**. Eso manda sobre todo lo demás:

- **Trabajar siempre en la rama `v3-ajustes-de-ariel`**, nunca commitear en `main`. Mergear a `main` le cambia la app que está usando, así que **solo se mergea cuando Franco lo pide**. ⚠️ El 16/8/2026 lo pidió y **la v3 entera está mergeada y desplegada**: lo que Ariel tiene enfrente ya no es la v1.
- **No pushear ni mergear sin que Franco lo pida explícitamente.**
- Render sirve **producción** y Vercel le apunta ahí. `frontend/.env` tiene que decir `http://localhost:3000/api`.
- ⚠️ **Las suscripciones push viven en la base a la que apuntaba el backend cuando se tocó "Activar".** Cambiar `DATABASE_URL` en Render deja huérfanos todos los dispositivos registrados hasta ese momento: el envío sale, pero a una lista vacía o vieja. Ya pasó — ver la nota del final de la Etapa 1.

### ⚠️ Ya no hay base de desarrollo (13/8/2026)

Hasta esta fecha este documento decía "**todo contra la base de desarrollo**, verificá que `DATABASE_URL` sea `ep-cool-field-acf4s3g8`". **Esa regla ya no se puede cumplir: esa branch de Neon no existe más.** El proyecto `Peluqueria Ariel` (`misty-flower-34174000`) tiene hoy **una sola** branch:

| | |
|---|---|
| Branch | `production` (`br-icy-dust-acborrsz`), primary y default |
| Compute | `ep-wispy-mud-acx20c4v` (read-write, `sa-east-1`) |

O sea que **el entorno local pega contra producción**, porque no hay otra cosa contra la cual pegar. Franco lo autorizó explícitamente el 13/8/2026 **porque el negocio está cerrado** y no hay turnos entrando.

⚠️ **Eso es una condición temporal, no la nueva normalidad.** Cuando la peluquería vuelva a abrir, cada escritura local cae en la agenda real de Ariel. Antes de correr cualquier cosa que escriba (reservar un turno de prueba, un script, una migración), preguntarle a Franco si el negocio sigue cerrado. Para **leer** el estado de producción conviene la MCP de Neon (`run_sql` sobre el proyecto y branch de arriba) antes que levantar el backend: es solo lectura y no puede escribir por accidente.

⚠️ **Las credenciales del `.env` se vencen.** El 13/8/2026 los dos connection strings guardados (el de producción y el de la desaparecida desarrollo) daban `password authentication failed`. No es el formato —se descartó probando variantes de `sslmode` y `channel_binding`—, es la contraseña. Cuando pase, hay que sacar una nueva de la consola de Neon; **la MCP de Neon tiene bloqueado `get_connection_string` por permisos**, así que ese camino no sirve y la tiene que pegar Franco.

### Estado real de producción (verificado el 13/8/2026)

La lista de "cuando se entregue, hacer esto" que vivía acá **ya está casi toda hecha**. Verificado con `run_sql`, no leído:

- ✅ **Las 17 migraciones están aplicadas** (14 hasta el 13/8, más las tres del 14/8: `realizado_no_se_pisa`, `origen_presencial` y `eliminar_servicio_color`). `foto_de_servicio` matcheó bien: los servicios tienen su foto propia. (La fila duplicada de `servicio_corte_mujer` que aparece sin terminar tiene `rolled_back_at`, así que no bloquea un `migrate deploy` futuro.)
- ✅ **El seed corrió.** Hay dos cuentas, las dos con email: `Ariel` (`admin`) y `Franco` (`super_admin`). **En producción no está el problema de las dos cuentas de Ariel** — eso era exclusivo de la base de desarrollo, que ya no existe, así que el punto se puede dar por cerrado.
- ✅ **Los precios están cargados**: Corte clásico $16.000, Corte + Barba $25.000, Barba $10.000, Corte de Pelo mujer $20.000. **Son los cuatro servicios que hay** — "Color" se borró el 14/8/2026 (fila + entrada del `seed.ts`, las dos cosas: el seed busca por nombre y lo habría resucitado).
- ⚠️ **Las duraciones reales no son las del seed.** Ariel las editó desde el panel: Corte clásico 20 min, Corte + Barba 30, Barba 15, Corte de Pelo mujer 30. El seed sigue diciendo 30/45/20 y está bien que así sea — solo crea lo que falta, nunca pisa.
- ✅ **Los feriados se sincronizaron** solos: 32 filas, de 2026-01-01 a 2027-12-25.
- ✅ **Ariel ya está usando la v3 de verdad**: 2 turnos cobrados, 3 suscripciones push, y se creó su propia etiqueta **"suele faltar"** además de recolorear "Nuevo" a verde. Eso confirma en la práctica dos decisiones de diseño: que la etiqueta automática se busque por `clave` y no por nombre, y que el color lo elija él.
- 🚧 **Sigue pendiente el backfill.** Al 21/8/2026 queda **1 turno con teléfono y sin ficha** (`cliente_telefono IS NOT NULL AND cliente_id IS NULL`), de 14 en total; el resto tiene ficha porque `crearTurno` se la creó al reservar. Falta correr `npm run backfill:clientes` una vez. ⚠️ El backfill **no** les pone la etiqueta "Nuevo": son clientes que ya venían.

⚠️ **Ojo con dar por sentado que la peluquería está cerrada.** El 14/8/2026 había turnos `reservado` para ese mismo día (10:00 y 10:40) y uno del día anterior sin cerrar. Franco confirmó que eran de prueba y autorizó aplicar las migraciones, pero la regla no cambia: **antes de correr cualquier cosa que escriba, preguntarle**. Un `SELECT` sobre `turnos` de los próximos días es la forma rápida de ver si hay actividad real.

## Antes de hacer nada

1. Leé **todo** `Docs/historias-de-usuario-casos-de-uso.md` (requisitos, historias de usuario, casos de uso y casos borde ya definidos y validados).
2. Leé **todo** `Docs/arquitectura.md` (capas del sistema y por qué).
3. Si algo de lo que te piden no está contemplado en esos documentos, preguntá antes de asumir — no improvises reglas de negocio nuevas.

## Stack

- **Frontend:** React + Vite, Tailwind CSS. Deploy en Vercel.
- **Backend:** Node + Express, API REST. Deploy en Render.
- **Auth:** JWT, solo para el panel de Ariel (el cliente no tiene cuenta).
- **Base de datos:** PostgreSQL (Neon o Supabase).

## Reglas de negocio clave (resumen — el detalle está en Docs/)

- Un solo peluquero, no hay selección de estilista.
- El cliente reserva sin cuenta; su turno se administra con un **link único no adivinable** (token), no con login.
- Cliente puede cancelar/reprogramar solo hasta **60 minutos antes**.
- ⚠️ **Los horarios candidatos NO son solo la grilla de 20 minutos** (14/8/2026). Son esa grilla (`PASO_MINUTOS`, anclada al inicio de la franja) **más el final de cada turno o bloqueo del día** — `candidatosDeLaFranja` en `disponibilidad.service.ts`. Sin lo segundo la grilla nunca se re-ancla a lo agendado y se pierde el rato entre que un turno termina y llega el próximo múltiplo de 20: una Barba de 15 min a las 17:00 termina 17:15 y el siguiente horario ofrecido era 17:20; un turno de 30 a las 18:00 terminaba 18:30 y el siguiente era 18:40. Se encadena solo (un turno nuevo a las 17:15 de 20 min hace candidato a 17:35) y **vale igual para el cliente y para Ariel**: una sola cuenta de disponibilidad. El candidato pegado al final pasa por el mismo filtro de cierre que los demás, con test propio sobre ese borde. Verificado contra producción: con un Corte + Barba 10:00–10:30 y una Barba 10:40–10:55, el primer horario libre pasó de 11:00 a **10:55**.
- ⚠️ **El cierre no tiene tolerancia**: un horario se ofrece solo si el turno entra **completo** antes de que cierre (`inicio + duración <= cierre`, CU-04). El que termina **exactamente** a la hora de cierre sí entra; el que se pasa un minuto, no. Hasta el 11/8/2026 este documento decía que había "10 minutos de margen" sobre el cierre: **era falso** — nunca existió en el código ni en las HU, y estaba invitando a implementarlo. Hay un test que fija los dos bordes. Lo que sí existe es otra cosa distinta: la **antelación mínima de 30 minutos** para reservar online (`MARGEN_MINIMO_MINUTOS`), que mira "ahora", no el cierre, y que las acciones de Ariel pasan en 0.
- **Ariel puede cargar turnos hasta 7 días para atrás** (HU-08, 14/8/2026): atiende clientes de vidriera y los registra cuando tiene un rato libre. Lo habilita el flag `permitirPasado` de `disponibilidad.service.ts` —**no** un `margenMinutos` negativo, que mezclaría dos conceptos en la misma variable— y solo lo enciende la ruta nueva `GET /api/admin/disponibilidad`, que además va siempre con margen 0. El cliente no cambió: sigue con sus 30 minutos de antelación y nunca ve una hora pasada. ⚠️ El flag **no toca el cierre**; hay un test que fija los dos bordes con el flag encendido. En la UI el pasado se marca en ámbar, con cartel antes de confirmar y el botón cambiado a "Registrar turno pasado".
- ⚠️ **Un turno `realizado` no se puede pisar; uno `ausente` o `cancelado` sí** (14/8/2026). Antes `ocupados` solo miraba `reservado` y, con el pasado habilitado, eso pasó a ser un agujero real. La regla vive en los dos lados: `obtenerDetalleDelDia` y el predicado del `EXCLUDE`, que ahora es `estado IN ('reservado','realizado')`. **`ausente` sigue afuera a propósito** — liberar el rato al marcarlo es el flujo que Ariel usa todos los días. Consecuencia: marcar Realizado puede fallar con 409 `TURNO_SE_SOLAPA_CON_REALIZADO` si ese rato ya se le dio a otro turno que se hizo.
- **`origen` es `online | presencial | llamada | whatsapp`** (14/8/2026). `presencial` es el cliente de vidriera; `llamada` se llamaba `telefono` y se renombró porque se confundía con `clienteTelefono`, que es un dato de contacto y no un canal. El `RENAME VALUE` de la migración conservó las filas que ya existían.
- ⚠️ **Una persona no puede acaparar la agenda** (HU-28, 15/8/2026): máximo **3 turnos `reservado` en cualquier ventana móvil de 7 días** por ficha de cliente, y **90 días** de horizonte hacia adelante (`DIAS_FUTURO_PUBLICO`). Antes no había **nada**: ni tope de cantidad ni tope hacia el futuro, así que la API aceptaba un turno para 2028. Los dos valen en las **dos** puertas públicas —`crearTurno` y `reprogramarTurno`— y **ninguno alcanza a Ariel**: se apagan con el mismo `esAdmin = Boolean(input.origen)` que ya distinguía los dos llamadores. La ventana es móvil y no lunes-a-domingo a propósito: con la semana del calendario entran 3 turnos de viernes a domingo y 3 más de lunes a martes, seis en cinco días. Solo cuenta `reservado` —cancelado y ausente liberaron el rato, realizado ya pasó—, así que cancelar libera el cupo enseguida. Al reprogramar, el turno no se cuenta contra sí mismo: si no, moverlo dentro de su propia semana fallaría justo cuando no cambia nada. ⚠️ **El límite es por teléfono normalizado, así que no frena a quien inventa un número distinto en cada reserva.** Es una decisión consciente y está escrita en HU-28, no un olvido: la alternativa era rate limit por IP (castiga a la familia que reserva desde la misma casa) u OTP (un paso más en *todas* las reservas para frenar algo que todavía no pasó).
- ⚠️ **En la grilla semanal el pendiente se parte por CUÁNDO, y el corte es "hoy o antes"** (`clasesDeEstado` en `GrillaSemana.tsx`, 23/8/2026): blanco lo que está **abierto** —hoy, o un día que ya pasó y Ariel nunca cerró—, mostaza lo que **todavía va a pasar**. Hasta esa fecha el corte era `dia === hoy`, y un `reservado` de ayer volvía a mostaza: se veía **igual que uno de la semana que viene**, o sea que la fila que hay que ir a marcar Realizado o Ausente era justo la que quedaba disfrazada de futuro. ⚠️ La comparación es de **strings ISO** (`dia <= hoy`), nunca `new Date(dia)`: `YYYY-MM-DD` se parsea en UTC y en Argentina correría el borde un día. **La vista Día no se tocó** — su `ESTILO_ESTADO` tiene escrito por qué ahí el chip `reservado` es siempre mostaza: la vista ya está parada en un día, así que "es de hoy" no distingue nada. El re-render a medianoche ya estaba cubierto por `useMinutosAhora` + el `hoyIso()` que se llama en el JSX.
- ⚠️ **Las fotos que sube Ariel viven en Postgres** (`imagenes.datos`, HU-29, 16/8/2026), comprimidas **en el navegador** a ~150 KB antes de subir. No fue preferencia: no había ningún lugar donde un archivo subido sobreviviera —`frontend/public` se hornea en el build de Vercel y el disco de Render es efímero— y un bucket traía cuenta nueva y trámite externo, lo mismo que tiene frenado a WhatsApp. **El techo es real**: Neon free son 0,5 GB. ⚠️ **Eran dos los números que lo sostenían y desde el 23/8/2026 queda uno solo**: Franco pidió sacar el tope de **5 fotos por ficha** (Ariel sabe que ocupan y prefiere cuidarlo él antes de que el sistema le corte en la mitad de un trabajo), así que lo único que queda es la compresión a ~150 KB. El techo dejó de ser estructural y pasó a depender de que alguien mire un número — por eso el medidor de "Mi cuenta" **dejó de ser informativo** y ahora muestra el uso contra `PRESUPUESTO_DE_FOTOS` (400 MB, no los 500 de Neon: la misma base guarda turnos y clientes). Mudarse a un bucket después no toca ninguna pantalla, porque el frontend solo ve `/api/imagenes/<id>`.
- ⚠️ **`servicios.foto` (string) y la fila de `imagenes` conviven, y la subida gana.** Las 4 fotos originales son rutas estáticas que sirve el CDN de Vercel y **no se migran** — es mejor que servirlas desde Render. La prioridad se **calcula** en `fotoDeServicio`, nunca se escribe la URL dentro de `servicios.foto`: serían dos escrituras que pueden divergir. Consecuencia para el frontend: `servicio.foto` es una **URL opaca** y hay dos servidores detrás, así que pasa por `urlDeFoto` — un `src` relativo a `/api/imagenes/...` pega contra Vercel y da 404 en producción.
- ⚠️ **Las rutas de fotos se montan ANTES del `express.json()` global** en `app.ts`, con su propio parser de límite más alto. El global tiene el default de 100 KB y tiraría un 413 crudo antes del handler; subirlo haría que toda la API acepte megabytes para que dos endpoints puedan. `express.json` se saltea si el cuerpo ya fue parseado, y de ahí sale el orden.
- ⚠️ **El `mime` de una imagen se acepta de una lista cerrada, y SVG está afuera a propósito**: es un documento que puede traer `<script>` y se serviría desde nuestro propio dominio. `image/*` a secas sería XSS, no una foto fea.
- ⚠️ **Los tres errores de `POST /api/turnos` son 409** (`HORARIO_NO_DISPONIBLE`, `LIMITE_SEMANAL_ALCANZADO`, `FUERA_DE_HORIZONTE`), así que **hay que ramificar por `codigo`, nunca por status**. `ReservarPage` hacía lo segundo y le mostraba "ese horario se acaba de ocupar" —falso— a quien había llegado a su tope, encima rebotándolo al paso del horario y perdiéndole la hora que ya había elegido. Mismo defecto que ya había pasado con el teléfono.
- La disponibilidad SIEMPRE se recalcula y valida en el backend, nunca solo en el frontend. ⚠️ Y las dos puntas se recortan en vez de rechazarse: `GET /api/disponibilidad` clampea `desde` a hoy y `hasta` al horizonte, así la grilla nunca ofrece un día que la creación va a rechazar.
- Doble reserva del mismo horario: se previene con una restricción de unicidad a nivel de base de datos, no solo con lógica de aplicación.
- El turno guarda una copia (nombre + duración) del servicio al momento de reservar — si Ariel cambia la duración de un servicio después, los turnos ya reservados no cambian.
- Nunca se borra un turno físicamente: la aplicación no hace `DELETE` sobre `turnos`, todo cambio es un `UPDATE` de `estado` (+ `updated_at`). Al reprogramar, el turno viejo queda en estado `reprogramado` y el nuevo apunta a él con `turno_origen_id`. **No hay tabla de historial/auditoría** — el rastro es ese, no un log de cambios.
- La sesión del admin dura 7 días y se renueva sola mientras use el panel; cambiar la contraseña invalida los tokens emitidos antes (HU-15, HU-16).
- **Se entra al panel con el email, no con un usuario** (HU-26). `administradores.usuario` es solo el nombre que se muestra. Hay dos roles: `super_admin` (Franco) y `admin` (Ariel); **la única diferencia es administrar cuentas**, todo lo demás lo puede el `admin`.
- El cliente puede dejar un **email opcional** al reservar: si lo deja, recibe la confirmación con su link único y el turno adjunto para el calendario. Si no lo dejó, la pantalla de confirmación se lo ofrece ahí mismo (`POST /api/turnos/:id/enviar-confirmacion`, **un solo uso por turno** — el id del turno es el token, así que sin ese límite sería un relay de mails abierto).
- El **teléfono se valida en dos niveles**, y desde el 14/8/2026 los dos corren en las **tres** puertas (reserva pública, carga manual y `PATCH …/telefono`): `esTelefonoValido` mira cómo está escrito (8 a 15 dígitos, con espacios/guiones/paréntesis y un `+` inicial) y `esTelefonoUtilizable` mira si el número **puede existir** (`aE164`, metadata `max` de `libphonenumber-js`). **Es obligatorio cuando reserva un cliente por la web** (es el único dato con el que Ariel lo ubica) y **opcional cuando el turno lo carga Ariel a mano**, porque no se sabe los números de memoria; si escribió algo, tiene que pasar las dos reglas. La diferencia se hace sobrescribiendo el campo en `bodyManualSchema`, no aflojando `bodySchema`.
  - ⚠️ **Por qué la segunda regla está en las tres y no solo en el PATCH, que era donde vivía:** un número bien escrito pero inexistente (`2954123456`) entraba en la reserva, `vincularCliente` no lo podía normalizar y el turno quedaba **sin ficha**; cuando Ariel lo quería completar a mano, el PATCH sí lo rechazaba y le decía "inválido" sobre un número que el sistema ya había aceptado. Una regla decidía si entraba y otra distinta si servía, en momentos distintos, y el que se comía el problema era el que ya no podía corregirlo. Hay un test que fija la diferencia entre las dos reglas.
  - ⚠️ La copia del frontend (`utils/validaciones.ts`) tiene **solo la primera**: la segunda necesita la metadata de `libphonenumber-js`, cara para el bundle público. El backend rechaza y las dos pantallas muestran su mensaje **pegado al campo** — en `ReservarPage` eso además implica **quedarse en el paso de datos**, porque antes rebotaba al paso del horario con un mensaje genérico.
- **En un feriado Ariel trabaja medio día por defecto** (la primera franja del día). Puede pasarlo a día completo o a cerrado desde el panel. Vive en `feriados.modalidad` (enum de tres, default `medio_dia`), y solo tiene efecto en los días que trabaja. Los feriados se cargan solos desde Nager.Date, y la sincronización **nunca pisa la modalidad** que eligió Ariel.
- **Un cliente es un teléfono normalizado** (HU-25), no un nombre: dos turnos con el mismo número son la misma persona. La ficha se crea sola dentro de `crearTurno`; un turno sin teléfono no tiene ficha hasta que se lo cargan. El **apodo** que le pone Ariel manda sobre el nombre con el que reservó el cliente, en toda la interfaz.
- **Los días que trabaja Ariel salen de la tabla `horario_laboral`** ("sin filas = cerrado"), nunca de una constante en el código. Hoy da martes a sábado. La vista "Semana" de la agenda va del primer al último día laboral, anclada en domingo — si Ariel abre los lunes desde el panel, la agenda lo sigue sola.
- Los avisos al cliente salen **por WhatsApp** (HU-22), con el mail como **respaldo**: se manda el mail solo si no hay teléfono, si el número no se puede pasar a E.164, o si el envío falla. El teléfono se **guarda como lo escribió la persona** y se normaliza recién al momento de enviar (`utils/telefono.ts`), nunca al entrar. Son **tres** avisos —confirmado, reprogramado y cancelado—, cada uno con su plantilla aprobada por Meta. El de cancelación sale por los **tres** caminos de baja: el link del cliente, el panel de Ariel, y la cancelación en masa al bloquear o editar un rango (CU-03). ⚠️ Ese tercero se enganchó recién el 14/8/2026 — era el único que cancelaba sin avisar, y es donde más importa porque son varios clientes de una. Va secuencial y después de responder, para no comerse un rate limit de Meta.
- El cliente que ya no llega a cancelar online tiene **botón de WhatsApp y de llamar** en su pantalla de gestión (HU-03). El número vive en `frontend/src/utils/contacto.ts`: ⚠️ el `9` de celular va **solo** en el link de `wa.me`, nunca en el `tel:` — marcar `+54 9 …` no llama a ningún lado.
- **El cobro se registra al marcar Realizado** (HU-27), nunca se cobra por el sistema. ⚠️ **`servicios.precio` dejó de ser interno el 14/8/2026** y eso **enmienda a HU-27**, que decía que el cliente no lo veía nunca: ahora sale por `GET /api/servicios` y por `GET /api/turnos/:id`, y se dibuja en la tarjeta del servicio, en los pasos horario/datos/confirmación y en el link de gestión. Lo que sigue sin salir de la API pública es el **cobro** (`medioPago`, `montoCobrado`); el mapeo campo por campo de `getServiciosPublico` se conserva igual de explícito, porque es lo que obliga a decidir dato por dato qué se publica. ⚠️ El precio que ve el cliente es **el de hoy**, no el del día que reservó — al revés que `nombre` y `duracionMinutos`, que son el snapshot. El monto del turno **no es un snapshot de la reserva** —al revés que la duración—: se copia del precio del servicio al momento de cobrar y Ariel lo puede pisar. Se puede marcar Realizado sin cobro y cargarlo después (`PATCH /admin/turnos/:id/cobro`); esos turnos se cuentan aparte en la sección Cobros y **no se suman al total**.
- **Los medios de pago que Ariel puede *elegir* son tres** (`efectivo`, `transferencia`, `mercado_pago`) desde el 21/8/2026: Franco sacó `tarjeta` porque Ariel no cobra con tarjeta y con el cliente enfrente era una opción que solo se tocaba sin querer. ⚠️ **El enum de la base sigue teniendo los cuatro y `tarjeta` se sigue mostrando y sumando**: elegir y mostrar son dos cosas distintas. Sacarla del enum de Postgres sería una migración sobre `turnos` —la tabla del `EXCLUDE` escrito a mano— por un valor que en producción no usa nadie (verificado: 0 turnos). La lista de lo elegible vive en `MEDIOS_COBRABLES` (`frontend/src/utils/dinero.ts`) y la regla se aplica **también en el schema del backend**, no solo en la pantalla. ⚠️ En el Excel, el desglose recorre los fijos **más los que aparezcan en los datos** (`mediosAMostrar`): si recorriera solo los fijos, un cobro viejo con tarjeta seguiría sumando en el total sin tener fila donde mostrarse, y el desglose no cerraría con su propio total.
- ⚠️ **Las fechas y horas que entran por la API se validan en un solo lugar** (`backend/src/utils/esquemasFecha.ts`, 21/8/2026) y **los mensajes los lee Ariel**, no un programador: antes decían "Formato de hora inválido, esperado HH:mm." y "Invalid ISO date" —ese último ni traducido, salía crudo de zod—. Ahora dicen qué campo está mal y qué hacer, con las palabras de la pantalla. ⚠️ Y de paso se arregló un defecto real: la regex vieja era `^\d{2}:\d{2}$`, que solo mira la forma, así que **`25:00` pasaba como válida** y `horaDesdeString` la desbordaba al día siguiente dejando el turno a la `01:00` (y `07:75` → `08:15`). La validación aceptaba una hora y el sistema guardaba otra, en silencio. Solo era alcanzable por API —en la UI la hora sale de `InputHora`, que son dos `<select>`—, pero era real. Hay tests que fijan las dos cosas.
- ⚠️ **La agenda se exporta a Excel, y ese filtro NO es el de la agenda** (HU-30, 16/8/2026). `GET /api/admin/agenda/exportar` se lleva **todos los turnos del período menos los `reprogramado`** —los cancelados **entran**—, mientras que `listarTurnosEnRango`, la consulta de la pantalla, filtra `('reservado','realizado','ausente')` y los deja afuera. Son dos reglas distintas a propósito: la agenda dibuja lo que está en pie, la planilla registra lo que pasó. Por eso la exportación tiene su propia consulta en vez de parametrizar la de la agenda. ⚠️ Y ojo con las semanas: se **agrupan** de domingo a sábado (la convención de `domingoDeLaSemana`, la misma de la vista Semana) pero se **titulan** por su martes y su sábado. Si el corte empezara el martes, un turno de lunes no tendría hoja y desaparecería del archivo sin que nada lo delatara. Los totales salen de `resumirCobros`, la misma función que la sección Cobros, así que el archivo no puede contradecir a la pantalla — verificado cruzando los dos contra producción.
- **Fuera de alcance:** sistema de deudas por ausencias, multi-peluquero, y dentro de los cobros el cobro online / seña. Los avisos a Ariel (push), el mail y el WhatsApp al cliente son reales. **WhatsApp y los precios dejaron de estar fuera de alcance en la v3** — ver abajo.

## Estado actual del proyecto

- ✅ Requisitos, historias de usuario y casos de uso — definidos y validados.
- ✅ Arquitectura de alto nivel — definida y validada.
- ✅ Modelo de datos / ERD — definido y validado.
- ✅ Especificación de la API REST — definida y validada.
- ✅ Wireframes / diseño UI — definidos; la interfaz final sigue el diseño que Franco hizo con la herramienta de diseño de Claude (paleta crema/negro/ámbar). El lado del cliente es siempre claro; el panel tiene además una variante oscura (v3), que son los mismos tokens con otros valores.
- ✅ v1 completa: backend, flujo de reserva del cliente y panel de admin, funcionando.
- ✅ v2 completa (tres etapas):
  - Etapa 1 — sesión deslizante que no vence mientras Ariel use el panel, y cambio de contraseña desde "Mi cuenta" (HU-15, HU-16).
  - Etapa 2 — agenda que se actualiza sola con los turnos nuevos marcados, y aviso al celular por Web Push (HU-17, HU-18).
  - Etapa 3 — mail de confirmación al cliente con su link, y "agregar al calendario" (.ics) (HU-02, HU-19).
- ✅ **v3 mergeada a `main` y desplegada el 16/8/2026.** Etapa 1 (arreglos y cambios chicos). Etapa 2 (WhatsApp): código terminado y **probado de punta a punta contra el número de prueba de Meta el 20/8/2026**, con las cuatro plantillas aprobadas. ⚠️ **En producción los avisos siguen saliendo por mail**: falta Coexistence sobre el número de Ariel, así que Render sigue sin credenciales — y el adaptador de consola no cuenta como enviado justamente para que esto no apagara el mail en silencio. El cambio de la cancelación en dos plantillas (20/8) **no está commiteado ni desplegado**. Etapa 3 entera: feriados + grilla semanal y fichas de clientes. Etapa 4 (cobros). Limpieza de la landing (13/8/2026). Más HU-28 (límite de reservas) y HU-29 (fotos). Ver abajo.
- ✅ **HU-30 (exportar la agenda a Excel) mergeada a `main` y desplegada el 17/8/2026.** Ariel ya tiene el menú "Más opciones" y el botón de exportar.
- ⚠️ **Brevo está configurado pero los mails NO se estaban entregando** (detectado el 21/8/2026). `BREVO_API_KEY` está cargada en `backend/.env` **y en Render** —verificado con `GET /api/auth/recuperacion-disponible`, que devuelve `{"disponible":true}` en producción—, pero `MAIL_FROM` apunta a una casilla que **no estaba dada de alta como remitente** en Brevo, y Brevo rechaza el envío. El remitente ya quedó creado; falta que Franco haga clic en el mail de verificación que le llegó a esa casilla.
  - ⚠️ **La trampa que hizo que esto pasara doce días sin que nadie se enterara: Brevo devuelve `201` y recién después rechaza el envío.** O sea que `res.ok` en `brevo.mailer.ts` da `true` y el mailer nunca tira error; y aunque lo tirara, `enviarAvisoPorMail` solo hace `console.error`. La reserva se completa, la pantalla dice que salió todo bien, y el mail no existió nunca. Es exactamente la advertencia de "200 ≠ entregado" que ya estaba escrita para WhatsApp, pasando ahora con el mail.
  - **Cómo diagnosticarlo sin adivinar:** `GET https://api.brevo.com/v3/smtp/statistics/events` (con la api-key en el header) devuelve el motivo real del rechazo por mensaje. Ahí se leyó, textual: *"Sending has been rejected because the sender you used … is not valid."* `GET /v3/senders` lista qué remitentes están validados (`active: true`).
  - Los mails del 7 al 9 de agosto **sí** se entregaron, y salían desde el subdominio que regala Brevo (`…@<id>.brevosend.com`), que viene validado. En algún momento se cambió `MAIL_FROM` y ahí se cortó.

## v3 — lo que pidió Ariel

Se decidió arrancar por los arreglos chicos (todo local, sin depender de trámites externos) y dejar WhatsApp para después.

El plan original está en `~/.claude/plans/tingly-meandering-mitten.md`, pero **quedó viejo**: describe como pendiente todo lo que ya está hecho. Para saber en qué estado están las cosas, vale esta sección, no ese archivo.

### Etapa 1 — arreglos y cambios chicos ✅ terminada y desplegada

Todo hecho y verificado en el navegador:

- **Panel en modo oscuro**, con interruptor en "Mi cuenta" (Ariel usa lentes). Se resuelve redefiniendo las variables CSS bajo `:root[data-tema='oscuro']`; los componentes no saben que existe. El atributo lo pone `useTemaAdmin` en `<html>` — **no** en `AdminLayout`, porque `/admin/login` cuelga fuera del layout, la regla de `body` es global, y `color-scheme` solo sirve en la raíz. El lado del cliente queda siempre en crema.
- **Agenda de martes a sábado**, derivada de `horario_laboral`.
- **Horas siempre en 24 h** (`components/ui/InputHora.tsx`). `<input type="time">` no se puede forzar: usa el idioma del navegador, no el `lang` del documento. Por eso son dos `<select>`.
- **Teléfono opcional en la carga manual**, más "Elegir de mis contactos" (Contact Picker API — existe **solo en Chrome sobre Android**, por eso va detrás de un feature check y no se renderiza en otros lados).
- **Arreglos del push** (HU-18): `pushsubscriptionchange` + `POST /api/push/renovar` (sin auth a propósito — el service worker no tiene el JWT y el evento corre con el panel cerrado; la autorización es conocer el endpoint viejo), `skipWaiting()` + `clients.claim()`, `badge` monocromo, `requireInteraction`, `tag` por turno, `TTL`/`urgency`, y baja de la suscripción vieja antes de suscribir.
- **Push observable**: `enviarATodos` devuelve resultado por dispositivo en vez de un contador, loguea status y host, y lo persiste en columnas nuevas de `push_suscripciones`. Bloque de diagnóstico en "Mi cuenta" con prueba **local** (`showNotification()` directo, sin red) que separa "falla el canal del sistema" de "falla la entrega".
- **Contador en la pestaña** (HU-20), punto en el favicon y `setAppBadge`.
- **Documentación**: HU-20 y HU-21 nuevas, enmiendas a HU-01/07/08/18, tabla `push_suscripciones` en modelo-datos (faltaba desde la v2), API y wireframes.

**Sobre el bug de las notificaciones de Ariel: quedó diagnosticado.** Franco probó en un Android con Chrome y llegan. Eso descarta el backend, las claves VAPID y el cifrado del payload: el problema es Samsung Internet en el celular de Ariel. **Instalarle Chrome es la solución** — y de paso le habilita el selector de contactos. Los arreglos de arriba se hicieron igual porque eran defectos reales.

**Y hay un segundo caso, distinto, que también quedó explicado.** A Franco no le llegaban avisos a su iPhone aunque a su amigo sí. No era iOS: **una suscripción push pertenece a la base de datos que estaba activa cuando se registró**. Su iPhone se suscribió mientras Render apuntaba a desarrollo; cuando volvió a producción, ese dispositivo dejó de estar en la lista que lee el envío. Se arregla desactivando y volviendo a activar los avisos desde la app deployada.

De ahí salen dos cosas que conviene tener presentes:

- ⚠️ **Defecto conocido, sin arreglar:** el panel dice "avisos activados" mirando **solo el navegador** (`suscripcionActual()` en `lib/push.ts`), nunca al backend. Los dos estados pueden estar desincronizados y la pantalla no lo delata. El endpoint `GET /api/admin/push/dispositivos` ya devuelve lo que hace falta para reconciliarlo; falta usarlo en la UI.
- Un **403** al enviar significa claves VAPID que no coinciden con las que firmaron esa suscripción — típico después de rotarlas. Esa fila no se borra sola (a diferencia de 404/410) y el dispositivo tiene que volver a activarse a mano.

Una cosa para no olvidar:

- ~~`hacer_telefono_opcional` y `diagnostico_push` están aplicadas solo en desarrollo~~ — **las dos están aplicadas en producción** desde antes del 13/8/2026, junto con el resto. Ver "Estado real de producción" arriba.
- ⚠️ `diagnostico_push` lleva `DEFAULT CURRENT_TIMESTAMP` escrito a mano en el `updated_at`: Prisma lo genera sin default y la migración falla sobre una tabla con filas. Es exactamente el motivo del ritual de leer el SQL antes de aplicar.

### Etapa 2 — WhatsApp como canal principal ✅ código terminado (HU-22)

Los avisos del turno, con el link de gestión adentro, salen por WhatsApp; el mail quedó como respaldo. Todo verificado en local con el adaptador de consola.

**Cómo quedó armado:**

- `backend/src/services/whatsapp/` — adaptador con el **mismo molde que `services/mail/`**: interfaz, Cloud API por `fetch` nativo (cero dependencias HTTP) y consola. Se elige por la presencia de `WHATSAPP_TOKEN`.
- `backend/src/utils/telefono.ts` — `aE164()`, la traducción de salida. **No toca `validaciones.ts`**: el número se sigue guardando como lo escribió la persona, porque Ariel lo lee para llamar.
- `notificaciones.service.ts` — intenta WhatsApp y cae al mail.
- ⚠️ **El adaptador de consola no cuenta como enviado** (`whatsappEstaConfigurado()` al final de `intentarAvisoPorWhatsapp`). Sin ese detalle, desplegar esto antes de terminar los trámites con Meta apagaría el mail en silencio, que hoy es el único canal que funciona.

**Son tres mensajes, no uno** (confirmado, reprogramado, cancelado). Los textos para presentar a Meta están en **`Docs/plantillas-whatsapp.md`**, que es la fuente de verdad de lo que dicen: el cuerpo no vive en el código, vive aprobado del lado de Meta.

- El tipo de aviso es `TipoAviso` (`'confirmado' | 'reprogramado' | 'cancelado'`) y **no** el `esReprogramacion: boolean` de antes: el booleano se quedó corto apenas apareció el tercer caso.
- ⚠️ **Las tres plantillas comparten las mismas tres variables a propósito** ({{1}} nombre, {{2}} servicio, {{3}} cuándo), así el armador sirve para las tres sin ramificar. Si al cargarlas en Meta se desordenan, el mensaje sale mezclado y **nada del lado nuestro lo delata** — hay un test que fija el orden por eso.
- ⚠️ **La de cancelación no lleva variable de botón**: su botón es una URL estática al inicio del sitio, porque un turno cancelado ya no se gestiona. Mandarle una variable a una plantilla que no la declara es un 400 de Meta.
- **La cancelación avisa a los dos lados**: al cliente el mensaje (por los dos caminos de baja — el suyo y el de Ariel desde el panel; el segundo es el que importa, es la única forma de que se entere) y a Ariel un push con **tag propio**, que si fuera el mismo del alta reemplazaría en pantalla al aviso de la reserva.
- El mail de cancelación **no lleva el .ics adjunto**: un `METHOD:REQUEST` volvería a crear el evento que el cliente quiere sacarse de encima. Borrarlo de su calendario necesita un `METHOD:CANCEL`, que quedó fuera de alcance.

**Las dos trampas que se encontraron probando, no razonando:**

- ⚠️ **`libphonenumber-js` sola NO alcanza.** Solo agrega el `9` de celular cuando encuentra el `15`: `0351 15 459 3325` → `+5493514593325` ✅, pero **`351 459 3325` → `+543514593325`** (fijo) ❌ — y ese es justo el formato del placeholder de nuestro formulario. Hay que agregar el `9` a mano. Si sale sin él, WhatsApp acepta el número y el mensaje no llega nunca.
- ⚠️ Se importa la metadata **`max`** y no la `min` (la del import por defecto): `min` solo mira la longitud y da por válido cualquier argentino de 10 dígitos aunque la característica no exista.
- Se asume **celular** ante un argentino de 10 dígitos sin `0` ni `15`. Es ambiguo de verdad, pero un fijo no tiene WhatsApp: agregarle el `9` es lo único que le da chance de llegar.

**Lo investigado, para no volver a averiguarlo:**

- **Coexistence** (Meta, mayo 2026, ya en todos los países) permite el **mismo número** en la app de WhatsApp Business **y** en la Cloud API a la vez, sin perder chats. Era el bloqueante histórico.
- **No hay abono de plataforma**; se paga por mensaje. Las plantillas *utility* son **gratis dentro de la ventana de 24 h** que abre el cliente al escribir primero.
- **No hace falta verificar el negocio con Meta**: sin verificar el tope son 250 conversaciones **por día**, y Ariel atiende ~230 clientes **por mes**. La **plantilla** es otro trámite distinto y ese sí hace falta — es el formato aprobado para poder escribirle primero a alguien.
- El link entra como **botón de URL dinámica** con una variable al final: `https://…/turno/{{1}}`. Solo viaja el id del turno; la base es parte de la plantilla.

### Conexión con Meta (20/8/2026) — probado con el número de prueba

**Las plantillas son CUATRO y están aprobadas**: `turno_confirmado_v2`, `turno_reprogramado`,
`turno_cancelado_cliente` y `turno_cancelado_negocio`. El detalle completo —los textos, por qué
la cancelación se partió en dos, y las trampas que aparecieron conectando— vive en
`Docs/plantillas-whatsapp.md`, que es la fuente de verdad.

- ⚠️ **`turno_confirmado_v2` no es un typo.** Para cambiarle una palabra se borró y se recreó, y
  Meta bloquea reusar el nombre de una plantilla borrada. **Una plantilla se EDITA con un `POST`
  sobre su id, no se borra.** El default de `plantillaConfirmado` en `env.ts` ya dice `_v2`.
- ⚠️ **La cancelación son dos plantillas y `TipoAviso` tiene cuatro casos**: al que canceló con
  tiempo se le agradece, al que se quedó sin turno porque Ariel no puede atender se le pide
  disculpas. `enviarAvisoDeCancelacion` **exige** `'cliente' | 'negocio'` sin default: un default
  silencioso haría que un llamador nuevo mandara el mensaje equivocado sin que nada lo delate.
  El panel manda **siempre** `'negocio'`, incluso cuando el cliente avisó por teléfono — el
  agradecimiento ya se lo dio Ariel en esa llamada.
- ⚠️ **El tono es en singular**: Ariel es uno solo ("escribime", "tuve que cancelar").
- ⚠️ **Se vio un mensaje aceptado por Meta que no se entregó.** El backend no tenía nada para
  loguear. Es la advertencia de "200 ≠ entregado" pasando de verdad, y **el respaldo por mail no
  la cubre** porque para el código el envío fue exitoso.
- ⚠️ **La lista de destinatarios del número de prueba no acepta la forma con `9`**, así que el
  flujo se probó con `aE164` parcheado en local (revertido). Y apareció evidencia de que **Meta
  normaliza el `9` sola** —manda a `54…` y responde `wa_id: 549…`, y los mensajes llegaron—, lo
  que contradice la nota de la Etapa 2. **Volver a medirlo con el número real antes de darlo por
  sabido.**

**Pendiente, y no es código:**

1. Asignar la WABA `La Peluqueria` al **usuario del sistema** (Business Settings → Usuarios del
   sistema → Agregar activos). Hoy el token permanente ni la ve.
2. **Coexistence** sobre el número de Ariel: figura como `ON_PREMISE` y desde ahí la Cloud API no
   envía ni deja crear plantillas.
3. **Recrear las cuatro plantillas en esa WABA** — son por WABA, las de la de prueba no le sirven.
4. **Información de pago** en Meta: sin eso no salen los mensajes iniciados por el negocio.
5. `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` en Render (van juntas).
6. Verificar que los **mensajes automáticos de la app de WhatsApp Business** (el de bienvenida con
   el link al turnero) sigan funcionando con Coexistence activado. Debería, pero no está probado.

**Fuera de alcance dentro de WhatsApp:** el recordatorio previo al turno, y la respuesta automática al cliente que escribe primero (⚠️ esta última **no necesita código nuestro**: la da la app de WhatsApp Business con su mensaje de bienvenida, y solo hay que pegarle el link del turnero).

### Sincronización de Coexistence (1/9/2026) — el endpoint de un solo disparo

`POST /api/admin/coexistence/sincronizar` ejecuta las dos llamadas de `smb_app_data` que
Meta pide después del Embedded Signup. El detalle está en `Docs/especificacion-api.md` y la
tabla en `Docs/modelo-datos.md`; acá va lo que hay que saber antes de tocarlo.

- ⚠️ **Cada llamada se puede hacer UNA sola vez en la vida del número, y hay 24 horas de
  plazo.** Repetirla o que falle obliga a desvincular el número y rehacer el Embedded
  Signup entero. Por eso **no corre sola en ningún lado**: la dispara una persona y mira el
  resultado. Un job con reintentos o un doble click se llevarían puesta la oportunidad.
- ⚠️ **La garantía de "una sola vez" es el `@unique` de `sync_type`, no un `if`.** Dos
  requests simultáneos pasarían un chequeo en aplicación los dos. Mismo criterio que el
  `EXCLUDE` de `turnos`.
- ⚠️ **La fila se inserta ANTES de llamar a Meta.** Al revés, una caída entre la llamada y
  el registro la dejaría hecha y sin rastro, y el próximo intento la repetiría — el único
  desenlace sin arreglo. Consecuencia asumida: **una llamada fallida bloquea el reintento**,
  y destrabarla es borrar la fila a mano. El 409 lo explica nombrando la tabla y el `DELETE`.
- Es **`super_admin`**: no es operación diaria de la peluquería. ⚠️ Y va con `requireAuth`
  **antes** — `requireSuperAdmin` solo lee `req.admin.rol`, que lo pone aquel; solo, la ruta
  responde 403 siempre.

⚠️ **Conviven DOS versiones de la Graph API a propósito.** Los envíos de mensajes siguen en
`WHATSAPP_API_VERSION` (v23) y la sincronización usa `WHATSAPP_COEXISTENCE_API_VERSION`
(v26), que es la que `smb_app_data` necesita. Subir la global en la misma tarea que una
operación irreversible mezclaría dos riesgos: si algo sale mal, no habría forma de saber
cuál de los dos cambios lo causó. **El upgrade de todos los envíos a v26 es tarea aparte.**

⚠️ **Los eventos `history` del webhook se loguean resumidos** (`phase`, `chunk_order`,
`progress`) y no enteros: durante una sincronización llegan **cientos de chunks** y el log
queda inservible justo el día que hay que mirarlo. Efecto lateral bueno y verificado: cada
chunk trae conversaciones reales de clientes, y el resumen **no las deja pasar al log**.

### ⚠️ La base local NO es la de Render (1/9/2026)

| | |
|---|---|
| `DATABASE_URL` de `backend/.env` | branch **`prueba-ajustes-23ago`** |
| Lo que sirve Render | branch **`production`** (default) |

**Toda migración futura necesita un paso explícito contra `production`**, porque
`migrate deploy` a secas la aplica solo a la branch del `.env`. Si se olvida, el código sale
desplegado buscando una tabla que ahí no existe y revienta con 500. La forma que funcionó:
sacar la connection string de production con la MCP de Neon y pasarla por `DATABASE_URL` en
el `migrate diff` y en el `migrate deploy`, y después confirmar contra `pg_constraint` que
`turnos_no_solapamiento` sigue en pie.

⚠️ **Enmienda (22/8/2026): el webhook ya no está enteramente fuera de alcance.** Existe `GET`/`POST /api/webhooks/whatsapp` porque Meta lo exige para dar de alta la suscripción — ver `Docs/especificacion-api.md`. **Pero solo cumple el contrato mínimo**: el `GET` hace el handshake y el `POST` responde 200 y loguea. Lo que sigue sin estar es **procesar los eventos**: validar `X-Hub-Signature-256` y leer los `statuses`. O sea que la advertencia de abajo sigue valiendo igual.

⚠️ Sin procesar los estados, **el respaldo por mail cubre el envío que falla, no el que rebota**: Meta responde cuando acepta el mensaje, no cuando lo entrega. **Esto se vio pasar de verdad el 20/8/2026** — un aviso de cancelación que Meta aceptó y nunca llegó, sin nada que loguear.

### Etapa 3 — feriados y agenda en grilla ✅ código terminado (HU-23, HU-24)

Franco pasó la foto de la planilla de Drive: **una hoja por semana** (pestañas "Semana 1…5"), columna de hora + columna de nombre por cada día de martes a sábado, filas cada **20 minutos** — el mismo `PASO_MINUTOS` que ya usaba el backend.

**Feriados (HU-24).** La tabla, el endpoint y la pantalla ya existían desde la v1; faltaba la fuente. Ahora se sincronizan solos desde **Nager.Date**.

- ⚠️ **Regla de negocio nueva, no estaba en ningún documento:** en un feriado Ariel trabaja **medio día por defecto**, y puede pasarlo a día completo o a cerrado. Por eso `feriados.bloquea` (booleano) pasó a `modalidad` (enum de tres). El default es `medio_dia`, no `cerrado`.
- "Medio día" se implementa como **la primera franja de `horario_laboral`**, no como "la mañana": si Ariel cambia horarios, la regla lo sigue sola.
- Lo de "solo los días que trabaja" **no necesitó código**: el `if (franjasDb.length === 0) return 'cerrado'` de `obtenerDetalleDelDia` ya corre antes que el chequeo del feriado. Hay un test que lo fija.
- ⚠️ **El upsert nunca toca `modalidad`.** Es la única columna que refleja una decisión de Ariel; reescribir la fila entera se la borraría en silencio.
- Sincroniza al arrancar solo **el año que no tenga filas** (Render duerme y levanta muchas veces por día), más un botón "Actualizar feriados" en el panel para el feriado decretado a mitad de año.
- La pantalla **esconde los feriados que caen en días que no trabaja**: son 6 de 16, y decidir sobre ellos es decidir sobre nada.

**Grilla semanal (HU-23).** La vista "Semana" pasó de lista a grilla; la vista "Día" no se tocó.

- ⚠️ **El eje vertical es tiempo continuo, no filas.** El alto sale de la duración, así que un turno de 35 min mide 35 minutos y la grilla ya sirve para cualquier duración futura sin tocar el componente. Las líneas de 20 min son fondo de lectura.
- El alto usa la **duración del snapshot**, no la del servicio actual — verificado midiendo el DOM. Es la regla de "el turno guarda una copia" funcionando.
- Dos defectos encontrados **mirando la pantalla, no compilando**: las celdas fuera del horario de *ese* día se veían como huecos libres (el sábado abre 09:00 y cierra 20:30, el resto no), y los huecos de días pasados abrían un modal donde no se podía elegir nada. Los dos arreglados.
- Tocar un hueco abre `ModalCargarTurno` con día y hora puestos. La hora entra como **preferencia**, no como valor fijo: la disponibilidad depende de la duración del servicio, que se elige después.
- ⚠️ **Los turnos que comparten un rato se reparten el ancho en columnas** (`repartirEnColumnas`), como cualquier calendario. Antes se apilaban en absoluto y el de abajo desaparecía por completo. **Que dos turnos se pisen NO es un error de datos y no hay que "arreglarlo" en el backend:** marcar Ausente libera el rato que queda —el cliente no vino a los 10 minutos, Ariel lo marca y mete a otro— y el `EXCLUDE` de la base es exactamente esa regla escrita donde corresponde. La primera lectura de este bug fue endurecer el `EXCLUDE` a los tres estados que la agenda dibuja, y **habría roto justo el flujo que Ariel usa**. ⚠️ **Matiz del 14/8/2026:** el predicado sí se amplió, pero a `('reservado','realizado')` y **no** a los tres — `ausente` sigue afuera, que era el punto. Ver la regla en "Reglas de negocio clave". Los turnos que no se pisan entre sí comparten columna, así el grupo no se angosta de más, y uno solo devuelve `columnas: 1` con los mismos 2 px de cada lado que daba `left-0.5 right-0.5`: **sin solapamiento la grilla queda idéntica a como estaba**. Medido en el DOM sobre columna de 235 px: turno solo 2/230, pisados 2/113 y 119/113.

**Estado de avisos (el defecto que estaba anotado como conocido).** `CuentaPage` cruzaba solo lo que sabe el navegador. Ahora compara contra `GET /api/admin/push/dispositivos` usando una **huella** (hash del endpoint, no el endpoint — es una credencial) y muestra un tercer estado: "este dispositivo cree que está activado pero el servidor no lo conoce".

### Etapa 3 (segunda mitad) — fichas de clientes ✅ código terminado (HU-25)

Sección "Clientes" en el panel, ficha dentro del detalle del turno, e insignias de color en la grilla. Todo verificado en el navegador, en los dos temas y en ancho de celular.

**Lo que se construyó:**

- **Identidad por teléfono normalizado** (`utils/telefono.ts`, ya existía desde la Etapa 2): dos reservas con el mismo número son la misma persona, sin adivinar nombres. La ficha se resuelve dentro de `crearTurno` —el único lugar por el que pasan la reserva de la web y la carga manual— así que ninguna vía puede quedarse sin ficha por olvido.
- **Tablas nuevas:** `clientes` (`telefono_e164` unique, `apodo`, `nombre`, `notas`), `etiquetas` (`nombre` unique + `color` hex) y `cliente_etiquetas` (M-N), más `turnos.cliente_id` nullable.
- ⚠️ **`turnos.cliente_telefono` sigue guardando el número tal como lo escribió la persona** y `clientes.telefono_e164` la forma canónica. No es duplicación: uno es para que Ariel lo lea y llame, el otro para comparar identidades. Mismo criterio que el snapshot del servicio.
- **Las etiquetas son insignias**: círculo del color que elige Ariel + el texto que él escribe. Solo el círculo en la grilla, círculo + nombre al abrir el turno.
- **Etiqueta automática "Nuevo"**: se la pone el sistema a toda ficha recién creada, para que Ariel sepa que a esa persona no la tiene fichada. ⚠️ Se busca por `etiquetas.clave = 'cliente_nuevo'`, **no por el nombre**: Ariel la puede renombrar y recolorear sin romper el automatismo. Se pone una sola vez (al crear la ficha) y **no se saca sola** — la saca él, que es el gesto de "ya la conozco". Si la borra, los clientes nuevos dejan de marcarse y nada más falla; la pantalla de etiquetas avisa cuál es la automática.
- ⚠️ **El anillo de la insignia usa `tinta` (el color del texto), no un gris fijo.** Ariel elige el color libre, así que tarde o temprano va a elegir uno casi igual al fondo. Como `tinta` contrasta contra la superficie por definición en los dos temas, el anillo también. Verificado con `#ffffff` y `#000000` en claro y en oscuro.
- **`PATCH /api/admin/turnos/:id/telefono`** — le carga el número a un turno que se guardó sin él (HU-08) y lo engancha con su ficha. Sin esto, todos los turnos que Ariel carga con la persona enfrente quedaban fuera de las fichas para siempre. Endpoint propio y no dentro del `PATCH` de turno: aquel mueve el turno y revalida disponibilidad, esto solo completa un dato de contacto.
- **No se integra Drive por OAuth**: lo que le servía de Drive era el acceso multiplataforma, y la app web ya lo es. ⚠️ **La exportación a CSV se construyó y después se sacó a pedido de Ariel** (endpoint, servicio, cliente de API y test incluidos, no solo el botón). El motivo por el que existía —"llevarse los datos"— resultó ser un problema que él no tiene: consulta las fichas en el panel, al lado del turno.
- **Backfill:** `npm run backfill:clientes`. Es idempotente. ⚠️ **Sigue pendiente en producción.** Al 21/8/2026 queda 1 turno con teléfono y sin ficha, de 14 en total; el resto la tiene porque `crearTurno` se la creó al reservar. (La medición vieja de "17 turnos en 3 fichas" era de la base de desarrollo, que ya no existe.)

**Dos cosas que se encontraron mirando la pantalla, no compilando:**

- ⚠️ **Las insignias abajo del servicio quedaban cortadas.** Un turno de 20 minutos son 34 píxeles: entran dos renglones, no tres. Van en el mismo renglón que el nombre, y el que cede espacio es el nombre (que ya se recorta con puntos suspensivos).
- El modal de turno se quedaba con la copia vieja: al cargarle el teléfono, seguía ofreciendo cargarlo. `AgendaPage` ahora relee el turno abierto de la agenda en cada render en vez de usar el snapshot del click.

**Colores de la agenda, todos como tokens:**

- **El color dice el estado y nada más**: miel próximo, verde realizado, rojo ausente, iguales en los dos temas. ⚠️ `ausente` era un neutro en la grilla y un ámbar-naranja en la vista Día — el mismo estado con dos colores según dónde se lo mirara.
- **`ahora` (rojo)** — línea horizontal a la hora actual + **la hora del margen izquierdo en rojo** + borde de 3 px en el bloque en curso. ⚠️ **El turno en curso NO se tiñe.** Se probó pintado de rojo y estaba mal: mientras duraba, un reservado y un ausente se veían idénticos. ⚠️ El rojo estaba **hardcodeado como `red-500`**: mismo caso que los cinco colores que la v3 ya había pasado a tokens.
- ⚠️ La hora del margen se pinta solo si **hoy está entre los días visibles**: la columna de horas es una sola para toda la semana, y en otra semana señalaría una línea que no existe.
- **`useMinutosAhora`** le da a la línea su propio reloj. Sin eso dependía del refetch de la agenda, que con la pestaña oculta baja a 3 minutos — justo cuando volvés a la pestaña y la mirás.
- **`feriado` (violeta)** — tiñe el encabezado del día y raya el rato que el feriado se comió, distinto del rayado neutro de "ese día no abro". El globito dice qué feriado es. Antes los dos motivos se veían iguales.
- `turnoEnCurso` vive en `utils/fecha.ts` y lo usan las dos vistas: un turno marcado en curso en la semana y normal en el día sería peor que no marcarlo en ninguna. Usa la `horaFin` guardada, no la duración del servicio actual.

⚠️ **Los encabezados de la grilla: centrar en vertical NO alinea, mueve.** Con el nombre del feriado abajo, la columna con feriado tenía un elemento más y los días no alineaban. Con `justify-center` el problema se corrió: medido en el DOM, la línea del día quedaba 13 px más arriba en esas columnas. Lo que lo arregla es estructural — el segundo renglón existe en **todas** las columnas aunque esté vacío (`min-h`) y el bloque se apoya arriba.

**Decisiones de interfaz:**

- **Tocar un turno en la grilla abre su detalle, no el reprogramar.** Antes abría directo la acción menos frecuente de todas, y no había forma de ver quién era el cliente sin tocarle el horario. La vista **Día no se tocó**: ahí las acciones inline son lo que hace rápido el día a día.
- El botón dice **"Reprogramar"** y no "Editar" (HU-09 mantiene su nombre puertas adentro). Mecánicamente no es lo mismo que el reprogramar del cliente —acá se mueve el mismo turno, allá se crea uno nuevo enlazado— pero esa diferencia es del modelo de datos, no de lo que Ariel está haciendo.
- El **apodo manda sobre el nombre** en la grilla, en el detalle y en el listado.
- El código de colores de la planilla **mezcla dos ejes**: amarillo/naranja describe al *cliente*, azul/violeta describe *un pago puntual*. Van separados: etiqueta en el cliente, medio de pago por turno (Etapa 4).

### Etapa 3 (cierre) — login por email, roles y recuperación ✅ código terminado (HU-26)

**Se entra con el email.** `usuario` quedó solo como el nombre que se muestra: eran dos cosas distintas mezcladas en la misma columna.

**Dos roles.** Franco `super_admin`, Ariel `admin`. ⚠️ **La diferencia real es una sola: administrar cuentas.** Todo lo demás del panel *es* gestionar la peluquería y Ariel lo puede entero — conviene tenerlo escrito porque invita a buscar una segunda diferencia que no existe.

- El rol se lee **de la base** en cada request, dentro de la misma consulta que `requireAuth` ya hacía para `passwordChangedAt`. Sacarlo del token haría que cambiarle el rol a alguien no tenga efecto hasta 7 días después.
- La sección "Administradores" se esconde del nav y la ruta redirige, pero **eso es comodidad**: quien decide es `requireSuperAdmin`, que responde 403. Verificado llamando el endpoint con un token de rol `admin`.
- `PATCH /admin/administradores/:id/password` es **la recuperación que no depende del mail**. Escribe `passwordChangedAt`, así que cierra las sesiones de esa cuenta.
- Dos candados contra el mismo accidente: nadie se cambia el rol a sí mismo, y no se puede bajar al último `super_admin`.
- **Se pueden crear y borrar cuentas** desde la pantalla. El `DELETE` borra de verdad (nada referencia a `administradores`, mismo criterio que las etiquetas) y **las sesiones de la cuenta borrada mueren solas**: `requireAuth` da 401 cuando la fila del token ya no existe. Verificado. Ahí alcanza con "nadie se borra a sí mismo": el que llama es siempre `super_admin` y no puede ser el borrado, así que siempre queda uno.

**El token de reset no tiene tabla.** Es un JWT firmado con `JWT_SECRET` **+ el hash actual de la contraseña**: al restablecer cambia el hash y el token viejo deja de verificar. Un solo uso, sin tabla, sin job de limpieza. Vence a los 30 minutos. Hay 8 tests que fijan esa propiedad, incluido que dos links pedidos seguidos siguen valiendo los dos.

⚠️ **El botón "me olvidé la contraseña" se esconde solo si no hay mailer real** (`GET /api/auth/recuperacion-disponible`). Sin key de Brevo el mail se imprime en el log del servidor: el botón prometería un mail que no llega, justo cuando la persona ya no puede entrar. Mismo criterio que `whatsappEstaConfigurado()`.

**Sobre no dejar a nadie afuera:**

- La columna `email` es **nullable** a propósito: se agregó sobre una base con una cuenta ya creada, y ponerle un email inventado para satisfacer un `NOT NULL` habría sido escribir un dato falso en la única fila que importaba. El seed la completa desde `ADMIN_EMAIL` sin tocar la contraseña.
- ⚠️ **Una cuenta sin email no puede entrar.** El seed lo avisa con un warning al correr y la pantalla de administradores las marca en rojo.
- ~~**En la base de desarrollo hay dos cuentas de Ariel**~~ — **resuelto y cerrado (13/8/2026)**. Era un problema exclusivo de la base de desarrollo, que ya no existe. En producción hay **una sola** cuenta de Ariel (`admin`, con email) más la de Franco (`super_admin`, con email). Verificado con `run_sql`. No hay nada que decidir ni que borrar.
- ⚠️ **Cambiar la contraseña en el `.env` NO cambia la contraseña.** El seed solo crea cuentas; nunca pisa la de una que ya existe, porque si lo hiciera, correrlo en producción le resetearía la contraseña a Ariel a la que hubiera quedado vieja en una variable de entorno. Pasó de verdad y costó un rato de confusión: se cambió `SUPER_ADMIN_PASSWORD`, el login empezó a rechazarla y no había ninguna pista. **Ahora el seed lo avisa** comparando contra el hash guardado. Para cambiarla de verdad: "Mi cuenta" (pide la actual) o que el super admin la fije desde "Administradores".
- Las variables nuevas van en `.env`: `ADMIN_EMAIL`, `SUPER_ADMIN_USUARIO`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`. El mail real de Ariel ya está cargado en el `.env` de desarrollo; **no se escribe acá** — este archivo se versiona en un repo público y es el dato personal de un tercero, que además no hace falta para trabajar (quien lo necesita lo tiene en el `.env`).
- ⚠️ **Un email ya cargado no se podía cambiar por ningún lado** — el seed solo lo completa cuando está vacío. Como el login es por email, un mail mal tipeado dejaba la cuenta inutilizable sin entrar a la base. Se agregó `PATCH /admin/administradores/:id` y el botón "Datos" en la pantalla de administradores. **Sí funciona sobre la cuenta propia**, al revés que los de contraseña y rol: corregirse el mail no es un privilegio abusable, y prohibirlo dejaría al super admin sin arreglar su propia dirección.

**La deriva de las migraciones quedó arreglada de raíz.** `PushSuscripcion.updatedAt` ahora declara `@default(now())`, que es lo que la base ya tenía desde `diagnostico_push`. Antes cada diff emitía un `DROP DEFAULT` que había que borrar a mano — pasó en `fichas_de_clientes` y volvió a pasar acá. Ahora el diff sale limpio.

⚠️ **`prisma migrate dev --create-only` falla contra Neon** ("environment is non-interactive"): no consigue shadow database. El reemplazo que funciona es `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, leer el SQL, escribirlo a mano en `prisma/migrations/<timestamp>_<nombre>/migration.sql` y aplicar con `migrate deploy`. El ritual de leer el SQL antes de aplicar no cambia.

### Etapa 4 — cobros ✅ código terminado (HU-27)

Era la única etapa **sin historia de usuario escrita** —"Precios" figuraba textualmente en la lista de fuera de alcance— así que las reglas se decidieron con Franco antes de codear y quedaron en HU-27. Lo que se decidió: se registra lo ya cobrado (nada de cobro online), el disparador es el botón "Realizado", el precio vive en el servicio y **el cliente no lo ve nunca**, y hay una sección "Cobros" aparte.

**Lo que se construyó:**

- **`servicios.precio`** — pesos enteros, **nullable** (`null` = "todavía no le puse precio", que no es `0`). ⚠️ Cuando se construyó esta etapa era un **dato interno**; el 14/8/2026 pasó a salir por la API pública, ver "Reglas de negocio clave". El mapeo campo por campo de `getServiciosPublico` se conservó igual: no estaba ahí para proteger a `precio` en particular, sino para obligar a decidir dato por dato qué se publica.
- **Tres columnas en `turnos`** (`medio_pago`, `monto_cobrado`, `cobrado_en`), no una tabla `pagos`: hay un pago por turno, sin parciales ni historial, y una tabla sería estado desincronizable para conseguir lo mismo. Mismo criterio que el token de reset sin tabla.
- ⚠️ **`monto_cobrado` NO es un snapshot de la reserva**, al revés que `servicio_duracion_snapshot`. La duración se congela porque decide la disponibilidad; el precio no afecta nada hasta que se cobra, y con inflación un turno de hace tres semanas se cobra al precio de hoy. Se copia del precio actual al cobrar y Ariel lo puede pisar.
- **`MedioPago` es un enum de cuatro** (`efectivo`, `transferencia`, `mercado_pago`, `tarjeta`), no una tabla configurable como las etiquetas: acá el conjunto es cerrado y el desglose necesita categorías fijas para sumarse.
- **El cobro viaja dentro del `PATCH /admin/turnos/:id/estado`**, no en una llamada aparte: para Ariel es un solo gesto, y partirlo dejaría la puerta abierta a que el segundo request falle y el turno quede marcado sin cobro en silencio.
- ⚠️ **Se puede marcar Realizado sin registrar el cobro**, y por eso existe `PATCH /admin/turnos/:id/cobro`. Sin ese endpoint, un turno marcado a las apuradas quedaría fuera de los totales para siempre — el mismo agujero que tapó `PATCH …/telefono` en HU-25. Registrar dos veces corrige, no duplica.
- **La regla "solo se cobra un turno realizado" vive en un solo lugar** (`esCobrable` en `turnos.service.ts`), usada por el schema del request y por los dos caminos del service. Verificado por API: `ausente` + cobro da 400, cobro sobre ausente da 409, monto con decimales da 400.
- **Sección "Cobros"** con atajos Hoy/Semana/Mes más rango libre, total, desglose por medio y la lista de turnos. ⚠️ **Los realizados sin cobro se cuentan aparte y no se suman al total**, y la pantalla lo dice: un total al que le faltan turnos sin avisarlo no cierra contra la caja y no hay forma de saber por qué.
- **Desde la lista de Cobros se registra o corrige el cobro** (pedido de Ariel): la fila entera abre el mismo modal. Es la pantalla donde se ven juntos los pendientes, así que sin esto señalaba el problema y obligaba a ir a buscar cada turno a su día. Para eso `ModalCobro` pide `TurnoACobrar` —solo lo que usa— en vez de un `TurnoAdmin`, y el DTO de cobros manda `estado` y el `servicio` como objeto: el **id** es el del servicio de hoy (de ahí sale el precio) y el **nombre** es el snapshot de la reserva.
- **El orden del nav es Agenda · Cobros · Clientes · Horarios y servicios · Mi cuenta**, elegido por Ariel: sigue su día.
- **`ModalTurno` lleva las cuatro acciones** (Realizado · Ausente · Reprogramar · Cancelar), con la misma jerarquía que `FilaTurno`. Tenía solo las dos últimas y era un agujero: desde la grilla semanal no se podía cerrar un turno sin cambiar a la vista Día. "Realizado" abre el cobro (que marca y cobra de una); "Ausente" no abre nada.
- ⚠️ **La foto del servicio vive en `servicios.foto`, no en un mapa por nombre en el frontend.** Estaba indexada por el **nombre exacto** en `Landing.tsx`, y era un defecto real: el nombre lo edita Ariel desde el panel (HU-13), así que renombrar "Corte clásico" le borraba la foto en silencio. Mismo error que el proyecto ya había evitado en HU-25 al no usar el nombre del cliente como identidad. La migración `foto_de_servicio` traspasó el mapeo a la base una única vez; de ahí en más el nombre es libre. **Verificado renombrando un servicio y viendo que la foto sobrevive.**
- `foto` **sí** sale por la API pública (es lo que se dibuja en la landing) y `precio` **no**. Que dos columnas nuevas del mismo modelo terminen una adentro y otra afuera es justamente lo que el mapeo campo por campo de `getServiciosPublico` obliga a decidir.
- ~~**Ariel no elige la foto desde el panel.** Se asigna en la base o en una migración~~ — **ya no vale desde el 16/8/2026 (HU-29)**: Ariel sube la foto desde el panel, incluida la de un servicio que acaba de crear. Sigue sin estar en los schemas de crear/editar, pero por otro motivo: va por `PUT /admin/servicios/:id/foto`, porque un archivo y un formulario de texto no comparten ni el tamaño de cuerpo ni los errores.
- El `onError` del `<img>` cae a la foto de stock cuando el archivo no existe: una genérica es un default, una imagen rota parece un sitio abandonado. Cubría a "Corte de Pelo mujer" mientras le faltaba el archivo; desde el 11/8/2026 `servicio-corte-mujer.jpg` **ya está subido** y los cuatro servicios tienen su foto propia. El respaldo queda igual, para el servicio nuevo al que todavía no se le puso ninguna.
- ⚠️ **En los cobros la base filtra pero la suma se hace en la aplicación**, al revés del reflejo habitual. El motivo: la pantalla ya devuelve la lista de turnos del período, así que un `groupBy` sería un segundo viaje a Neon para derivar algo que ya está en memoria. De paso `resumirCobros` queda pura y con 7 tests.

**Lo que se decidió mirando la pantalla:**

- **La marca del cobro en la grilla es un signo, no un color** (`$` gris cobrado, `$?` ámbar pendiente). El color del bloque dice el estado y nada más (HU-23); pintarle el cobro encima sería repetir el error de la planilla, donde un mismo color quería decir dos cosas. Va en el renglón del servicio, no en uno propio: medido en el DOM, un turno de 20 min mide 34 px con 32 de contenido — el tercer renglón no entra, exactamente como pasó con las insignias.
- **El cobro pendiente también se completa desde la vista Día**, no solo desde el detalle de la grilla. Las filas del día no abren ningún modal (a propósito), así que sin eso Ariel tendría que irse a la vista Semana —la que no usa en el celular— para arreglar un cobro.
- ⚠️ **Un monto no va nunca en `font-hero`.** Playfair dibuja el `$` con **doble barra**, que es la convención del dólar; el peso argentino lleva barra simple. El carácter que devuelve `Intl` para `ARS` es el correcto —engaña el glifo, no el texto— y estaba en el total de Cobros, el número más grande de la pantalla. Cormorant, Lora y la del sistema lo dibujan bien. Anotado también en `utils/dinero.ts`.
- ⚠️ **En la lista de Cobros el monto y el medio se alinean a la izquierda en celular.** Cuando la fila envuelve, `text-right` alinea contra un bloque que se encoge al contenido: el monto quedaba con distinta sangría en cada fila según cuál texto fuera más largo. Solo se ve a ancho de celular.

~~**Pendiente y no es código:** sentarse con Ariel a cargar el precio de cada servicio.~~ **Hecho.** Verificado contra producción el 21/8/2026: los **cuatro** servicios activos tienen precio (Corte clásico $16.000, Corte + Barba $25.000, Barba $10.000, Corte de Pelo mujer $20.000) y los cuatro tienen foto propia. ⚠️ Lo que sí conviene repasar cada tanto con él: **el cliente ve esos precios en la web** desde el 14/8/2026, así que uno desactualizado es peor que ninguno.

### Cierre de la v3 — dos pedidos de Franco (11/8/2026) ✅

**1. La tolerancia al cierre, que resultó no existir.** El pedido era sacarla; el código nunca la tuvo. Verificado contra la base de desarrollo, no solo leyendo: un martes (cierra 20:00) el último Corte de 20 min sale 19:40 y el último Corte+Barba de 30 min sale 19:20, porque 19:40 terminaría 20:10. Lo único mal era **la línea de este documento** que hablaba de "10 minutos de margen": ya está corregida arriba. Se agregó un test que fija los **dos** bordes juntos —el que cierra justo entra, el que se pasa no— porque fijar uno solo deja lugar a redondear el otro.

**2. La flechita de atrás de Chrome parecía desloguear.** No deslogueaba: el token nunca se borraba. `LoginPage` navegaba al panel con un *push*, así que `/admin/login` quedaba en el historial y el botón de atrás lo traía de vuelta. Ariel veía el formulario y daba por hecho que lo había echado — tocando "adelante" volvía al panel sin tipear nada, que es la prueba de que la sesión seguía viva.

- Se arregló con **las dos cosas, no una**: `navigate(..., { replace: true })` en `LoginPage` y en `RestablecerPage`, y además un **guard** en `LoginPage` que redirige al panel si ya hay token válido. El `replace` cubre el login de recién; el guard cubre el favorito al login, la pestaña vieja y cualquier entrada de historial de una sesión anterior. Es el espejo exacto de `RequireAuth`.
- ⚠️ El guard va **después de los hooks** (`useQuery`/`useMutation`): React los pide siempre en el mismo orden, así que el corte por sesión activa no puede ir arriba de todo.
- No hay riesgo de rebote infinito: el guard y `RequireAuth` preguntan lo mismo (`getTokenValido`). Si el token es válido para el navegador pero el backend lo rechaza, el 401 de `api/client.ts` lo borra y recarga — el guard ya no lo ve.
- El "Cerrar sesión" de `CuentaPage` también pasó a `replace`: sin eso rebotaba igual (lo ataja `RequireAuth`), pero el rebote se veía.
- Verificado en el navegador con una sesión real: entrar a `/admin/login` logueado cae en la Agenda, atrás lleva a la landing con el token intacto, adelante vuelve al panel, todos los requests 200 y cero errores de consola. Después de salir, atrás **no** muestra el panel.

### Limpieza de la landing — Productos y Beneficios (13/8/2026) ✅

Pedido de Franco: sacar Productos, **comentar** Beneficios, y que la landing sea el turnero y el selector de servicios. Todo vive en `frontend/src/components/Landing.tsx` y es **puro frontend** — no hay tabla, ni endpoint, ni línea en `Docs/` para ninguna de las dos secciones. Eran arrays hardcodeados.

⚠️ **La landing no es una ruta.** Es el paso 1 del wizard de `ReservarPage`, que vive en `/` (por eso "volver al inicio" resetea el wizard en vez de navegar). Cambiar la landing es recortar ese paso, no crear una página.

**Productos se borró de verdad**: la constante, la sección, `ProductoCard`, el botón del nav y las cuatro fotos `/imagenes/producto-*.jpg`. La peluquería no vende productos, así que era una vidriera inventada. Si vuelve, está en el historial de git.

⚠️ **Beneficios está comentado, no borrado, y son TRES bloques que van juntos**: la constante `BENEFICIOS`, la sección oscura dentro del `return` y el componente `BeneficioCard`. Ariel pidió sacarlo y Franco lo quiere conservar para poder volver a mostrarlo sin rehacerlo. **Las tres fotos `/imagenes/beneficio-*.jpg` NO se borraron** por el mismo motivo: sin ellas, descomentar no alcanzaría para que la sección vuelva a verse. La nota que explica esto vive arriba de la constante, en el código.

- La sección oscura no necesita un `<hr>` propio al volver: su fondo la separa sola del contacto.
- Quedaron **2** separadores en vez de 3, sin dos seguidos. Medido en el DOM: `header 0→137`, hero `137→865`, `hr 865`, `#servicios 866→1588`, `hr 1588`, `#contacto 1589→2401`, `footer 2401→2610`. Contiguo, sin huecos — las secciones borradas no dejaron espacio muerto.
- El nav quedó en **Servicios · Contacto · Reservar turno**.

**Verificado contra producción**, no solo compilado: los 4 servicios activos se dibujan con sus 4 fotos propias (las cuatro con `naturalWidth > 0`, o sea que **ninguna cayó al respaldo de stock**), y el HTML renderizado no contiene la cadena "producto" ni "beneficio" en ningún lado — que es la prueba de que los bloques comentados no se filtran.

⚠️ **Beneficios volvió el 14/8/2026** (ver abajo), así que la parte de "está comentado" de esta sección ya no vale; Productos sigue borrado.

### Ajustes de Ariel (14/8/2026) — siete pedidos de Franco

Siete cosas que salieron del uso real. Código terminado, migraciones aplicadas.

0. **La grilla se re-ancla a lo agendado** — ver la regla en "Reglas de negocio clave". Es el cambio con más efecto diario de todos: con servicios de 15 y 30 minutos sobre una grilla de 20, el sistema le estaba escondiendo a Ariel ratos que tenía libres.

1. **Turnos en horarios pasados** (HU-08 ampliada) — ver la regla en "Reglas de negocio clave". Lo caro de esto no fue el flag sino **no aflojarle nada al cliente**: la ruta pública no cambió de firma, el default de `permitirPasado` es `false`, y hay un test espejo que se rompe si alguien lo invierte. Verificado por API: el `POST` público sobre una hora ya pasada sigue dando 409.
2. **Un realizado no se pisa** — regla nueva pedida por Franco, en la aplicación y en el `EXCLUDE`. `ausente` sigue liberando el rato.
3. **Precio del lado del cliente** — enmienda a HU-27.
4. **Beneficios volvió**, con el título "Beneficios de venir a este salón" y el primer beneficio cambiado a **"Gel modelador"** con `/imagenes/gel.jpeg`, que es el único producto que Ariel vende. ⚠️ La foto es un **flyer publicitario vertical (651×1280) con el precio impreso**: entra bien en la tarjeta `aspect-[4/5]` porque el recorte de `object-cover` se come justo las bandas negras de arriba y abajo, pero **el precio del flyer va a quedar viejo** y su paleta rojo/azul no es la del sitio. Está así porque es la foto que pasó Franco.
5. **"Color" borrado de verdad** — fila + `seed.ts`. El hero pasó a decir "Corte, barba y **estilo**".
6. **Teléfono: una sola regla en las tres puertas** — ver "Reglas de negocio clave".

Además: **selector de fecha en la agenda** (`<input type="date">` entre las flechas y "Hoy") y **"Ver ese día"** en el buscador de turnos, que hasta ahora te decía dónde estaba el turno y no te llevaba. ⚠️ **La fecha NO va a la URL**, y el motivo está comentado en `AgendaPage`: sería el primer `useSearchParams` del proyecto y sembraría entradas de historial en el panel — y el botón "atrás" ya confundió a Ariel una vez.

🚧 **Lo que quedó sin verificar en pantalla:** todo el panel de admin (el pasado, el origen `presencial`, el selector de fecha, "Ver ese día"). No se pudo entrar: tipear la contraseña de Ariel no es algo que Claude deba hacer. Lo tiene que probar Franco.

### Límite de reservas por cliente (15/8/2026) — HU-28 ✅ código terminado

Franco pidió impedir que una persona le llene la agenda a Ariel, ahora que el sistema no cobra
seña. **No había ninguna defensa**: ni rate limit, ni tope por teléfono, ni horizonte máximo.
Quedaron las dos reglas de la viñeta de "Reglas de negocio clave": 3 turnos por ventana móvil de
7 días y 90 días de horizonte, las dos solo para el cliente.

- **Cero migraciones**: una regla es un conteo y la otra una constante. No hubo que tocar el
  esquema ni correr el ritual contra producción.
- No se agregó índice sobre `turnos.cliente_id`: con 12 filas en la tabla y ~230 clientes por
  mes, la consulta no duele, y un índice pedía una migración sobre `turnos` — justo la tabla
  donde vive el `EXCLUDE` escrito a mano.
- ⚠️ **La carrera está aceptada**: dos requests simultáneos pueden pasar el conteo a la vez y
  dejar un turno de más. No se puso transacción a propósito — el daño real (dos personas sobre el
  mismo rato) ya lo impide el `EXCLUDE`, y acá lo peor que pasa es un cuarto turno.
- El defecto que apareció **mirando el código del frontend y no compilando**: `ReservarPage`
  ramificaba por status y no por `codigo`. Ver la viñeta en "Reglas de negocio clave".

**Verificado de verdad, sobre una branch descartable de Neon.** Como el backend local pega a
producción y ese día había turnos creados por Ariel, se creó una branch temporal
(`prueba-hu28-limite-reservas`), se apuntó `backend/.env` ahí, se probó a fondo y se borró. La
agenda real quedó intacta: 12 turnos y 7 clientes antes y después, cero turnos de prueba.
**Es el reemplazo de la base de desarrollo que ya no existe, y sirve para cualquier prueba que
escriba.** Lo que se comprobó por API: el 4º turno de la semana da 409, el de 7 días después
entra, cancelar libera el cupo enseguida, el límite es por persona (otro teléfono reserva igual
en la semana llena), reprogramar dentro de la propia semana funciona y pasado el horizonte da
409. En pantalla: el cartel sale **en el paso de datos sin perder el horario elegido**, con el
link de WhatsApp, sin errores de consola y sin scroll horizontal a 375 px.

⚠️ **Lo único que quedó sin probar por API es el espejo de Ariel** (que la carga manual no tenga
ninguno de los dos topes): `POST /api/admin/turnos` pide un JWT, y tipear la contraseña de una
cuenta no es algo que Claude deba hacer. Lo cubren el gate `!esAdmin` —una línea— y un test que
fija que los dos predicados se contradicen a propósito en la misma fecha.

⚠️ **Corrección al documento:** más arriba dice que la MCP de Neon tiene bloqueado
`get_connection_string`. El 15/8/2026 **funcionó sin problema**; era una limitación del momento,
no permanente.

### Fotos en fichas y servicios (16/8/2026) — HU-29 ✅ código terminado y verificado

Dos pedidos de Franco: fotos en la ficha del cliente además de las notas, y poder ponerle foto a
un servicio nuevo para que no quede el placeholder. Se sumó un tercero sobre la marcha: **poder
borrar las viejas**, para que el almacenamiento no se llene al pedo.

- ⚠️ **"Crear un servicio nuevo" ya existía** (`+ Nuevo servicio`, `POST /admin/servicios`). Lo
  único que faltaba de esa mitad era la foto. Vale releer antes de construir de más.
- Tabla `imagenes` nueva, con `CHECK` de dueño único y `UNIQUE` sobre `servicio_id`. **La
  migración salió limpia** (solo `CREATE TABLE` + FKs) y no tocó `turnos_no_solapamiento`;
  verificado contra `pg_constraint`, junto con que el `EXCLUDE` sigue en pie.
- **Compresión medida, no supuesta**: una foto de 3000×4000 y 1441 KB quedó en 675×900 y
  **153 KB** — 9× menos. El lado mayor se capa en 900 px conservando la proporción.
- **Se pudo entrar al panel sin usar la contraseña de nadie**, firmando un JWT de prueba con la
  clave local contra la branch descartable. Eso destraba lo que el 14/8 había quedado como "lo
  tiene que probar Franco": de acá en más el panel se puede verificar en el navegador.
- Verificado además: los rechazos (SVG, PDF, basura, base64 roto, sobrepeso), el tope de 5 con su
  borde, que borrar libera el cupo, que borrar con el id de otra ficha da 404 (el `where` va
  scopeado), que la foto subida gana sobre la estática y que al quitarla vuelve la estática, los
  headers de cache, los dos temas y 375 px sin desbordes. En la landing los 5 servicios cargan y
  **ninguno cae al stock**; la tarjeta del servicio nuevo mide exactamente igual que las otras.
- ⚠️ **Un defecto de copy que se corrigió de paso**: el modal de servicio decía *"Es tuyo: el
  cliente no lo ve en ningún momento"* sobre el precio, y eso era falso desde el 14/8/2026. Le
  estaba diciendo a Ariel que podía escribir cualquier cosa en un campo que ve todo el mundo.

✅ **La migración ya está en producción** (16/8/2026, pedida por Franco). Se construyó y se probó
sobre la branch descartable `dev-hu29-fotos`, que se borró al terminar, y recién después se aplicó
a producción con el ritual completo: leer el SQL, `migrate deploy`, y confirmar contra
`pg_constraint` que `turnos_no_solapamiento` sigue en pie. Los datos quedaron iguales antes y
después (12 turnos, 7 clientes, 4 servicios).

⚠️ Sin verificar: **HEIC de iPhone**. En teoría Safari lo decodifica y el canvas lo saca como
JPEG —por eso la compresión siempre exporta JPEG, sea lo que sea que entró—, pero no hay ningún
iPhone en el circuito de prueba. Si fallara, el síntoma es "no pudimos leer esa foto" al elegirla.

### Exportar la agenda a Excel (16-17/8/2026) — HU-30 ✅ mergeada y desplegada

Pedido de Franco: reordenar la barra de la agenda —"Cargar turno" afuera, el resto adentro de un
menú **"Más opciones"**— y sumar ahí una **exportación a Excel** con una hoja por semana y un
resumen final. La regla de negocio está en la viñeta de "Reglas de negocio clave"; acá va lo que
conviene saber antes de tocarlo.

- ⚠️ **Se usó `write-excel-file`, NO `exceljs`.** Se empezó por exceljs, que es la opción obvia, y
  se dio marcha atrás con el `npm audit` en la mano: arrastra **90 paquetes** y un aviso abierto
  en su `uuid` transitivo, y **este repo es público**. `write-excel-file` tiene **una sola**
  dependencia (`fflate`) y no agregó ningún aviso nuevo — el único que queda es el `nanoid` que ya
  estaba. Si alguna vez hace falta algo que no dé (imágenes, fórmulas), conviene revisar antes de
  volver a exceljs por reflejo.
- ⚠️ **`utils/excel.ts` importa la librería con `await import()` y no con un `import` arriba.** El
  paquete es ESM y este backend compila como CommonJS: con el import estático `tsc` corta con
  TS1479. La contracara es el `with { 'resolution-mode': 'import' }` del import de tipos. De paso,
  la librería recién se carga la primera vez que alguien exporta y no en cada arranque de Render.
- El servicio **no sabe nada de Excel**: `exportacion.service.ts` decide qué entra y cómo se
  agrupa, `utils/excel.ts` escribe el archivo. Es lo que permite testear "en qué hoja cae cada
  turno" sin generar un `.xlsx`.
- **Los montos van como número con formato de moneda de Excel**, nunca como texto ya armado: en
  una planilla una celda tiene que poder sumarse. Un turno realizado sin cobro deja la celda
  **vacía**, no en `0` — misma distinción que sostiene `formatearPesosOpcional` en el panel.
- ⚠️ **La hoja va agrupada por día y el color dice el estado** (pedido de Franco, 17/8/2026). La
  fecha dejó de ser una columna y pasó a ser la **banda** que abre cada bloque, con el subtotal
  del día alineado en la columna Monto; hay un test que fija que la suma de los días da el total
  de la semana. El color se pinta **solo en la celda Estado** —teñir el renglón entero taparía
  los montos— con los mismos tokens de HU-23: `#14682c` realizado, `#c62828` ausente, `#f5d020`
  pendiente, gris apagado el cancelado (que en la grilla ni se dibuja, así que no tenía color).
  ⚠️ **No se pinta por medio de pago**: es justo el defecto de la planilla de Drive que el
  proyecto ya decidió no heredar —un eje describía al cliente y otro un pago, en la misma celda.
- ⚠️ **La paleta de `utils/excel.ts` son los valores del tema CLARO, copiados a mano.** El
  backend no lee el CSS del frontend, y un Excel se abre siempre sobre fondo blanco: los valores
  del tema oscuro darían un archivo ilegible. Si se retocan los tokens de estado, hay que
  acordarse de este archivo.
- ⚠️ **Agrupar tiene un costo aceptado**: una planilla con bandas adentro no se puede ordenar ni
  filtrar sin romper la agrupación. Se eligió leerla, no pivotearla. La salida, si alguna vez
  hace falta, es volver a poner la columna "Día" en cada fila.
- ⚠️ **El nombre de cada hoja lleva el número de semana adelante** (`Sem 3 (11-15 ago)`). No es
  estético: Excel exige nombres de hoja únicos y con el tope de 425 días entran dos agostos de
  años distintos. Hay un test que lo fija.

**Verificado de verdad, y sin permiso especial: la exportación solo lee.** No escribe nada, así
que se pudo probar contra producción directamente, sin branch descartable.

- El archivo se **leyó de vuelta con un parser real** (`read-excel-file`, instalado con
  `--no-save` solo para eso y sin quedar en `package.json`), no solo inspeccionando el zip: 3
  hojas en orden, el `Resumen` último, los montos como números y no como texto, el apodo ganándole
  al nombre, el cancelado presente con su estado y el turno de lunes cayendo en su semana.
- **Y se miró de verdad**, que con colores no alcanzaba con leer el XML: `qlmanage -t` genera un
  PNG del archivo con Quick Look sin abrir Excel. Es la forma de ver la planilla como la va a ver
  Ariel — así se confirmaron las bandas, los badges de estado y los subtotales por día.
- **El cruce que importa:** exportar 2026 entero y pedir `GET /api/admin/cobros` del mismo rango
  dan lo mismo — total 56000, `sinRegistrar` 1 y el mismo desglose por medio. Es la prueba de que
  reusar `resumirCobros` sirvió para algo.
- Bordes por API: 425 días entra, 426 da 400; rango invertido, fecha basura y falta de parámetro
  dan 400; sin token, 401. Un período **vacío** devuelve un archivo válido con solo la hoja
  `Resumen` en cero, en vez de romper.
- En el navegador (con un JWT de prueba firmado localmente, el camino que estrenó HU-29): el menú
  abre, cierra al elegir, cierra con `Escape` y cierra al tocar afuera; los tres ítems abren lo
  que corresponde; el error real del backend llega hasta el cartel del modal; los dos temas y
  375 px sin scroll horizontal.

⚠️ **Un defecto encontrado midiendo el DOM, no mirando la pantalla:** el panel del menú es más
ancho que su botón, así que anclado a `right-0` crece hacia la izquierda. A 375 px la fila
envuelve y el botón queda pegado al margen izquierdo — el panel terminaba en **x = -4 px**, con la
primera letra de "Bloquear horario" cortada. Se ancla a la izquierda en celular y a la derecha de
`sm:` para arriba, que es donde el que se sale es el otro extremo.

⚠️ **`MenuDesplegable` es el primer listener a nivel `document` del proyecto** (`pointerdown` +
`Escape`). Hasta ahora lo único que cerraba "al tocar afuera" era el burbujeo de `onClick` de
`Modal.tsx`, que sirve para un overlay a pantalla completa y no para un panel flotante. La
limpieza del `useEffect` no es opcional: sin ella queda un listener vivo por cada apertura.

Ojo con una expectativa que **no** se cumplió: la barra a 375 px pasó de **tres renglones a dos**,
no a uno. Los dos botones miden 167 y 174 px y no entran juntos en los 327 px útiles.

### WhatsApp por link `wa.me` (21/8/2026) — el camino que no depende de Meta ✅

Pedido de Franco, con el motivo dicho: **puede que la conexión con la Cloud API no se pueda
hacer**, así que el aviso lo manda el cliente desde su propio WhatsApp con el texto ya escrito.
Es un link, no una integración: no toca el backend, no depende del token, y el día que la API
ande queda como respaldo para el envío que falle.

- ⚠️ **Los mensajes van por `api.whatsapp.com/send`, NO por `wa.me`, y eso no es capricho:
  `wa.me` rompe todo carácter que no entre en latin-1.** Su redirección decodifica el `text`
  como latin-1 y lo vuelve a encodear, así que **cada emoji sale convertido en `%EF%BF%BD`** —el
  rombito con el signo de pregunta— y es eso lo que recibe Ariel. Medido, no supuesto: mandando
  `A 👇 B é C` por `wa.me` llega `A � B é C`; la `é` sobrevive porque **sí** es latin-1, el emoji
  no. Y no alcanza con elegir un emoji "más chico": `⬇️` y `☝`, que son de 3 bytes y no de 4,
  también se rompen. Por la URL directa el `%F0%9F%91%87` llega entero. `WHATSAPP_URL` sigue
  siendo `wa.me` para los links **sin texto** (la landing, el botón de contacto), donde no hay
  nada que romper.
  - 🚧 **Falta una comprobación en un celular de verdad**: la página de respaldo de
    `api.whatsapp.com` **dibuja** el emoji mal en su vista previa aunque la URL lo lleve bien, así
    que su render no sirve de prueba. Lo que importa es lo que recibe la app.
- ⚠️ **`turnos.clienteNombre` pasó a salir por el DTO público** (`turnoADto`). Los cuatro
  mensajes empiezan con "soy ___" y la pantalla de gestión era el único lugar donde ese nombre no
  se había tipeado en la sesión: sin esto la cancelación y la reprogramación salían sin firmar.
  No abre un dato nuevo —el que tiene el link ya ve el turno entero y el nombre es el suyo—, al
  revés que el teléfono y el mail, que siguen siendo solo de admin. Es una **enmienda** a la nota
  de más arriba que decía que agregarlo no compensaba: compensa cuando el mensaje lo firma.
- ⚠️ **El de cancelación NO lleva el link** y termina en "Lo lamento.". Un turno cancelado no se
  gestiona: mandarle el link sería invitarlo a una pantalla donde no hay nada para hacer. Es la
  misma razón por la que el mail de cancelación no lleva el `.ics`.
- **`frontend/src/utils/mensajesWhatsapp.ts`** (nuevo) — los mensajes en un solo lugar, con
  el mismo criterio que `Docs/plantillas-whatsapp.md` del lado del backend: el texto no se
  escribe en el JSX. Es su espejo — allá los mensajes que el negocio le manda al cliente, acá
  los que el cliente le manda al negocio. `whatsappCon()` vive en `contacto.ts`, donde ya estaba
  el número.
- ⚠️ **El link de gestión viaja adentro del mensaje** (pedido de Franco). No es un secreto frente
  a Ariel: ve todos los turnos desde el panel. Y tiene un efecto lateral bueno — mandar el
  mensaje es también la forma de que al cliente le quede el link guardado en su propio chat,
  que es justo lo que hacía la pantalla de confirmación que se apagó.
- ⚠️ **El nombre del cliente NO está en la pantalla de gestión.** El DTO público (`Turno`) no
  trae `clienteNombre` y no se le agregó: publicar un dato personal de más por una línea de
  cortesía no compensa, y servicio + fecha + hora + link identifican el turno igual. Por eso
  `DatosDelTurno.nombre` es opcional — en `ReservarPage` sí va (lo tiene el formulario).
- ⚠️ **`encodeURIComponent` no es un detalle**: los mensajes llevan tildes, el `·` de los
  separadores, saltos de línea y una URL con `/`. Sin codificar el texto llega cortado en el
  primer `&`. Verificado con el ida y vuelta `encode`/`decode` en el navegador.
- ⚠️ **La redirección va con `location.href`, nunca con `window.open`.** Corre dentro del
  `onSuccess` de la mutación, o sea fuera del gesto del usuario, y ahí Safari bloquea la pestaña
  nueva. En el celular esto abre la app de WhatsApp y deja el navegador atrás con la página
  intacta. Hay un `redirigiendo` aparte de `isPending` porque entre que la mutación resuelve y
  el navegador se va hay un rato en el que el botón volvía a decir "Confirmar por WhatsApp",
  invitando a un segundo click que crearía un segundo turno.
- ⚠️ **El turno queda reservado en el click, no en el mensaje.** El botón dice "Confirmar por
  WhatsApp" pero lo que confirma es el `POST`; el mensaje es el aviso. Si el cliente no llega a
  mandarlo, el turno existe igual en la agenda. El texto de abajo del botón lo dice.
- ⚠️ **La pantalla "¡Listo, {nombre}!" está COMENTADA, no borrada** — `PasoConfirmacion` y
  `PedirMail`, más el estado `turnoCreado`, la rama del `paso === 'confirmacion'` y tres
  imports. **Son cuatro cosas que van juntas**, y la nota dentro de `ReservarPage` las enumera.
  Mismo criterio que la sección Beneficios de la landing: es la pantalla que corresponde el día
  que los avisos salgan solos, y rehacerla sería trabajo tirado. Va comentada línea por línea y
  no con `/* */` porque el bloque tiene comentarios JSX adentro.
- ⚠️ **En la pantalla de gestión hay UN botón por acción, no dos** (corregido el mismo día).
  "Cancelar turno" y "Reprogramar" hacen **las dos cosas de una**: primero el `PATCH` que
  cambia el turno de verdad —libera el horario, lo saca de la agenda— y recién con eso hecho
  abren WhatsApp para que el cliente avise. **Nunca al revés**: si abriera el chat primero, el
  que no llega a mandar el mensaje deja el rato bloqueado sin que nadie se entere. La primera
  versión ponía los botones de WhatsApp al lado de los online y eso era exactamente ese agujero.
- ⚠️ **`MotivoWhatsapp` distingue avisar de pedir, porque el tiempo verbal importa.**
  `confirmado`/`cancelado`/`reprogramado` avisan algo que el sistema **ya hizo** ("Cancelé mi
  turno por la web"); `pedirReprogramar` **pide**, y sale en la pantalla de elegir nuevo horario
  cuando ninguno de los que quedan le sirve. Mezclarlos sería el peor error posible acá: decirle
  "necesito cancelar" por un turno ya cancelado lo manda a cancelar algo que no existe, y
  decirle "cancelé" por uno que sigue en pie le deja el rato bloqueado creyendo que se liberó.
- ⚠️ **Pasados los 60 minutos NO hay botón de cancelar ni de reprogramar — tampoco por
  WhatsApp** (pedido de Franco, 21/8/2026). La primera versión ponía ahí dos botones
  "Cancelar/Reprogramar por WhatsApp", y estaban ofreciendo una acción que no ocurre: el que los
  tocaba mandaba un mensaje, se quedaba tranquilo, y el turno seguía en pie hasta que Ariel lo
  leyera. **En el resto de la pantalla un botón con esa palabra cancela de verdad**; que ahí uno
  igual no lo hiciera era la misma palabra queriendo decir dos cosas. Queda el cartel ámbar y
  los botones de `ContactoAriel` (WhatsApp + Llamar), que es HU-03 y es lo que de verdad puede
  pasar. Por eso tampoco existe un motivo `pedirCancelar`: no hay pantalla que lo use.
- ⚠️ **Al reprogramar, el mensaje lleva el link del turno NUEVO.** Reprogramar no mueve el
  turno: crea uno nuevo enlazado al viejo, así que el id cambia. Mandar el viejo le daría a
  Ariel un turno en estado `reprogramado`.
- ⚠️ **El botón genérico "WhatsApp" de `ContactoAriel` abre el chat EN BLANCO, y tiene que
  seguir así.** Precargaba "mi turno quedó confirmado" y estaba mal por dos motivos. Uno: el
  bloque dice "¿Necesitás hablar con Ariel?", o sea que el que lo toca quiere decir algo suyo, no
  volver a anunciar un turno del que Ariel ya se enteró. Dos, y es el que lo delató (Franco,
  21/8/2026, *"reprogramar manda el mensaje de confirmación"*): **esa pantalla es justo donde cae
  el que acaba de reprogramar**, así que el botón le ofrecía mandar una confirmación dentro del
  flujo de reprogramación, contando el turno como si fuera nuevo y sin decir que se movió. El
  botón de reprogramar en sí siempre estuvo bien — verificado dos veces, manda "reprogramé mi
  turno en la web". La confirmación se manda sola en el único momento que corresponde: al salir
  del formulario de reserva.
- Al reprogramar, el `navigate` al turno nuevo va con **`replace: true`**: el link viejo apunta a
  un turno que quedó `reprogramado` y ya no se gestiona, así que dejarlo en el historial es que
  el botón "atrás" lo traiga de vuelta — el mismo tropiezo que la v3 ya arregló en `LoginPage`.

**Probado de punta a punta sobre la branch descartable `prueba-wame-links`**, no contra la
agenda de Ariel. Los tres flujos completos, en el navegador y contra la base:

- **Reservar** → turno `reservado` en la base y `api.whatsapp.com` con el mensaje cargado. Y
  algo que solo se ve haciéndolo: **WhatsApp resolvió el número a "La Peluquería"**, o sea que
  el `+549…` de `contacto.ts` apunta de verdad a la cuenta de Ariel.
- **Reprogramar** → el viejo quedó `reprogramado`, el nuevo `reservado` con su `turno_origen_id`,
  y el mensaje llevaba el link del **nuevo**.
- **Cancelar** → quedó `cancelado`, y el mensaje sin link, terminando en "Lo lamento.".
- La segunda corrida (con los textos definitivos) fue sobre `prueba-wame-textos`, con
  `push_suscripciones` **vaciada en la branch** para no volver a hacerles sonar el celular.
- La rama de los 60 minutos vencidos, sobre un turno real ya pasado: los dos botones
  deshabilitados, **cero links de WhatsApp que prometan cancelar o reprogramar**, y el chat de
  `ContactoAriel` en blanco. Verificado leyendo el DOM, no solo mirando la pantalla.
- Producción quedó **intacta y verificada**: 18 turnos y 9 clientes antes y después, cero turnos
  de prueba. Cero errores de consola, 375 px sin scroll horizontal.

⚠️ **Un efecto lateral que conviene saber antes de volver a probar así:** la branch se copia con
la tabla `push_suscripciones` adentro, así que **los avisos push del turno de prueba salieron a
los celulares reales** (`web.push.apple.com → 201`). Los turnos son descartables; las
notificaciones que ya llegaron, no. Lo mismo con WhatsApp: el backend local tiene
`WHATSAPP_TOKEN` cargado e intentó los tres avisos por la Cloud API, que rebotaron con
`(#131030) Recipient phone number not in allowed list` — el número de prueba de Meta.

### Etapa 5 — cobro online (sin empezar, sin pedir)

Seña por Mercado Pago al reservar. **No lo pidió Ariel**; queda anotado porque es la continuación natural. Traería cuenta de MP, webhooks de pago, reembolsos al cancelar y qué hacer con un pago pendiente — o sea, trámites externos como los de WhatsApp. También quedaron afuera los pagos parciales, el historial de precios y la facturación.

## Forma de trabajo

Avanzar etapa por etapa. Cada etapa se valida con Franco antes de pasar a la siguiente. No generar grandes cantidades de código de una — proponer el plan primero.

Además, para este proyecto:

- **Verificar de verdad, no solo compilar.** Los dos servidores locales y el navegador están a mano: medir los colores calculados, probar los endpoints con datos reales, mirar la pantalla. Varias cosas de la v3 se encontraron así y no con `tsc`.
- **Ritual de migraciones:** siempre `--create-only`, leer el SQL generado y **borrar cualquier línea que toque `turnos_no_solapamiento`** (el `EXCLUDE USING gist` está escrito a mano en la migración inicial y no vive en `schema.prisma`, así que Prisma puede emitir un `DROP CONSTRAINT` al diffear). Después `migrate deploy` y confirmar contra `pg_constraint` que sigue existiendo. ⚠️ **Ahora ese ritual corre contra producción**, porque no hay otra base — ver la sección de arriba. El paso de leer el SQL antes de aplicar dejó de ser una buena práctica y pasó a ser lo único que separa un diff mal generado de la agenda real de Ariel.
- Si se toca `schema.prisma`, correr `npx prisma generate` — si no, `tsc` falla con tipos viejos. ⚠️ El cliente se genera en `backend/generated/` (gitignoreado) y **puede no estar** en un clon nuevo o después de limpiar: el síntoma es `Cannot find module '.prisma/client/default'` o un `PrismaClient` que pide un driver adapter. Se arregla con `npx prisma generate`, no tocando el código.
- **Para un script suelto contra la base, reusar `src/config/prisma.ts`.** El proyecto usa el driver adapter de Prisma 7 (`PrismaPg`), así que un `new PrismaClient()` pelado tira `instantiated without any options`. Y el script tiene que empezar con `import 'dotenv/config'` y envolver todo en una `async function main()`: `tsx` compila a CJS y rechaza el `await` de nivel superior.
- **El repo es público.** Los secretos van solo en `backend/.env` (gitignoreado), nunca en `.env.example`. Revisar el diff staged antes de commitear. Las variables `VITE_*` se compilan dentro del bundle público: nunca pueden ser secretas.
