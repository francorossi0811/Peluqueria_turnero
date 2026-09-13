import { Request, Response } from 'express'
import { z } from 'zod'
import {
  guardarNotaDelDia,
  listarNotasDelDia,
} from '../services/notasDelDia.service'
import {
  esquemaDeFecha,
  FIN_ANTES_QUE_INICIO,
  periodoDemasiadoLargo,
} from '../utils/esquemasFecha'

/** El mismo tope que la columna (`VarChar(200)`). Se valida acá también para que el que se
 * pasa reciba un mensaje que se entiende, y no un error de Postgres sobre un largo. */
export const MAX_LARGO_NOTA = 200

/** La agenda pide de a una semana; 62 días deja margen sin abrir la puerta a traer años. */
const MAX_DIAS_RANGO = 62

const rangoSchema = z
  .object({
    desde: esquemaDeFecha('la fecha de inicio'),
    hasta: esquemaDeFecha('la fecha de fin'),
  })
  .refine((q) => q.hasta >= q.desde, { message: FIN_ANTES_QUE_INICIO })
  .refine(
    (q) =>
      (Date.parse(q.hasta) - Date.parse(q.desde)) / 86_400_000 <=
      MAX_DIAS_RANGO,
    { message: periodoDemasiadoLargo(MAX_DIAS_RANGO) },
  )

export const notaSchema = z.object({
  // `trim` antes del tope: los espacios del final no cuentan como nota, y un renglón con
  // solo espacios tiene que borrarse igual que uno vacío.
  texto: z
    .string({ error: 'Falta el texto de la nota.' })
    .trim()
    .max(
      MAX_LARGO_NOTA,
      `La nota es un renglón: hasta ${MAX_LARGO_NOTA} letras.`,
    ),
})

const fechaParamSchema = z.object({ fecha: esquemaDeFecha('la fecha') })

function responderInvalido(res: Response, mensaje: string) {
  res.status(400).json({ error: { codigo: 'PARAMETROS_INVALIDOS', mensaje } })
}

export async function getNotasDelDia(req: Request, res: Response) {
  const parsed = rangoSchema.safeParse(req.query)
  if (!parsed.success) {
    responderInvalido(res, parsed.error.issues[0]?.message ?? 'Rango inválido.')
    return
  }

  res.json({
    notas: await listarNotasDelDia(parsed.data.desde, parsed.data.hasta),
  })
}

/** Crea, cambia o borra (texto vacío) la nota de un día. Devuelve `nota: null` al borrar. */
export async function putNotaDelDia(req: Request, res: Response) {
  const fechaParsed = fechaParamSchema.safeParse(req.params)
  if (!fechaParsed.success) {
    responderInvalido(
      res,
      fechaParsed.error.issues[0]?.message ?? 'Fecha inválida.',
    )
    return
  }

  const bodyParsed = notaSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    responderInvalido(
      res,
      bodyParsed.error.issues[0]?.message ?? 'Nota inválida.',
    )
    return
  }

  res.json({
    nota: await guardarNotaDelDia(
      fechaParsed.data.fecha,
      bodyParsed.data.texto,
    ),
  })
}
