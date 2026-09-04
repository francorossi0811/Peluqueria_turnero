import { Router } from 'express'
import { getMe, patchPassword } from '../controllers/admin.controller'
import {
  getAgenda,
  getBuscarTurnos,
  patchCobroTurno,
  patchEstadoTurno,
  patchTelefonoTurno,
  patchTurno,
  postCancelarTurnoAdmin,
  postMarcarVistos,
  postTurnoManual,
  postTurnosEnGrupoManual,
} from '../controllers/turnos.controller'
import {
  getCliente,
  getClientes,
  patchCliente,
} from '../controllers/clientes.controller'
import { getCobros } from '../controllers/cobros.controller'
import { getExportacionAgenda } from '../controllers/exportacion.controller'
import { getDisponibilidadAdmin } from '../controllers/disponibilidad.controller'
import {
  deleteEtiqueta,
  getEtiquetas,
  patchEtiqueta,
  postEtiqueta,
} from '../controllers/etiquetas.controller'
import {
  deleteSuscripcion,
  getClavePublica,
  getDispositivos,
  postPrueba,
  postSuscripcion,
} from '../controllers/push.controller'
import {
  getServiciosAdmin,
  patchServicio,
  postServicio,
} from '../controllers/servicios.controller'
import {
  getHorarioLaboral,
  putHorarioLaboral,
} from '../controllers/horarioLaboral.controller'
import {
  getFeriados,
  patchFeriado,
  postSincronizarFeriados,
} from '../controllers/feriados.controller'
import {
  deleteBloqueo,
  getBloqueos,
  patchBloqueo,
  postBloqueo,
} from '../controllers/bloqueos.controller'
import {
  deleteAdministrador,
  getAdministradores,
  patchAdministrador,
  patchPasswordDeAdministrador,
  patchRolDeAdministrador,
  postAdministrador,
} from '../controllers/administradores.controller'
import { requireAuth, requireSuperAdmin } from '../middlewares/auth.middleware'
import {
  getEstadoCoexistence,
  postSincronizarCoexistence,
} from '../controllers/coexistence.controller'

export const adminRouter = Router()

adminRouter.get('/admin/me', requireAuth, getMe)
adminRouter.patch('/admin/password', requireAuth, patchPassword)

// HU-26 — Administración de cuentas: lo único que el rol `admin` no puede hacer. Todo lo
// demás de este archivo es "gestionar la peluquería" y Ariel lo puede entero.
adminRouter.get(
  '/admin/administradores',
  requireAuth,
  requireSuperAdmin,
  getAdministradores,
)
adminRouter.post(
  '/admin/administradores',
  requireAuth,
  requireSuperAdmin,
  postAdministrador,
)
adminRouter.patch(
  '/admin/administradores/:id',
  requireAuth,
  requireSuperAdmin,
  patchAdministrador,
)
adminRouter.patch(
  '/admin/administradores/:id/password',
  requireAuth,
  requireSuperAdmin,
  patchPasswordDeAdministrador,
)
adminRouter.patch(
  '/admin/administradores/:id/rol',
  requireAuth,
  requireSuperAdmin,
  patchRolDeAdministrador,
)
// A diferencia de servicios y turnos, acá sí hay DELETE: nada referencia a una cuenta de
// administrador, así que borrarla no deja registros incompletos. Ver el service.
adminRouter.delete(
  '/admin/administradores/:id',
  requireAuth,
  requireSuperAdmin,
  deleteAdministrador,
)
// HU-08 — La disponibilidad con las reglas de Ariel (sin la antelación de 30 min del
// cliente, y con `incluirPasado=true` los últimos días). Es lo que alimenta los dos
// modales de turnos del panel. Ruta propia y no un flag en la pública: ver el controller.
adminRouter.get('/admin/disponibilidad', requireAuth, getDisponibilidadAdmin)
adminRouter.get('/admin/turnos', requireAuth, getAgenda)
adminRouter.get('/admin/turnos/buscar', requireAuth, getBuscarTurnos)
adminRouter.post('/admin/turnos', requireAuth, postTurnoManual)
// HU-31 — El bloque de turnos seguidos, del lado de Ariel. Ruta aparte de la pública: es la
// ruta la que dice quién crea el turno, y de ahí cuelgan sus tres asimetrías (sin topes, sin
// antelación mínima, con los 7 días para atrás).
adminRouter.post('/admin/turnos/grupo', requireAuth, postTurnosEnGrupoManual)
adminRouter.patch('/admin/turnos/:id', requireAuth, patchTurno)
adminRouter.post(
  '/admin/turnos/:id/cancelar',
  requireAuth,
  postCancelarTurnoAdmin,
)
adminRouter.patch('/admin/turnos/:id/estado', requireAuth, patchEstadoTurno)
adminRouter.patch('/admin/turnos/:id/telefono', requireAuth, patchTelefonoTurno)
// HU-27 — Le carga o le corrige el cobro a un turno ya realizado. El cobro del momento
// va dentro del PATCH de estado de arriba, que es cuando Ariel lo hace de verdad.
adminRouter.patch('/admin/turnos/:id/cobro', requireAuth, patchCobroTurno)
adminRouter.post('/admin/turnos/marcar-vistos', requireAuth, postMarcarVistos)

