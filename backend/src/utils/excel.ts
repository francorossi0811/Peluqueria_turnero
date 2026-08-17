// HU-30 — El `.xlsx` de la agenda.
//
// Único módulo que importa la librería de Excel, para que el resto del backend no dependa
// de ella: si algún día se cambia `write-excel-file` por otra cosa, el service que decide
// qué exportar no se entera.
//
// Se eligió `write-excel-file` y **no** `exceljs`, que era la opción obvia: exceljs arrastra
// 90 paquetes y un aviso de seguridad abierto en su `uuid` transitivo, y este repo es
// público. `write-excel-file` tiene **una sola** dependencia (`fflate`, para el zip) y
// alcanza de sobra para lo que hace falta acá: hojas múltiples, negritas, colores de relleno,
// ancho de columna y formato de moneda.

// El `with { 'resolution-mode': 'import' }` es la contracara del `import()` dinámico de
// abajo: le dice a `tsc` que lea los tipos del paquete como ESM, que es lo que es.
import type { Row } from 'write-excel-file/node' with { 'resolution-mode': 'import' }
import type { DiaExportado, SemanaExportada } from '../services/exportacion.service'
import type { ResumenDeCobros } from '../services/cobros.service'
import type { TurnoConCliente } from '../services/clientes.service'
import { formatearHora } from '../utils/fechaHora'
import type {
  EstadoTurno,
  MedioPago,
  OrigenTurno,
} from '../../generated/prisma/client.ts'

/** Cómo se escribe la plata en la planilla.
 *
 * ⚠️ Es un **formato de número de Excel**, no un texto ya armado: la celda tiene que
 * guardar el número para que Ariel pueda sumarla, filtrarla o graficarla. Poner
 * `"$ 12.500"` como cadena daría una planilla que se ve igual y no sirve para nada. Los
 * montos son pesos enteros en toda la aplicación, así que no hay decimales que perder. */
const FORMATO_PESOS = '"$" #,##0'

/**
 * La paleta, copiada de los tokens del panel (`frontend/src/index.css`).
 *
 * ⚠️ **Son los valores del tema claro, y eso no es un descuido.** El panel tiene modo oscuro
 * y una planilla de Excel no: se abre siempre sobre fondo blanco, con texto oscuro por
 * defecto. Usar los valores del tema oscuro daría un archivo ilegible en la única
 * superficie donde se va a ver.
 *
 * Están escritos a mano y no importados porque el backend no lee el CSS del frontend. Si
 * alguna vez se retocan los tokens de estado, hay que acordarse de este archivo — es el
 * precio de que la planilla se parezca a la pantalla.
 */
const PALETA = {
  /** `--color-tinta`: la banda de encabezados. */
  tinta: '#201f1d',
  tintaTenue: '#817d76',
  /** `--color-superficie-2`: la banda que abre cada día. */
  arena: '#f0e6d2',
  /** `--color-miel-suave`: el renglón del total. */
  mielSuave: '#fff3e4',
  bordeSuave: '#e6ded3',
  blanco: '#ffffff',
} as const

/**
 * El color de cada estado, y **el color dice el estado y nada más**.
 *
 * Es la regla de HU-23, la misma que gobierna la grilla semanal del panel, y los valores son
 * los mismos tokens: verde fuerte el realizado, rojo el ausente, mostaza el pendiente. Que
 * la planilla y la pantalla se pinten igual es lo que hace que Ariel no tenga que aprender
 * dos códigos de color para los mismos datos.
 *
 * ⚠️ **No se pinta por medio de pago**, que era la otra opción obvia. Ese es exactamente el
 * defecto de la planilla de Drive que este proyecto ya decidió no heredar: allá un color
 * describía al cliente y otro describía un pago, mezclados en la misma celda, y no había
 * forma de saber cuál de los dos ejes estabas mirando. El medio de pago tiene su propia
 * columna, con su nombre escrito.
 *
 * `reprogramado` no llega nunca acá —`turnosParaExportar` lo filtra— pero está listado
 * igual: el `Record` completo es lo que hace que agregar un estado nuevo al enum rompa la
 * compilación en vez de pintarlo de blanco en silencio.
 */
