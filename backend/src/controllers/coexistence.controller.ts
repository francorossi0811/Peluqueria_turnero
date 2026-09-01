import type { Request, Response } from 'express'
import {
  SincronizacionFallidaError,
  YaSincronizadoError,
  estadoDeSincronizacion,
  sincronizarCoexistence,
} from '../services/coexistence.service'

/** HU-22 — Dispara las dos sincronizaciones de Coexistence.
 *
 * ⚠️ Es `super_admin` y no `admin` (ver la ruta): la operación es irreversible, se puede
 * hacer una sola vez, y Ariel no tiene por qué poder gatillarla desde su panel.
 *
 * ⚠️ Y **no corre sola en ningún lado**. Meta da 24 horas desde el Embedded Signup y una
 * única oportunidad por llamada; automatizarlo sería dejar que un reintento de un job, un
 * redeploy o un doble click se lleven puesta esa oportunidad. */
export async function postSincronizarCoexistence(_req: Request, res: Response) {
  try {
    const resultados = await sincronizarCoexistence()
    res.json({ sincronizaciones: resultados })
  } catch (err) {
    if (err instanceof YaSincronizadoError) {
      res.status(409).json({
        error: { codigo: 'SINCRONIZACION_YA_EJECUTADA', mensaje: err.mensaje },
      })
      return
    }

    if (err instanceof SincronizacionFallidaError) {
      // 502 y no 500: el que falló fue Meta, no nosotros. Y el detalle va entero al cliente
      // a propósito — esto lo mira una persona que necesita saber exactamente qué contestó
      // Meta para poder llevárselo a soporte.
      res.status(502).json({
        error: {
          codigo: 'SINCRONIZACION_FALLIDA',
          mensaje:
            `${err.message}. La sincronización quedó marcada como fallida y el reintento ` +
            `está bloqueado: consultá con soporte de Meta antes de volver a intentar.`,
        },
      })
      return
    }

    throw err
  }
}

/** Lo ya registrado. Existe para poder mirar sin ejecutar: en una operación de un solo
 * disparo, "consultar" y "hacer" tienen que ser dos verbos distintos. */
export async function getEstadoCoexistence(_req: Request, res: Response) {
  res.json({ sincronizaciones: await estadoDeSincronizacion() })
}
