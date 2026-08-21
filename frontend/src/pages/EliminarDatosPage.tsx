import { Link } from 'react-router-dom'
import { LayoutLegal, SeccionLegal } from '../components/LayoutLegal'
import {
  DIRECCION,
  EMAIL_CONTACTO,
  EMAIL_CONTACTO_URL,
} from '../utils/contacto'

/** Instrucciones para eliminar los datos — `/eliminar-datos`.
 *
 * Es la segunda URL que pide Meta, aparte de la política de privacidad, y por eso vive
 * en su propia ruta en vez de ser un ancla dentro de `/privacidad`: el formulario de Meta
 * pide una dirección propia para esto.
 *
 * ⚠️ Lo que promete esta página lo cumple una persona, no el sistema: no hay ningún
 * endpoint que borre una ficha de cliente. El pedido llega por mail o en el local y lo
 * ejecuta Ariel. Si alguna vez se automatiza, el plazo de 30 días que dice acá abajo es
 * el compromiso que hay que sostener. */
export function EliminarDatosPage() {
  return (
    <LayoutLegal
      titulo="Cómo eliminar tus datos"
      actualizado="Última actualización: 21 de agosto de 2026"
    >
      <SeccionLegal titulo="Pedilo por una de estas dos vías">
        <p>
          Si querés que eliminemos toda la información que tenemos sobre vos,
          tenés dos opciones:
        </p>
        <div className="border-borde bg-borde-suave/40 rounded-md border p-4">
          <h3 className="text-tinta mb-1 font-medium">1. Por email</h3>
          <p>
            Escribinos a{' '}
            <a className="text-miel underline" href={EMAIL_CONTACTO_URL}>
              {EMAIL_CONTACTO}
            </a>{' '}
            desde tu casilla, o indicando el nombre y teléfono con los que
            reservaste, pidiendo la eliminación de tus datos.
          </p>
        </div>
        <div className="border-borde bg-borde-suave/40 rounded-md border p-4">
          <h3 className="text-tinta mb-1 font-medium">2. En el local</h3>
          <p>
            Acercate a la peluquería ({DIRECCION}) y pedíselo directamente a
            Ariel.
          </p>
        </div>
      </SeccionLegal>

      <SeccionLegal titulo="Qué se elimina">
        <p>Tu nombre, teléfono, email y el historial de turnos asociados.</p>
      </SeccionLegal>

      <SeccionLegal titulo="En cuánto tiempo">
        <p>
          Damos de baja los datos dentro de los 30 días de recibido el pedido.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="Qué puede quedar">
        <p>
          Si tenés un turno reservado a futuro, ese turno se cancela junto con
          el pedido de eliminación. Los registros contables o fiscales que el
          comercio esté obligado a conservar por ley se mantienen por el plazo
          que la normativa exija.
        </p>
        <p>
          El detalle de qué datos guardamos y por qué está en la{' '}
          <Link className="text-miel underline" to="/privacidad">
            política de privacidad
          </Link>
          .
        </p>
      </SeccionLegal>
    </LayoutLegal>
  )
}
