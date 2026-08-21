import { Link } from 'react-router-dom'
import {
  LayoutLegal,
  ListaLegal,
  SeccionLegal,
} from '../components/LayoutLegal'
import { EMAIL_CONTACTO, EMAIL_CONTACTO_URL } from '../utils/contacto'

/** Política de privacidad — `/privacidad`.
 *
 * Es uno de los dos requisitos legales que pide Meta para habilitar la Cloud API de
 * WhatsApp (el otro es `/eliminar-datos`), y las dos URLs tienen que cargar **sin
 * login**: por eso las rutas cuelgan fuera de `RequireAuth` en `App.tsx`.
 *
 * ⚠️ El texto es contenido legal, no copy de la interfaz: si cambia lo que el sistema
 * hace con los datos, hay que cambiarlo acá y actualizar la fecha de arriba. Hoy
 * describe exactamente lo que el código guarda — nombre, teléfono, email opcional y los
 * datos del turno — y los cinco proveedores por los que pasa. */
export function PrivacidadPage() {
  return (
    <LayoutLegal
      titulo="Política de privacidad"
      actualizado="Última actualización: 21 de agosto de 2026"
    >
      <SeccionLegal titulo="1. Quiénes somos">
        <p>
          Este sitio es el sistema de reserva de turnos de La Peluquería de
          Ariel Enrique, ubicada en Córdoba, Argentina. El responsable del
          tratamiento de los datos es el titular del comercio.
        </p>
        <p>
          Para cualquier consulta relacionada con tus datos personales podés
          escribir a{' '}
          <a className="text-miel underline" href={EMAIL_CONTACTO_URL}>
            {EMAIL_CONTACTO}
          </a>
          .
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="2. Qué datos recopilamos">
        <p>Cuando reservás un turno a través de este sitio, te pedimos:</p>
        {/* La tabla es angosta (tres columnas) pero el contenido de la última no se puede
            acortar más, así que en celular scrollea en su propio contenedor en vez de
            desbordar la página. */}
        <div className="border-borde overflow-x-auto rounded-md border">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-borde-suave text-tinta">
              <tr>
                <th className="px-3 py-2 font-medium">Dato</th>
                <th className="px-3 py-2 font-medium">¿Es obligatorio?</th>
                <th className="px-3 py-2 font-medium">Para qué lo usamos</th>
              </tr>
            </thead>
            <tbody className="divide-borde-suave divide-y">
              <tr>
                <td className="px-3 py-2">Nombre</td>
                <td className="px-3 py-2">Sí</td>
                <td className="px-3 py-2">Identificar tu turno en la agenda</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Teléfono</td>
                <td className="px-3 py-2">Sí</td>
                <td className="px-3 py-2">
                  Contactarte si hay algún cambio en tu turno
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Email</td>
                <td className="px-3 py-2">No</td>
                <td className="px-3 py-2">
                  Enviarte la confirmación del turno y el archivo de calendario
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          También guardamos los datos propios del turno: servicio elegido,
          fecha, hora y estado (reservado, cancelado, reprogramado, realizado o
          ausente).
        </p>
        <p>
          No recopilamos datos de tarjetas, documentos de identidad, ni ningún
          otro dato sensible. No usamos cookies de seguimiento ni herramientas
          de publicidad.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="3. Para qué usamos tus datos">
        <p>Usamos tus datos únicamente para:</p>
        <ListaLegal>
          <li>Gestionar y organizar tu turno.</li>
          <li>
            Enviarte la confirmación, y avisarte si el turno se reprograma o se
            cancela.
          </li>
          <li>Contactarte por WhatsApp o email en relación a tu turno.</li>
          <li>Llevar el registro interno de la agenda del comercio.</li>
        </ListaLegal>
        <p>
          <strong className="text-tinta">
            No enviamos publicidad ni promociones.
          </strong>{' '}
          No vendemos, alquilamos ni compartimos tus datos con terceros para
          fines comerciales.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="4. Comunicaciones por WhatsApp">
        <p>
          Si dejás tu número de teléfono, podés recibir mensajes de WhatsApp
          relacionados exclusivamente con tu turno: confirmación, recordatorio,
          aviso de reprogramación o de cancelación.
        </p>
        <p>
          Estos mensajes se envían a través de la Plataforma de WhatsApp
          Business de Meta. WhatsApp procesa el envío de acuerdo a sus propias
          políticas, disponibles en{' '}
          <a
            className="text-miel underline"
            href="https://www.whatsapp.com/legal"
            target="_blank"
            rel="noreferrer"
          >
            whatsapp.com/legal
          </a>
          .
        </p>
        <p>
          Podés pedir que dejemos de enviarte mensajes automáticos en cualquier
          momento respondiendo al mensaje o avisándonos directamente en el
          local.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="5. Con quién compartimos tus datos">
        <p>
          Tus datos se almacenan y procesan a través de los siguientes
          proveedores de servicios, únicamente con el fin de que el sistema
          funcione:
        </p>
        <ListaLegal>
          <li>
            <strong className="text-tinta">Neon</strong> — base de datos donde
            se guardan los turnos.
          </li>
          <li>
            <strong className="text-tinta">Render</strong> — servidor donde
            corre el sistema.
          </li>
          <li>
            <strong className="text-tinta">Vercel</strong> — donde está
            publicado el sitio.
          </li>
          <li>
            <strong className="text-tinta">Meta Platforms</strong> — envío de
            mensajes de WhatsApp, si dejaste tu teléfono.
          </li>
          <li>
            <strong className="text-tinta">
              Proveedor de correo electrónico
            </strong>{' '}
            — envío del mail de confirmación, si dejaste tu email.
          </li>
        </ListaLegal>
        <p>
          No compartimos tus datos con ningún otro tercero, salvo requerimiento
          legal de autoridad competente.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="6. Cuánto tiempo conservamos tus datos">
        <p>
          Conservamos los datos de tus turnos mientras sean necesarios para la
          gestión de la agenda del comercio. Podés pedir la eliminación de tus
          datos en cualquier momento (ver la sección 8).
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="7. Seguridad">
        <p>
          El sitio funciona íntegramente sobre conexiones cifradas (HTTPS). El
          acceso al panel de administración está protegido con usuario y
          contraseña, y las contraseñas se almacenan encriptadas. Solo el
          titular del comercio tiene acceso a la agenda.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="8. Tus derechos">
        <p>
          De acuerdo con la Ley 25.326 de Protección de los Datos Personales de
          la República Argentina, tenés derecho a:
        </p>
        <ListaLegal>
          <li>
            <strong className="text-tinta">Acceder</strong> a los datos que
            tenemos sobre vos.
          </li>
          <li>
            <strong className="text-tinta">Rectificarlos</strong> si son
            incorrectos o están desactualizados.
          </li>
          <li>
            <strong className="text-tinta">Solicitar su eliminación.</strong>
          </li>
          <li>
            <strong className="text-tinta">Oponerte</strong> a recibir
            comunicaciones automáticas.
          </li>
        </ListaLegal>
        <p>
          Para ejercer cualquiera de estos derechos, escribinos a{' '}
          <a className="text-miel underline" href={EMAIL_CONTACTO_URL}>
            {EMAIL_CONTACTO}
          </a>{' '}
          o acercate directamente al local. Si lo que querés es que borremos
          todo,{' '}
          <Link className="text-miel underline" to="/eliminar-datos">
            acá están los pasos
          </Link>
          .
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, en su carácter de
          órgano de control de la Ley 25.326, tiene la atribución de atender
          denuncias y reclamos de quienes vean afectados sus derechos.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="9. Menores de edad">
        <p>
          Este sitio no está dirigido a menores de 13 años. Si un menor necesita
          reservar un turno, debe hacerlo un adulto responsable.
        </p>
      </SeccionLegal>

      <SeccionLegal titulo="10. Cambios en esta política">
        <p>
          Si modificamos esta política, actualizaremos la fecha que figura al
          comienzo de este documento.
        </p>
      </SeccionLegal>
    </LayoutLegal>
  )
}
