import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  login,
  olvidePassword,
  recuperacionDisponible,
} from '../../api/auth'
import { getTokenValido, setToken } from '../../lib/authStorage'
import { Button } from '../../components/ui/Button'

// Antes mostrábamos "Usuario o contraseña incorrectos." ante cualquier fallo, lo que
// tapaba los errores de red y los 500 — Ariel veía "contraseña incorrecta" cuando en
// realidad el backend estaba caído.
function mensajeDeError(err: unknown): string {
  if (isAxiosError(err) && err.response?.status === 401) {
    return 'Email o contraseña incorrectos.'
  }
  return 'No pudimos conectar con el servidor. Probá de nuevo en un momento.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [olvide, setOlvide] = useState(false)

  // Ya logueado: esta pantalla no tiene nada que hacer. Es el espejo de `RequireAuth`, y
  // lo que evita que la flechita de atrás de Chrome parezca un cierre de sesión: la
  // entrada del login sigue en el historial del navegador aunque la sesión esté viva, y
  // sin esto Ariel veía el formulario de ingreso y daba por hecho que lo había echado.
  const yaLogueado = Boolean(getTokenValido())

  // HU-26 — El botón de recuperación solo existe si el servidor puede mandar mails de
  // verdad. Sin cuenta de Brevo el mail se imprime en el log del servidor: el botón le
  // prometería a Ariel algo que no va a pasar, y encima justo cuando ya no puede entrar.
  const recuperacionQuery = useQuery({
    queryKey: ['recuperacion-disponible'],
    queryFn: recuperacionDisponible,
    staleTime: 60 * 60 * 1000,
    // Si el chequeo falla no se muestra el botón: ante la duda, no prometer nada.
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (token) => {
      setToken(token)
      // ⚠️ Entrar es cambiar de identidad, y la caché de queries no sabe de identidades:
      // sin esto, `['me']` (y la agenda, y los clientes) siguen mostrando los datos de la
      // cuenta anterior hasta que cada query se refresque sola. Al cambiar de cuenta se
      // veía el perfil del anterior, que además es filtrar datos entre cuentas.
      queryClient.clear()
      // `replace` y no un push: el login no tiene que quedar en el historial. Si queda,
      // la flechita de atrás lo trae de vuelta y parece que la sesión se cayó.
      navigate('/admin', { replace: true })
    },
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    loginMutation.mutate()
  }

  // Después de los hooks a propósito: React los pide siempre en el mismo orden, así que
  // el corte por sesión activa no puede ir arriba de todo.
  if (yaLogueado) return <Navigate to="/admin" replace />

  if (olvide) {
    return (
      <OlvidePassword
        emailInicial={email}
        onVolver={() => setOlvide(false)}
      />
    )
  }

  return (
    <main className="bg-fondo flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <p className="text-tinta-suave mb-1 text-center text-xs font-medium tracking-wide uppercase">
          La Peluquería de Ariel Enrique
        </p>
        <h1 className="font-hero text-tinta mb-6 text-center text-[clamp(26px,3.5vw,34px)] font-extrabold">
          Panel de Ariel
        </h1>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Email
            </span>
            <input
              required
              autoFocus
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Contraseña
            </span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
          </label>

          {loginMutation.isError && (
            <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
              {mensajeDeError(loginMutation.error)}
            </div>
          )}

          <Button
            type="submit"
            variant="primaryVino"
            className="mt-2"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Ingresando…' : 'Ingresar'}
          </Button>

          {recuperacionQuery.data && (
            <button
              type="button"
              onClick={() => setOlvide(true)}
              className="text-tinta-suave hover:text-tinta mt-1 text-center text-sm underline"
            >
              Me olvidé la contraseña
            </button>
          )}
        </div>
      </form>
    </main>
  )
}

/** HU-26 — Pedir el link de restablecimiento.
 *
 * El mensaje de éxito es el mismo exista o no la cuenta, y el backend responde igual: si
 * cambiara, esta pantalla sería una forma de averiguar qué direcciones tienen cuenta en el
 * panel. Por eso dice "si esa dirección tiene una cuenta" y no "listo, te lo mandamos". */
function OlvidePassword({
  emailInicial,
  onVolver,
}: {
  emailInicial: string
  onVolver: () => void
}) {
  const [email, setEmail] = useState(emailInicial)

  const mutation = useMutation({
    mutationFn: () => olvidePassword(email),
  })

  return (
    <main className="bg-fondo flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
        className="w-full max-w-sm"
      >
        <p className="text-tinta-suave mb-1 text-center text-xs font-medium tracking-wide uppercase">
          La Peluquería de Ariel Enrique
        </p>
        <h1 className="font-hero text-tinta mb-2 text-center text-[clamp(22px,3vw,28px)] font-extrabold">
          Restablecer la contraseña
        </h1>
        <p className="text-tinta-suave mb-6 text-center text-sm">
          Poné tu email y te mandamos un link para elegir una nueva.
        </p>

        {mutation.isSuccess ? (
          <div className="flex flex-col gap-3">
            <div className="border-bien bg-bien-suave text-bien rounded-md border px-3 py-2 text-sm">
              {mutation.data}
            </div>
            <p className="text-tinta-tenue text-center text-xs">
              El link vale 30 minutos y se puede usar una sola vez.
            </p>
            <Button type="button" variant="outline" onClick={onVolver}>
              Volver al ingreso
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-tinta-tenue text-xs tracking-wide uppercase">
                Email
              </span>
              <input
                required
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
              />
            </label>

            {mutation.isError && (
              <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
                No pudimos procesar el pedido. Probá de nuevo.
              </div>
            )}

            <Button
              type="submit"
              variant="primaryVino"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Enviando…' : 'Mandarme el link'}
            </Button>
            <Button type="button" variant="ghost" onClick={onVolver}>
              Volver
            </Button>
          </div>
        )}
      </form>
    </main>
  )
}
