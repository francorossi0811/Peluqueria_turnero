import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { login } from '../../api/auth'
import { setToken } from '../../lib/authStorage'
import { Button } from '../../components/ui/Button'

// Antes mostrábamos "Usuario o contraseña incorrectos." ante cualquier fallo, lo que
// tapaba los errores de red y los 500 — Ariel veía "contraseña incorrecta" cuando en
// realidad el backend estaba caído.
function mensajeDeError(err: unknown): string {
  if (isAxiosError(err) && err.response?.status === 401) {
    return 'Usuario o contraseña incorrectos.'
  }
  return 'No pudimos conectar con el servidor. Probá de nuevo en un momento.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: () => login(usuario, password),
    onSuccess: (token) => {
      setToken(token)
      navigate('/admin')
    },
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    loginMutation.mutate()
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
              Usuario
            </span>
            <input
              required
              autoFocus
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
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
        </div>
      </form>
    </main>
  )
}
