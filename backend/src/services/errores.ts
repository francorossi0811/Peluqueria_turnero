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