const COLOR_ESTADO: Record<EstadoTurno, { fondo: string; texto: string }> = {
  realizado: { fondo: '#14682c', texto: PALETA.blanco }, // --color-realizado
  ausente: { fondo: '#c62828', texto: PALETA.blanco }, // --color-ausente-fuerte
  reservado: { fondo: '#f5d020', texto: '#16130f' }, // --color-turno-futuro
  // El cancelado no tiene color en la grilla porque ni siquiera se dibuja ahí. Acá sí
  // aparece (HU-30), y va en gris apagado: es el único que quiere decir "esto no pasó".
  cancelado: { fondo: PALETA.bordeSuave, texto: PALETA.tintaTenue },
  reprogramado: { fondo: PALETA.bordeSuave, texto: PALETA.tintaTenue },
}

/** Siete columnas y no ocho: **el día ya no es una columna**, es la banda que abre cada
 * bloque. Repetir "martes 11 de agosto" en las once filas de ese martes es justo lo que la
 * agrupación viene a sacar. */
const ANCHO_COLUMNAS = [
  { width: 26 }, // Hora — ancha porque es la que sostiene el título de cada día
  { width: 24 }, // Cliente
  { width: 20 }, // Servicio
  { width: 12 }, // Estado
  { width: 12 }, // Origen
  { width: 15 }, // Medio de pago
  { width: 12 }, // Monto
]

const ENCABEZADOS = [
  'Hora',
  'Cliente',
  'Servicio',
  'Estado',
  'Origen',
  'Medio de pago',
  'Monto',
]

/** Cuántas columnas tiene la tabla. Lo usan las bandas, que se pintan de punta a punta. */
const COLUMNAS = ENCABEZADOS.length

/** Los cuatro medios, **en un orden fijo**.
 *
 * ⚠️ Se listan siempre los cuatro aunque alguno haya quedado en cero, y esto es a
 * propósito: `porMedio` viene ordenado por importe y trae solo los que tuvieron
 * movimiento, así que si se copiara tal cual, cada hoja tendría una tabla con distinta
 * cantidad de filas y en distinto orden. Con la forma fija, las semanas se pueden comparar
 * de un vistazo o pegar una debajo de otra. */
const MEDIOS: MedioPago[] = [
  'efectivo',
  'transferencia',
  'mercado_pago',
  'tarjeta',
]

/** Los mismos textos que `ETIQUETA_MEDIO_PAGO` del panel (`frontend/src/utils/dinero.ts`):
 * la planilla y la pantalla tienen que llamar igual a la misma cosa. */
const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
}

const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  reservado: 'Reservado',
  cancelado: 'Cancelado',
  reprogramado: 'Reprogramado',
  realizado: 'Realizado',
  ausente: 'Ausente',
}

const ETIQUETA_ORIGEN: Record<OrigenTurno, string> = {
  online: 'Web',
  presencial: 'Presencial',
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
}

/** El nombre con el que Ariel reconoce a la persona.
 *
 * El **apodo manda** sobre el nombre con el que reservó el cliente (HU-25), igual que en la
 * grilla, en el detalle del turno y en el listado de clientes. Una planilla que le diga
 * "Juan Pérez" a quien él anotó como "el Flaco" es una planilla que hay que traducir. */
function nombreParaMostrar(turno: TurnoConCliente): string {
  return turno.cliente?.apodo ?? turno.clienteNombre
}

/** Una fila de la planilla. La librería la llama `Row`; se renombra para que el resto del
 * archivo se lea en el mismo idioma que el proyecto. */
type Fila = Row

const VACIA: Fila = []

function filaDeTitulo(texto: string): Fila {
  return [{ value: texto, fontWeight: 'bold', fontSize: 14 }]
}

/** La banda oscura con los nombres de las columnas. */
function filaDeEncabezados(): Fila {
  return ENCABEZADOS.map((texto) => ({
    value: texto,
    fontWeight: 'bold' as const,
    backgroundColor: PALETA.tinta,
    textColor: PALETA.blanco,
  }))
}

