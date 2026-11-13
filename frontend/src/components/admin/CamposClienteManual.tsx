import { useState, type ReactNode } from 'react'
import { BuscadorDeClientes } from './BuscadorDeClientes'
import { elegirContacto, soportaElegirContacto } from '../../lib/contactos'
import {
  esTelefonoValido,
  MENSAJE_TELEFONO_INVALIDO,
} from '../../utils/validaciones'
import type { ClienteResumen, OrigenManual } from '../../types/api'

/** Los datos del cliente cuando el turno lo carga Ariel (HU-08): nombre, teléfono, mail y
 * origen.
 *
 * Vive aparte porque lo usan dos ventanas —la carga de siempre (`ModalCargarTurno`) y el
 * turno fuera de horario (`ModalTurnoExtra`, HU-35)— y las reglas de estos campos tienen
 * que ser las mismas en las dos: teléfono opcional con su error pegado al input, mail
 * opcional, "Elegir de mis contactos" solo donde funciona. Copiarlas sería invitar a que
 * una de las dos se quede atrás la próxima vez que se toque algo. */
interface CamposClienteManualProps {
  nombre: string
  onNombre: (valor: string) => void
  etiquetaNombre: string
  /** Texto chico debajo del nombre (en el bloque, a qué turnos se aplica). */
  ayudaNombre?: ReactNode
  telefono: string
  onTelefono: (valor: string) => void
  /** El error del backend sobre el teléfono, que va pegado al input. */
  errorTelefono: string | null
  email: string
  onEmail: (valor: string) => void
  origen: OrigenManual
  onOrigen: (valor: OrigenManual) => void
}

export function CamposClienteManual({
  nombre,
  onNombre,
  etiquetaNombre,
  ayudaNombre,
  telefono,
  onTelefono,
  errorTelefono,
  email,
  onEmail,
  origen,
  onOrigen,
}: CamposClienteManualProps) {
  // HU-38 — La misma elección que en un turno sin ficha: buscar un cliente que ya existe o
  // cargarlo nuevo. Arranca en "Cliente nuevo" porque es lo que ya hacía la ventana y lo
  // más rápido con la persona enfrente; buscar es un toque más.
  const [modo, setModo] = useState<'buscar' | 'nuevo'>('nuevo')
  const [fichaElegida, setFichaElegida] = useState<ClienteResumen | null>(null)
  // Elegir una ficha **completa los campos** con su nombre y su teléfono, y nada más: el
  // turno se engancha a la ficha en el backend por el teléfono, como cualquier carga
  // (HU-25), así que no hace falta un endpoint ni un campo nuevo. Se usa el `nombre` de la
  // ficha y no el apodo: el apodo es de Ariel, y en la agenda se ve igual. La marca de
  // "ficha" dura mientras el teléfono sea el de la ficha: si lo cambia, ya es otro cliente.
  const conFicha =
    fichaElegida !== null && telefono.trim() === fichaElegida.telefono

  function elegirFicha(c: ClienteResumen) {
    setFichaElegida(c)
    onNombre(c.nombre)
    onTelefono(c.telefono)
    setModo('nuevo')
  }

  function soltarFicha() {
    setFichaElegida(null)
    onNombre('')
    onTelefono('')
  }

  async function completarDesdeContactos() {
    try {
      const contacto = await elegirContacto()
      if (!contacto) return
      if (contacto.telefono) onTelefono(contacto.telefono)
      // El nombre solo se completa si Ariel todavía no escribió uno, para no pisarle lo
      // que ya venía tipeando.
      if (contacto.nombre && !nombre.trim()) onNombre(contacto.nombre)
    } catch {
      // Cancelar el selector nativo también entra por acá. No es un error que valga la
      // pena mostrar: el campo se puede tipear igual.
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['buscar', 'Buscar cliente'],
            ['nuevo', 'Cliente nuevo'],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={modo === valor}
            onClick={() => setModo(valor)}
            className={`rounded-md border px-3 py-2.5 text-base font-semibold transition ${
              modo === valor
                ? 'border-miel-fuerte bg-miel-fuerte text-sobre-acento'
                : 'border-borde bg-superficie text-tinta hover:bg-superficie-2'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {modo === 'buscar' ? (
        <BuscadorDeClientes etiquetaBoton="Elegir" onElegir={elegirFicha} />
      ) : (
        <>
          {conFicha && (
            <div className="border-realizado bg-superficie-2 flex items-center gap-2 rounded-md border-2 px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-sm">
                ✓ Ficha de{' '}
                <strong>{fichaElegida.apodo || fichaElegida.nombre}</strong>
              </p>
              <button
                type="button"
                onClick={soltarFicha}
                className="text-tinta-suave hover:text-tinta text-sm font-semibold"
              >
                Quitar
              </button>
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              {etiquetaNombre}
            </span>
            <input
              required
              autoFocus
              value={nombre}
              onChange={(e) => onNombre(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
            {ayudaNombre && (
              <span className="text-tinta-tenue text-xs">{ayudaNombre}</span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Teléfono (opcional)
              </span>
              {/* Solo aparece donde funciona de verdad: Chrome en Android. En la
              computadora del mostrador ni se renderiza, así que no hay un botón
              que no haga nada. */}
              {soportaElegirContacto() && (
                <button
                  type="button"
                  onClick={completarDesdeContactos}
                  className="text-miel text-xs font-medium hover:opacity-80"
                >
                  Elegir de mis contactos
                </button>
              )}
            </div>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => onTelefono(e.target.value)}
              placeholder="Si no lo sabés, dejalo vacío"
              className={`bg-superficie text-tinta rounded-md border px-3 py-2 outline-none ${
                errorTelefono ? 'border-vino' : 'border-borde focus:border-miel'
              }`}
            />
            {errorTelefono ? (
              <span className="text-vino text-xs">{errorTelefono}</span>
            ) : (
              // Chequeo laxo local, solo para el caso obvio (letras, muy corto). El de
              // verdad lo hace el backend: saber si una característica existe necesita
              // metadata que no vale traer al bundle.
              telefono.trim() !== '' &&
              !esTelefonoValido(telefono) && (
                <span className="text-vino text-xs">
                  {MENSAJE_TELEFONO_INVALIDO}
                </span>
              )
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Email (opcional)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              placeholder="Si te lo dicta, le llega la confirmación"
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
          </label>
          <div>
            <span className="text-tinta-tenue mb-2 block text-xs tracking-wide uppercase">
              Origen
            </span>
            <div className="flex gap-2">
              {(
                [
                  ['presencial', 'Presencial'],
                  ['llamada', 'Llamada'],
                  ['whatsapp', 'WhatsApp'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => onOrigen(valor)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    origen === valor
                      ? 'border-vino bg-vino-suave text-vino'
                      : 'border-borde text-tinta-suave'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