// HU-27 — Lo cobrado en un período.
adminRouter.get('/admin/cobros', requireAuth, getCobros)

// HU-30 — La agenda del período como planilla. Devuelve un `.xlsx` y no JSON: es la
// segunda excepción de esta API, después del `.ics` de HU-19.
adminRouter.get('/admin/agenda/exportar', requireAuth, getExportacionAgenda)

// HU-25 — Fichas de clientes.
adminRouter.get('/admin/clientes', requireAuth, getClientes)
adminRouter.get('/admin/clientes/:id', requireAuth, getCliente)
adminRouter.patch('/admin/clientes/:id', requireAuth, patchCliente)

adminRouter.get('/admin/etiquetas', requireAuth, getEtiquetas)
adminRouter.post('/admin/etiquetas', requireAuth, postEtiqueta)
adminRouter.patch('/admin/etiquetas/:id', requireAuth, patchEtiqueta)
adminRouter.delete('/admin/etiquetas/:id', requireAuth, deleteEtiqueta)

// HU-18 — Notificaciones push al celular de Ariel.
adminRouter.get('/admin/push/clave-publica', requireAuth, getClavePublica)
adminRouter.post('/admin/push/suscripciones', requireAuth, postSuscripcion)
adminRouter.delete('/admin/push/suscripciones', requireAuth, deleteSuscripcion)
adminRouter.post('/admin/push/prueba', requireAuth, postPrueba)
adminRouter.get('/admin/push/dispositivos', requireAuth, getDispositivos)
// La renovación (POST /api/push/renovar) NO va acá: la llama el service worker sin JWT.
// Ver push.routes.ts.

adminRouter.get('/admin/servicios', requireAuth, getServiciosAdmin)
adminRouter.post('/admin/servicios', requireAuth, postServicio)
adminRouter.patch('/admin/servicios/:id', requireAuth, patchServicio)

adminRouter.get('/admin/horario-laboral', requireAuth, getHorarioLaboral)
adminRouter.put('/admin/horario-laboral', requireAuth, putHorarioLaboral)

adminRouter.get('/admin/feriados', requireAuth, getFeriados)
adminRouter.post(
  '/admin/feriados/sincronizar',
  requireAuth,
  postSincronizarFeriados,
)
adminRouter.patch('/admin/feriados/:id', requireAuth, patchFeriado)

adminRouter.get('/admin/bloqueos', requireAuth, getBloqueos)
adminRouter.post('/admin/bloqueos', requireAuth, postBloqueo)
adminRouter.patch('/admin/bloqueos/:id', requireAuth, patchBloqueo)
adminRouter.delete('/admin/bloqueos/:id', requireAuth, deleteBloqueo)

// HU-22 — Sincronización de Coexistence (SMB App Data API).
//
// ⚠️ `requireSuperAdmin` y no `requireAuth`: cada una de las dos llamadas se puede ejecutar
// UNA sola vez en la vida del número, y repetirla obliga a desvincular y rehacer el
// Embedded Signup entero. No es una acción de la operación diaria de la peluquería, así que
// no tiene por qué estar al alcance de la cuenta de Ariel.
// ⚠️ `requireAuth` va PRIMERO: `requireSuperAdmin` solo lee `req.admin.rol`, que lo pone
// aquel leyéndolo de la base. Sin él, `req.admin` queda `undefined` y la ruta responde 403
// siempre — falla cerrado, pero queda inalcanzable.
adminRouter.get(
  '/admin/coexistence',
  requireAuth,
  requireSuperAdmin,
  getEstadoCoexistence,
)
adminRouter.post(
  '/admin/coexistence/sincronizar',
  requireAuth,
  requireSuperAdmin,
  postSincronizarCoexistence,
)