/**
 * La banda que abre el bloque de un día: el día a la izquierda y **lo que se facturó ese
 * día** alineado en la columna Monto.
 *
 * El total va en esa columna y no pegado al nombre a propósito: queda en la misma vertical
 * que los montos de abajo, así se lee como el subtotal de la columna y no como un dato
 * suelto del encabezado.
 *
 * ⚠️ Se pintan las siete celdas en vez de fusionarlas. Una celda fusionada de punta a punta
 * se vería igual, pero no dejaría poner el subtotal a la derecha — y encima Excel se pone
 * incómodo para ordenar o filtrar una tabla con celdas fusionadas adentro.
 */
function bandaDelDia(dia: DiaExportado): Fila {
  const relleno = {
    backgroundColor: PALETA.arena,
    textColor: PALETA.tinta,
    fontWeight: 'bold' as const,
  }

  const fila: Fila = [
    { value: dia.titulo, type: String, ...relleno },
    {
      value: `${dia.turnos.length} turno${dia.turnos.length === 1 ? '' : 's'}`,
      type: String,
      ...relleno,
      textColor: PALETA.tintaTenue,
      fontWeight: undefined,
    },
  ]

  // Las del medio van vacías pero con el mismo relleno: sin esto la banda se cortaría a la
  // mitad y dejaría de leerse como una sola franja.
  while (fila.length < COLUMNAS - 1) fila.push({ ...relleno })

  fila.push({
    value: dia.resumen.total,
    type: Number,
    format: FORMATO_PESOS,
    ...relleno,
  })

  return fila
}

function filaDeTurno(turno: TurnoConCliente): Fila {
  const color = COLOR_ESTADO[turno.estado]

  return [
    { value: formatearHora(turno.horaInicio), type: String },
    { value: nombreParaMostrar(turno), type: String },
    { value: turno.servicioNombreSnapshot, type: String },
    // La única celda coloreada de la fila. Pintar el renglón entero taparía los montos y
    // volvería ilegible lo que más se mira; así el color funciona como la insignia de
    // estado que el panel ya dibuja en la vista Día.
    {
      value: ETIQUETA_ESTADO[turno.estado],
      type: String,
      backgroundColor: color.fondo,
      textColor: color.texto,
      align: 'center',
    },
    { value: ETIQUETA_ORIGEN[turno.origen], type: String },
    {
      value: turno.medioPago ? ETIQUETA_MEDIO[turno.medioPago] : undefined,
      type: String,
    },
    // `undefined` y no `0`: un turno sin cobro registrado deja la celda **vacía**. Un cero
    // diría "se cobró nada", que es otra cosa, y además ensuciaría cualquier promedio que
    // Ariel arme sobre la columna. Es la misma distinción que sostiene
    // `formatearPesosOpcional` en el panel.
    {
      value: turno.montoCobrado ?? undefined,
      type: Number,
      format: FORMATO_PESOS,
    },
  ]
}

/**
 * El bloque de plata que va al pie de cada hoja y dentro del resumen.
 *
 * ⚠️ **Los realizados sin cobrar se cuentan aparte y no se suman al total.** Es la misma
 * regla que hace confiable a la pantalla de Cobros (HU-27): un total al que le faltan
 * turnos sin decirlo no cierra contra la caja y no hay forma de saber por qué. La fila
 * aparece siempre, incluso en cero, para que su ausencia nunca se pueda confundir con
 * "estaba todo cobrado".
 */
function bloqueDeFacturacion(titulo: string, resumen: ResumenDeCobros): Fila[] {
  const porMedio = new Map(
    resumen.porMedio.map((fila) => [fila.medioPago, fila]),
  )
  const destacado = {
    backgroundColor: PALETA.mielSuave,
    fontWeight: 'bold' as const,
  }

  return [
    VACIA,
    filaDeTitulo(titulo),
    [
      { value: 'Total cobrado', type: String, ...destacado },
      { value: resumen.total, type: Number, format: FORMATO_PESOS, ...destacado },
      { ...destacado },
    ],
    ...MEDIOS.map((medio): Fila => {
      const fila = porMedio.get(medio)
      return [
        { value: ETIQUETA_MEDIO[medio], type: String },
        { value: fila?.total ?? 0, type: Number, format: FORMATO_PESOS },
        {
          value: `${fila?.turnos ?? 0} turno${(fila?.turnos ?? 0) === 1 ? '' : 's'}`,
          type: String,
          textColor: PALETA.tintaTenue,
        },
      ]
    }),
    [
      { value: 'Realizados sin cobrar', type: String },
      { value: resumen.sinRegistrar, type: Number },
      {
        value: 'no están sumados en el total',
        type: String,
        textColor: PALETA.tintaTenue,
      },
    ],
  ]
}

