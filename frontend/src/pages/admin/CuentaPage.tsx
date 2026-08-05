import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Kicker } from '../../components/ui/Kicker'
import { cambiarPassword, obtenerMe } from '../../api/auth'
import {
  eliminarSuscripcion,
  enviarPrueba,
  obtenerClavePublica,
  registrarSuscripcion,
} from '../../api/push'
import { clearToken, setToken } from '../../lib/authStorage'
import {
  crearSuscripcion,
  desuscribirse,
  esIOS,
  estaInstaladaComoApp,
  pedirPermiso,
  soportaPush,
  suscripcionActual,
} from '../../lib/push'
import type { ErrorApi } from '../../types/api'

const CLASES_INPUT =
  'border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none'

export function CuentaPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <Kicker>Panel de Ariel</Kicker>
        <h1 className="font-hero text-tinta mb-4 text-[clamp(26px,3.5vw,34px)] leading-[1.15] font-extrabold">
          Mi cuenta
        </h1>
        <SeccionUsuario />
      </div>
      <div>
        <h2 className="font-display text-tinta mb-4 text-xl font-semibold">
          Avisos de turnos nuevos
        </h2>
        <SeccionNotificaciones />
      </div>
      <div>
        <h2 className="font-display text-tinta mb-4 text-xl font-semibold">
          Cambiar contraseña
        </h2>
        <SeccionPassword />
      </div>
      <div>
        <h2 className="font-display text-tinta mb-4 text-xl font-semibold">
          Cerrar sesión
        </h2>
        <SeccionSalir />
      </div>
    </div>
  )
}

/** Cerrar sesión vive acá, abajo de todo, y ya no en el nav.
 *
 * Ariel tiene el panel abierto casi todo el día en la tablet del mostrador: un botón
 * "Salir" permanente arriba a la derecha es un click accidental a punto de pasar, y
 * volver a entrar cuesta tipear la contraseña con las manos ocupadas. Acá hay que
 * buscarlo, que es lo correcto para algo que en la práctica casi nunca quiere hacer. */
function SeccionSalir() {
  const navigate = useNavigate()

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-tinta-suave text-sm">
        Cierra la sesión en este dispositivo. En los demás sigue abierta.
      </p>
      <Button
        variant="outline"
        onClick={() => {
          clearToken()
          navigate('/admin/login')
        }}
      >
        Cerrar sesión
      </Button>
    </Card>
  )
}

