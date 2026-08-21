import { Request, Response } from 'express'
import { z } from 'zod'
import {
  esquemaDeFecha,
  FIN_ANTES_QUE_INICIO,
  periodoDemasiadoLargo,
} from '../utils/esquemasFecha'
import {
  agruparPorSemana,
  resumirRealizados,
  turnosParaExportar,
} from '../services/exportacion.service'
import { generarExcelDeAgenda } from '../utils/excel'
import { fechaDesdeIso } from '../utils/fechaHora'

// HU-30 — La agenda de un período como planilla de Excel.

/** El mismo techo que la sección Cobros (`cobros.controller.ts`) y no el de 31 días de la
 * agenda: allá se dibuja día por día en pantalla, acá el caso de uso *es* pedir varios
 * meses de una. Sigue siendo la red contra un `desde` mal tipeado, no una regla de
 * negocio. */
const MAX_DIAS_RANGO = 425

const rangoSchema = z
  .object({
    desde: esquemaDeFecha('la fecha de inicio'),
    hasta: esquemaDeFecha('la fecha de fin'),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: FIN_ANTES_QUE_INICIO,
    path: ['hasta'],
  })
  .refine(
    (q) =>
      (fechaDesdeIso(q.hasta).getTime() - fechaDesdeIso(q.desde).getTime()) /
        86_400_000 <=
      MAX_DIAS_RANGO,
    { message: periodoDemasiadoLargo(MAX_DIAS_RANGO) },
  )

const TIPO_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Devuelve un `.xlsx` con una hoja por semana y un resumen al final.
 *
 * Es la **segunda excepción** al "todo es JSON" de esta API; la primera es el `.ics` de
 * HU-19, y sigue su mismo molde de headers.
 *
 * ⚠️ El total del período **no se recalcula aparte**: sale de `resumirRealizados` sobre los
 * mismos turnos que alimentan las hojas. Sumar las semanas por un lado y el período por
 * otro son dos cuentas que pueden divergir, y justo van una al lado de la otra en el
 * archivo.
 */
export async function getExportacionAgenda(req: Request, res: Response) {
  const parsed = rangoSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        codigo: 'PARAMETROS_INVALIDOS',
        mensaje: parsed.error.issues[0]?.message ?? 'Parámetros inválidos.',
      },
    })
    return
  }

  const { desde, hasta } = parsed.data
  const turnos = await turnosParaExportar(
    fechaDesdeIso(desde),
    fechaDesdeIso(hasta),
  )

  const archivo = await generarExcelDeAgenda(
    agruparPorSemana(turnos),
    resumirRealizados(turnos),
    { desde, hasta },
  )

  res.setHeader('Content-Type', TIPO_XLSX)
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="agenda-${desde}-a-${hasta}.xlsx"`,
  )
  res.send(archivo)
}
