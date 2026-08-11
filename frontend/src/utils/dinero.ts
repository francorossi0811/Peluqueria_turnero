// HU-27 — Cómo se escribe la plata en el panel. Un solo lugar, para que el precio del
// servicio, el modal de cobro y los totales de la sección Cobros no diverjan.
//
// Los montos son **pesos enteros** en toda la aplicación (ver `servicios.precio` y
// `turnos.monto_cobrado` en el esquema): Ariel no cobra centavos, y guardarlos como
// enteros evita el redondeo de punto flotante en las sumas.

import type { MedioPago } from '../types/api'

/** Cómo se llama cada medio de pago en pantalla. Vive acá y no en `ModalCobro` porque lo
 * leen cuatro componentes: el modal, la fila de la agenda, el detalle del turno y la
 * sección Cobros. (Exportar constantes desde un archivo de componentes además rompe el
 * fast refresh de Vite, que es cómo se notó.) */
export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
}

/**
 * `12500` → `"$ 12.500"`. Sin decimales a propósito: no existen en los datos.
 *
 * El `$` que devuelve `Intl` para `ARS` **es** el signo del peso argentino (al dólar se lo
 * distingue escribiéndolo `US$`), así que el texto no hay que tocarlo.
 *
 * ⚠️ Lo que sí importa es **con qué tipografía se dibuja**: `font-hero` (Playfair) le pone
 * al `$` doble barra, que es la convención del dólar, y a simple vista parece otra moneda.
 * Cormorant, Lora y la del sistema lo dibujan con barra simple. O sea: un monto no va
 * nunca en la tipografía de los títulos. Pasó en el total de la sección Cobros, que es
 * justo el número más grande de la pantalla.
 */
export function formatearPesos(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(monto)
}

/**
 * Lo mismo, pero para un monto que puede no estar cargado.
 *
 * `null` no es `$ 0`: uno significa "todavía no le puse precio" y el otro "es gratis".
 * Confundirlos es justo lo que se evitó dejando la columna nullable, así que el formato
 * tiene que sostener la distinción en pantalla.
 */
export function formatearPesosOpcional(
  monto: number | null | undefined,
  siNoHay = 'Sin precio',
): string {
  return monto === null || monto === undefined ? siNoHay : formatearPesos(monto)
}
