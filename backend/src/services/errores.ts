export class ServicioNoDisponibleError extends Error {}
export class HorarioNoDisponibleError extends Error {}
export class TurnoNoEncontradoError extends Error {}
export class TurnoNoModificableError extends Error {}
export class FueraDeVentanaError extends Error {}
export class TurnoYaTieneEmailError extends Error {}
export class CredencialesInvalidasError extends Error {}
export class AdministradorNoEncontradoError extends Error {}
export class PasswordActualIncorrectaError extends Error {}
export class ServicioNoEncontradoError extends Error {}
export class BloqueoNoEncontradoError extends Error {}
export class FeriadoNoEncontradoError extends Error {}
export class FranjaInvalidaError extends Error {}
// HU-26 — Login por email, roles y restablecimiento de contraseña.
export class TokenDeResetInvalidoError extends Error {}
export class EmailDuplicadoError extends Error {}
export class NoAutorizadoError extends Error {}
// HU-25 — Fichas de clientes.
export class ClienteNoEncontradoError extends Error {}
export class EtiquetaNoEncontradaError extends Error {}
export class EtiquetaDuplicadaError extends Error {}
// HU-27 — Cobros. Solo se le registra un cobro a un turno que se hizo: un ausente no
// paga, y un cancelado tampoco. Aceptarlo en silencio dejaría entrar plata que no existe
// y los totales dejarían de cerrar contra la realidad.
export class TurnoNoCobrableError extends Error {}
// HU-08 — Un turno realizado no se puede pisar con otro realizado (el EXCLUDE de la base
// lo impide). Se puede llegar acá marcando Realizado un turno cuyo rato ya se le dio a
// otro que también se hizo: pasó por Ausente en el medio, que libera el horario.
export class TurnoSeSolapaConRealizadoError extends Error {}
// HU-28 — Los dos topes de la reserva pública. Existen porque reservar es gratis: sin seña
// y sin verificar el teléfono, nada impedía que una sola persona se llevara la agenda
// entera. Las dos son errores del **cliente**: las acciones de Ariel no pasan por acá.
export class LimiteSemanalError extends Error {}
export class FueraDeHorizonteError extends Error {}
// HU-29 — Fotos. Son dos y no uno solo porque mandan a hacer cosas distintas: cambiar el
// archivo o achicarlo. (Había un tercero, `LimiteDeFotosError`, para el tope de 5 por ficha;
// se fue el 23/8/2026 junto con el tope.)
export class ImagenInvalidaError extends Error {}
export class ImagenDemasiadoGrandeError extends Error {}
export class ImagenNoEncontradaError extends Error {}
