// HU-32 — La nota rápida de cada día, el renglón entre la mañana y la tarde de la agenda
// semanal.

import { apiClient } from './client'

export interface NotaDelDia {
  fecha: string // "YYYY-MM-DD"
  texto: string
}

/** El mismo tope que aplica el backend y la columna. Acá solo sirve para cortar el input:
 * quien manda es la API. */
export const MAX_LARGO_NOTA = 200

export async function obtenerNotasDelDia(
  desde: string,
  hasta: string,
): Promise<NotaDelDia[]> {
  const { data } = await apiClient.get<{ notas: NotaDelDia[] }>(
    '/admin/notas-del-dia',
    { params: { desde, hasta } },
  )
  return data.notas
}

/** Escribe la nota de un día. Un texto vacío la borra y devuelve `null`. */
export async function guardarNotaDelDia(
  fecha: string,
  texto: string,
): Promise<NotaDelDia | null> {
  const { data } = await apiClient.put<{ nota: NotaDelDia | null }>(
    `/admin/notas-del-dia/${fecha}`,
    { texto },
  )
  return data.nota
}
