import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { restablecerPassword } from '../../api/auth'
import { setToken } from '../../lib/authStorage'
import { Button } from '../../components/ui/Button'
import type { ErrorApi } from '../../types/api'

// HU-26 — La pantalla a la que lleva el link del mail.
//
// Cuelga fuera de `RequireAuth` a propósito: quien llega acá es justamente alguien que no
// puede entrar. El token de la URL es la credencial, igual que el id del turno es el token
// del link del cliente.

/** Mismo mínimo que HU-16 y que el backend. */
const LARGO_MINIMO = 8

export function RestablecerPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')

  const mutation = useMutation({
    mutationFn: () => restablecerPassword(token!, password),
    // Devuelve un token de sesión y entramos derecho: quien acaba de probar que tiene
    // acceso a ese mail y eligió una contraseña ya está autenticado. Mandarlo al login a
    // tipear lo que escribió hace dos segundos no agrega seguridad.
    onSuccess: (nuevo) => {
      setToken(nuevo)
      // `replace`: el link del mail se usa una sola vez, así que dejarlo en el historial
      // solo sirve para que la flechita de atrás lleve a una pantalla que ya no funciona.
      navigate('/admin', { replace: true })
    },
  })

  const coinciden = password === repetida
  const largoOk = password.length >= LARGO_MINIMO

  function mensajeDeError(err: unknown): string {
    const codigo = isAxiosError<ErrorApi>(err)
      ? err.response?.data.error.codigo
      : null
    if (codigo === 'TOKEN_DE_RESET_INVALIDO') {
      return 'Este link ya no sirve: puede haber vencido o haberse usado. Pedí uno nuevo desde el ingreso.'
    }
    return 'No pudimos cambiar la contraseña. Probá de nuevo.'
  }

  return (
    <main className="bg-fondo flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (coinciden && largoOk) mutation.mutate()
        }}
        className="w-full max-w-sm"
      >
        <p className="text-tinta-suave mb-1 text-center text-xs font-medium tracking-wide uppercase">
          La Peluquería de Ariel Enrique
        </p>
        <h1 className="font-hero text-tinta mb-6 text-center text-[clamp(22px,3vw,28px)] font-extrabold">
          Elegí una contraseña nueva
        </h1>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Contraseña nueva
            </span>
            <input
              required
              autoFocus
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Repetila
            </span>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              className="border-borde bg-superficie text-tinta focus:border-miel rounded-md border px-3 py-2 outline-none"
            />
          </label>

          {/* Los dos avisos se muestran mientras escribe, no recién al enviar: el error
              del backend por una contraseña corta llegaría después de un viaje al
              servidor para algo que el navegador ya sabe. */}
          {password.length > 0 && !largoOk && (
            <p className="text-tinta-tenue text-xs">
              Tiene que tener al menos {LARGO_MINIMO} caracteres.
            </p>
          )}
          {repetida.length > 0 && !coinciden && (
            <p className="text-vino text-xs">Las dos contraseñas no coinciden.</p>
          )}

          {mutation.isError && (
            <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
              {mensajeDeError(mutation.error)}
            </div>
          )}

          <Button
            type="submit"
            variant="primaryVino"
            className="mt-2"
            disabled={!coinciden || !largoOk || mutation.isPending}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar y entrar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/admin/login')}
          >
            Volver al ingreso
          </Button>
        </div>
      </form>
    </main>
  )
}
