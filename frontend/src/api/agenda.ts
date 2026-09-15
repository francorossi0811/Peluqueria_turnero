import { apiClient } from './client'
import type {
  DatosCobro,
  EditarTurno,
  NuevoGrupoManual,
  NuevoTurnoManual,
  TurnoAdmin,
} from '../types/api'

export interface Agenda {
  turnos: TurnoAdmin[]
  /** HU-17 — Turnos sin ver que caen después del rango que está en pantalla. */
  nuevosMasAdelante: number
  /** Ids de esos turnos, para poder marcarlos como vistos sin navegar hasta esa semana. */
  idsMasAdelante: string[]
}

export async function obtenerAgenda(
  desde: string,
  hasta: string,
): Promise<Agenda> {
  const { data } = await apiClient.get<Agenda>('/admin/turnos', {
    params: { desde, hasta },
  })
  const idsMasAdelante = data.idsMasAdelante ?? []
  return {
    turnos: data.turnos,
    nuevosMasAdelante: data.nuevosMasAdelante ?? idsMasAdelante.length,
    idsMasAdelante,
  }
}

export async function cargarTurnoManual(
  datos: NuevoTurnoManual,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.post<TurnoAdmin>('/admin/turnos', datos)
  return data
}

/** HU-31 — El bloque de turnos seguidos, del lado de Ariel. Ruta aparte de la pública: es
 * la ruta la que dice quién crea el turno. */
export async function cargarTurnosEnGrupoManual(
  datos: NuevoGrupoManual,
): Promise<TurnoAdmin[]> {
  const { data } = await apiClient.post<TurnoAdmin[]>(
    '/admin/turnos/grupo',
    datos,
  )
  return data
}

export async function editarTurno(
  id: string,
  datos: EditarTurno,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}`,
    datos,
  )
  return data
}

export async function cancelarTurnoAdmin(id: string): Promise<TurnoAdmin> {
  const { data } = await apiClient.post<TurnoAdmin>(
    `/admin/turnos/${id}/cancelar`,
  )
  return data
}

/** HU-12 + HU-27 — Marcar Realizado o Ausente, y de paso cómo pagó.
 *
 * El cobro viaja en la misma llamada porque para Ariel es un solo gesto: toca
 * "Realizado", elige el medio y listo. Es opcional — se puede marcar sin registrarlo y
 * completarlo después con `registrarCobroTurno`. */
export async function marcarEstadoTurno(
  id: string,
  // `reservado` es solo para sacarle el Ausente a un turno (13/9/2026).
  estado: 'realizado' | 'ausente' | 'reservado',
  cobro?: DatosCobro,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}/estado`,
    { estado, ...(cobro && { cobro }) },
  )
  return data
}

/** HU-34 — Le pone (o le saca, con `null`) el color a un turno pendiente.
 *
 * Endpoint propio y no dentro del PATCH de turno, con el mismo criterio que el nombre y el
 * teléfono: aquel mueve el turno en el tiempo y revalida disponibilidad; esto solo cambia
 * cómo se ve y no le puede pisar el horario a nadie. */
export async function cambiarColorTurno(
  id: string,
  color: string | null,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}/color`,
    { color },
  )
  return data
}

/** HU-34 — Los últimos colores que Ariel usó, para elegir de a un toque.
 *
 * Salen de los turnos y no de una preferencia guardada por dispositivo: así el celular y
 * la tablet del mostrador muestran la misma lista, que es el mismo motivo por el que
 * `vistoPorAdmin` vive en la base. */
export async function obtenerColoresRecientes(): Promise<string[]> {
  const { data } = await apiClient.get<{ colores: string[] }>(
    '/admin/turnos/colores-recientes',
  )
  return data.colores
}

/** HU-27 — Le carga o le corrige el cobro a un turno ya realizado.
 *
 * Es la contracara de que el cobro sea opcional: sin esto, un turno marcado a las
 * apuradas quedaría fuera de los totales para siempre. Mismo rol que
 * `cargarTelefonoTurno` para las fichas. */
export async function registrarCobroTurno(
  id: string,
  cobro: DatosCobro,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}/cobro`,
    cobro,
  )
  return data
}

/** Corrige el nombre de un turno ya cargado (4/9/2026).
 *
 * Es la contracara de que el bloque del panel pida **un solo nombre**: sin esto, cargar
 * cuatro turnos seguidos dejaría cuatro veces el mismo nombre y ninguna forma de
 * arreglarlo. No toca la ficha del cliente — la identidad es el teléfono, y para renombrar
 * a la persona está el apodo. */
export async function cambiarNombreDeTurno(
  id: string,
  clienteNombre: string,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}/nombre`,
    { clienteNombre },
  )
  return data
}

/** HU-25 — Le carga el teléfono a un turno que se guardó sin él (HU-08).
 *
 * Al guardarlo, el backend lo engancha con su ficha: es lo que hace que los turnos que
 * Ariel carga con la persona enfrente terminen igual en la lista de clientes. */
export async function cargarTelefonoTurno(
  id: string,
  clienteTelefono: string,
): Promise<TurnoAdmin> {
  const { data } = await apiClient.patch<TurnoAdmin>(
    `/admin/turnos/${id}/telefono`,
    { clienteTelefono },
  )
  return data
}

/** HU-17 — Saca el resaltado de "nuevo" a los turnos que Ariel ya miró. */
export async function marcarTurnosVistos(ids: string[]): Promise<number> {
  const { data } = await apiClient.post<{ marcados: number }>(
    '/admin/turnos/marcar-vistos',
    { ids },
  )
  return data.marcados
}

export async function buscarTurnos(params: {
  nombre?: string
  telefono?: string
}): Promise<TurnoAdmin[]> {
  const { data } = await apiClient.get<{ turnos: TurnoAdmin[] }>(
    '/admin/turnos/buscar',
    { params },
  )
  return data.turnos
}