function SeccionNotificaciones() {
  const [suscripto, setSuscripto] = useState<boolean | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const soportado = soportaPush()
  const enIOS = esIOS()
  const instalada = estaInstaladaComoApp()
  // En iPhone el push simplemente no existe fuera de la app instalada: no es un permiso
  // que se pueda pedir desde una pestaña de Safari.
  const bloqueadoPorIOS = enIOS && !instalada

  useEffect(() => {
    if (!soportado) {
      setSuscripto(false)
      return
    }
    void suscripcionActual().then((s) => setSuscripto(Boolean(s)))
  }, [soportado])

  async function activar() {
    setError(null)
    setMensaje(null)

    // El permiso va PRIMERO, antes de cualquier await: ver el comentario de
    // `pedirPermiso()`. Pedirlo después de ir a buscar la clave al backend funciona en
    // Android pero falla en iPhone, y falla en silencio.
    let permiso: NotificationPermission
    try {
      permiso = await pedirPermiso()
    } catch {
      setError(
        'Este dispositivo no nos deja pedir el permiso. En iPhone tiene que ser iOS 16.4 o más nuevo, y el panel abierto desde el ícono de la pantalla de inicio.',
      )
      return
    }

    if (permiso === 'denied') {
      setError(
        'Las notificaciones están bloqueadas para este sitio. En iPhone se habilitan en Ajustes → Notificaciones, buscando "Panel de Ariel"; en Android, desde los ajustes del sitio en Chrome.',
      )
      return
    }
    if (permiso !== 'granted') {
      setError('Quedó sin permiso. Tocá de nuevo y elegí "Permitir".')
      return
    }

    setTrabajando(true)
    try {
      const clave = await obtenerClavePublica()
      const suscripcion = await crearSuscripcion(clave)
      await registrarSuscripcion(suscripcion)
      setSuscripto(true)
      setMensaje('Listo, ya te van a llegar los avisos a este dispositivo.')
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 503) {
        setError(
          'El servidor todavía no tiene configuradas las notificaciones push.',
        )
      } else {
        setError(
          `No pudimos activar los avisos: ${err instanceof Error ? err.message : 'error desconocido'}`,
        )
      }
    } finally {
      setTrabajando(false)
    }
  }

  async function desactivar() {
    setError(null)
    setMensaje(null)
    setTrabajando(true)
    try {
      const endpoint = await desuscribirse()
      if (endpoint) await eliminarSuscripcion(endpoint)
      setSuscripto(false)
      setMensaje('Listo, no vas a recibir más avisos en este dispositivo.')
    } catch {
      setError('No pudimos desactivar los avisos. Probá de nuevo.')
    } finally {
      setTrabajando(false)
    }
  }

  async function probar() {
    setError(null)
    setMensaje(null)
    try {
      const enviadas = await enviarPrueba()
      setMensaje(
        enviadas > 0
          ? `Aviso de prueba enviado a ${enviadas} dispositivo${enviadas > 1 ? 's' : ''}.`
          : 'No hay ningún dispositivo con los avisos activados.',
      )
    } catch {
      setError('No pudimos enviar la prueba.')
    }
  }

  return (
    <Card>
      <p className="text-tinta text-sm">
        Con el panel abierto, los turnos nuevos aparecen solos y quedan
        marcados. Activá los avisos si además querés que te suene el celular
        cuando lo tenés cerrado.
      </p>

      {!soportado && (
        <p className="text-tinta-suave mt-3 text-sm">
          {enIOS
            ? // En iPhone todos los navegadores usan el motor de Safari, así que sugerir
              // "probá con Chrome" no serviría de nada: la limitación es del sistema.
              'Este iPhone no soporta avisos web. Hacen falta iOS 16.4 o más nuevo y tener el panel agregado a la pantalla de inicio.'
            : 'Este navegador no soporta notificaciones. Probá desde Chrome en la computadora o el celular.'}
        </p>
      )}

      {bloqueadoPorIOS && (
        <div className="border-borde bg-superficie mt-3 rounded-md border border-dashed px-3 py-2 text-sm">
          <p className="text-tinta font-medium">
            En iPhone hace falta un paso más
          </p>
          <p className="text-tinta-suave mt-1">
            Apple no permite avisos desde una pestaña de Safari. Tocá el botón
            de compartir, elegí <strong>Agregar a inicio</strong>, y después
            abrí el panel desde ese ícono. Ahí sí vas a poder activarlos.
          </p>
        </div>
      )}

      {soportado && !bloqueadoPorIOS && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {suscripto ? (
            <>
              <Button
                variant="outline"
                disabled={trabajando}
                onClick={() => void desactivar()}
              >
                Desactivar avisos
              </Button>
              <Button variant="ghost" onClick={() => void probar()}>
                Enviar prueba
              </Button>
            </>
          ) : (
            <Button
              variant="primaryVino"
              disabled={trabajando || suscripto === null}
              onClick={() => void activar()}
            >
              {trabajando ? 'Activando…' : 'Activar avisos en este dispositivo'}
            </Button>
          )}
        </div>
      )}

      {mensaje && <p className="text-bien mt-3 text-sm">{mensaje}</p>}
      {error && (
        <div className="border-vino bg-vino-suave text-vino mt-3 rounded-md border px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </Card>
  )
}

function SeccionUsuario() {
  const query = useQuery({ queryKey: ['me'], queryFn: obtenerMe })

  return (
    <Card>
      <p className="text-tinta-tenue text-xs tracking-wide uppercase">Usuario</p>
      <p className="text-tinta mt-1 font-medium">
        {query.isPending && 'Cargando…'}
        {query.isError && 'No pudimos cargar tu cuenta.'}
        {query.data?.usuario}
      </p>
    </Card>
  )
}

function SeccionPassword() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const mutation = useMutation({
    mutationFn: () => cambiarPassword(actual, nueva),
    onSuccess: (token) => {
      // El backend invalida los tokens emitidos antes del cambio, así que hay que
      // reemplazar el guardado o el próximo request nos echaría de la sesión.
      setToken(token)
      setActual('')
      setNueva('')
      setRepetida('')
      setGuardado(true)
      setTimeout(() => setGuardado(false), 3000)
    },
    onError: (err) => {
      const mensaje = isAxiosError<ErrorApi>(err)
        ? err.response?.data.error.mensaje
        : null
      setError(mensaje ?? 'No pudimos cambiar la contraseña. Probá de nuevo.')
    },
  })

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (nueva !== repetida) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    mutation.mutate()
  }

  return (
    <Card>
      <form onSubmit={enviar} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Contraseña actual
          </span>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className={CLASES_INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Contraseña nueva
          </span>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className={CLASES_INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-tinta-tenue text-xs tracking-wide uppercase">
            Repetir contraseña nueva
          </span>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            className={CLASES_INPUT}
          />
        </label>

        <p className="text-tinta-tenue text-xs">
          Mínimo 8 caracteres. Al cambiarla se cierran las sesiones abiertas en
          otros dispositivos, pero esta sigue activa.
        </p>

        {error && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="primaryVino"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
          {guardado && (
            <span className="text-bien text-sm">Contraseña actualizada ✓</span>
          )}
        </div>
      </form>
    </Card>
  )
}