/** Una hoja de semana: título, encabezados, y un bloque por cada día con turnos. */
function hojaDeSemana(semana: SemanaExportada) {
  return {
    sheet: semana.nombreHoja,
    columns: ANCHO_COLUMNAS,
    // La fila de encabezados queda fija al hacer scroll: con dos meses de turnos, sin esto
    // hay que subir hasta arriba para acordarse de qué columna es cuál.
    stickyRowsCount: 3,
    data: [
      filaDeTitulo(semana.titulo),
      VACIA,
      filaDeEncabezados(),
      ...semana.dias.flatMap((dia) => [
        bandaDelDia(dia),
        ...dia.turnos.map(filaDeTurno),
      ]),
      ...bloqueDeFacturacion('Facturado esta semana', semana.resumen),
    ],
  }
}

/**
 * La última hoja: el período entero de un vistazo, más una fila por semana para ver la
 * tendencia sin tener que abrir pestaña por pestaña.
 */
function hojaDeResumen(
  semanas: SemanaExportada[],
  total: ResumenDeCobros,
  rango: { desde: string; hasta: string },
) {
  const encabezado = {
    fontWeight: 'bold' as const,
    backgroundColor: PALETA.tinta,
    textColor: PALETA.blanco,
  }

  return {
    sheet: 'Resumen',
    columns: [{ width: 46 }, { width: 16 }, { width: 30 }],
    data: [
      filaDeTitulo('Resumen del período'),
      [
        { value: 'Desde', type: String },
        { value: rango.desde, type: String },
      ],
      [
        { value: 'Hasta', type: String },
        { value: rango.hasta, type: String },
      ],
      [
        { value: 'Turnos exportados', type: String },
        {
          value: semanas.reduce((acc, semana) => acc + semana.turnos.length, 0),
          type: Number,
        },
      ],
      ...bloqueDeFacturacion('Facturación del período', total),
      VACIA,
      filaDeTitulo('Semana por semana'),
      [
        { value: 'Semana', ...encabezado },
        { value: 'Turnos', ...encabezado },
        { value: 'Facturado', ...encabezado },
      ],
      ...semanas.map((semana): Fila => [
        { value: semana.titulo, type: String },
        { value: semana.turnos.length, type: Number },
        { value: semana.resumen.total, type: Number, format: FORMATO_PESOS },
      ]),
    ],
  }
}

/**
 * Arma el libro: una hoja por semana y el **resumen al final**.
 *
 * Va última y no primera porque la planilla se lee hacia adelante —Ariel busca una semana
 * puntual— y porque es la que cierra la cuenta: el total del período tiene que quedar
 * después de lo que lo compone, no antes.
 */
export async function generarExcelDeAgenda(
  semanas: SemanaExportada[],
  total: ResumenDeCobros,
  rango: { desde: string; hasta: string },
): Promise<Buffer> {
  // ⚠️ `import()` dinámico y no un `import` arriba de todo: `write-excel-file` es un
  // paquete ESM (publica también un build CJS, pero un solo juego de tipos, el del ESM), y
  // este backend compila como CommonJS. Con el `import` estático, `tsc` corta con TS1479
  // aunque en ejecución funcione. Traerlo acá adentro lo resuelve sin tocar el módulo del
  // proyecto entero, y de paso la librería recién se carga la primera vez que Ariel
  // exporta — no en cada arranque de Render, que despierta muchas veces por día.
  const { default: writeXlsxFile } = await import('write-excel-file/node')

  return writeXlsxFile([
    ...semanas.map(hojaDeSemana),
    hojaDeResumen(semanas, total, rango),
  ]).toBuffer()
}
