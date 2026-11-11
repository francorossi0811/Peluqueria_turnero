import { fechaLegible } from '../../utils/fecha'
import { whatsappDeArielConfirmando } from '../../utils/mensajesWhatsapp'
import type { TurnoAdmin } from '../../types/api'

/** HU-36 — El link al chat del cliente con la confirmación ya escrita, o `null` si el turno
 * no tiene ficha.
 *
 * ⚠️ Mira la **ficha** (`turno.cliente`) y no `clienteTelefono`. Sin ficha no hay número en
 * el que confiar: o no se cargó teléfono, o el backend no lo pudo normalizar, y en los dos
 * casos el botón llevaría a un chat que no existe. La ficha es justamente la prueba de que
 * el número sirve (HU-25).
 *
 * El link de gestión se arma con el `origin` del panel, que es el mismo sitio que ve el
 * cliente: el panel vive en `/admin` del mismo frontend. Mismo cálculo que `ReservarPage`. */
export function linkDeWhatsappAlCliente(turnos: TurnoAdmin[]): string | null {
  const telefono = turnos[0]?.cliente?.telefono
  if (!telefono) return null
  return whatsappDeArielConfirmando(
    telefono,
    turnos.map((t) => ({
      nombre: t.clienteNombre,
      servicio: t.servicio.nombre,
      fecha: t.fecha,
      hora: t.hora,
      link: `${window.location.origin}/turno/${t.id}`,
    })),
  )
}

/** HU-36 — El botón verde "Mandarle el link por WhatsApp". No dibuja nada si el turno no
 * tiene ficha.
 *
 * Es un `<a target="_blank">` y no un `location.href`: acá el toque es del usuario (no hay
 * una mutación en el medio, como en `ReservarPage`), así que el navegador no lo bloquea, y
 * abrirlo aparte deja el panel donde estaba. En el celular abre la app de WhatsApp. */
export function BotonWhatsappAlCliente({
  turnos,
  className = '',
}: {
  turnos: TurnoAdmin[]
  className?: string
}) {
  const href = linkDeWhatsappAlCliente(turnos)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`bg-whatsapp text-sobre-estado flex items-center justify-center gap-2 rounded-md px-4 py-3 text-center text-base font-semibold transition hover:brightness-110 ${className}`}
    >
      Mandarle el link por WhatsApp
    </a>
  )
}

/** HU-36 — Lo que muestran las ventanas de carga después de guardar, cuando el turno quedó
 * con ficha: el turno ya está en la agenda, y el siguiente paso natural es mandarle el link
 * al cliente que está enfrente o del otro lado del teléfono.
 *
 * Sin ficha no se muestra: la ventana se cierra sola como siempre, porque no hay nada más
 * para hacer. */
export function PasoTurnoCargado({
  turnos,
  onClose,
}: {
  turnos: TurnoAdmin[]
  onClose: () => void
}) {
  const [primero] = turnos
  return (
    <div className="flex flex-col gap-4">
      <div className="border-realizado bg-superficie-2 rounded-md border-2 px-3 py-2">
        <p className="font-semibold">
          ✓ {turnos.length > 1 ? `${turnos.length} turnos cargados` : 'Turno cargado'}
        </p>
        <p className="text-tinta-suave text-sm">
          {primero.clienteNombre} · {fechaLegible(primero.fecha)} · {primero.hora}
        </p>
      </div>
      <p className="text-tinta-suave text-sm">
        Mandale el link para que pueda reprogramar o cancelar. Se abre su chat con el
        mensaje ya escrito.
      </p>
      <BotonWhatsappAlCliente turnos={turnos} />
      <button
        type="button"
        onClick={onClose}
        className="text-tinta-suave hover:text-tinta py-2 text-base font-semibold"
      >
        Listo
      </button>
    </div>
  )
}
