import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Button } from '../../components/ui/Button'
import { Kicker } from '../../components/ui/Kicker'
import { Modal } from '../../components/ui/Modal'
import {
  actualizarAdministrador,
  cambiarRolDe,
  crearAdministrador,
  eliminarAdministrador,
  obtenerAdministradores,
  resetearPasswordDe,
} from '../../api/administradores'
import { obtenerMe } from '../../api/auth'
import type { AdministradorResumen, ErrorApi, RolAdmin } from '../../types/api'

// HU-26 — La única sección que el rol `admin` no puede usar. Todo el resto del panel es
// "gestionar la peluquería" y Ariel lo puede entero.
//
// Esconder esta pantalla es comodidad, no seguridad: la que decide es `requireSuperAdmin`
// en el backend, y un `admin` que llame los endpoints a mano se come un 403 igual.

const ETIQUETA_ROL: Record<RolAdmin, string> = {
  super_admin: 'Administrador general',
  admin: 'Peluquería',
}

const LARGO_MINIMO = 8

export function AdministradoresPage() {
  const queryClient = useQueryClient()
  const [modalCrear, setModalCrear] = useState(false)
  const [reseteando, setReseteando] = useState<AdministradorResumen | null>(null)
  const [editando, setEditando] = useState<AdministradorResumen | null>(null)

  const meQuery = useQuery({ queryKey: ['me'], queryFn: obtenerMe })
  const query = useQuery({
    queryKey: ['administradores'],
    queryFn: obtenerAdministradores,
    // Sin esto, un `admin` que escribe la URL a mano dispara el 403 y react-query lo
    // reintenta tres veces contra un endpoint que nunca le va a decir que sí.
    retry: false,
    enabled: meQuery.data?.rol === 'super_admin',
  })

  const rolMutation = useMutation({
    mutationFn: ({ id, rol }: { id: string; rol: RolAdmin }) =>
      cambiarRolDe(id, rol),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['administradores'] }),
  })

  const borrarMutation = useMutation({
    mutationFn: eliminarAdministrador,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['administradores'] }),
  })

  // Mientras no se sabe el rol no se decide nada: redirigir antes de tiempo echaría al
  // super admin de su propia sección en cada recarga.
  if (meQuery.isPending) {
    return <p className="text-tinta-suave">Cargando…</p>
  }
  if (meQuery.data?.rol !== 'super_admin') {
    return <Navigate to="/admin" replace />
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>Panel de Ariel</Kicker>
          <h1 className="font-hero text-tinta mb-1 text-[clamp(26px,3.5vw,34px)] leading-[1.15] font-extrabold">
            Administradores
          </h1>
          <p className="text-tinta-suave text-sm">
            Quién puede entrar al panel. Es lo único que la cuenta de la
            peluquería no puede tocar.
          </p>
        </div>
        <Button variant="primaryVino" onClick={() => setModalCrear(true)}>
          + Nueva cuenta
        </Button>
      </div>

      {query.isPending && <p className="text-tinta-suave">Cargando cuentas…</p>}
      {query.isError && (
        <p className="text-vino">No pudimos cargar las cuentas.</p>
      )}

      <div className="flex flex-col gap-2">
        {query.data?.map((admin) => (
          <FilaAdministrador
            key={admin.id}
            admin={admin}
            // Sobre la cuenta propia no se muestra ninguna acción: para cambiarse la
            // contraseña está "Mi cuenta", que pide la actual. Sin esa regla, esta
            // pantalla sería una forma de cambiarse la contraseña sin conocer la
            // anterior — o sea, de aprovechar una sesión robada. El backend lo rechaza
            // igual (`NoAutorizadoError`); esconder los botones evita el error inútil.
            //
            // Se compara por email porque es único y es lo que devuelve `/admin/me`.
            esPropia={
              admin.email !== null && admin.email === meQuery.data?.email
            }
            cambiandoRol={
              rolMutation.isPending && rolMutation.variables?.id === admin.id
            }
            onResetear={() => setReseteando(admin)}
            onEditar={() => setEditando(admin)}
            onCambiarRol={(rol) => rolMutation.mutate({ id: admin.id, rol })}
            borrando={
              borrarMutation.isPending && borrarMutation.variables === admin.id
            }
            onBorrar={() => borrarMutation.mutate(admin.id)}
          />
        ))}
      </div>

      {rolMutation.isError && (
        <p className="text-vino mt-3 text-sm">
          {mensajeDeError(rolMutation.error, 'No pudimos cambiar el rol.')}
        </p>
      )}
      {borrarMutation.isError && (
        <p className="text-vino mt-3 text-sm">
          {mensajeDeError(borrarMutation.error, 'No pudimos borrar la cuenta.')}
        </p>
      )}

      {modalCrear && <ModalCrearCuenta onClose={() => setModalCrear(false)} />}
      {editando && (
        <ModalEditarDatos admin={editando} onClose={() => setEditando(null)} />
      )}
      {reseteando && (
        <ModalResetear
          admin={reseteando}
          onClose={() => setReseteando(null)}
        />
      )}
    </div>
  )
}

function mensajeDeError(err: unknown, porDefecto: string): string {
  const mensaje = isAxiosError<ErrorApi>(err)
    ? err.response?.data.error.mensaje
    : null
  return mensaje ?? porDefecto
}

function FilaAdministrador({
  admin,
  esPropia,
  cambiandoRol,
  borrando,
  onResetear,
  onEditar,
  onCambiarRol,
  onBorrar,
}: {
  admin: AdministradorResumen
  esPropia: boolean
  cambiandoRol: boolean
  borrando: boolean
  onResetear: () => void
  onEditar: () => void
  onCambiarRol: (rol: RolAdmin) => void
  onBorrar: () => void
}) {
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false)

  // Borrar una cuenta no se deshace, así que la confirmación reemplaza a los botones en
  // vez de aparecer al lado: es el mismo patrón que cancelar un turno, y evita que el
  // click de confirmar caiga donde antes había otra acción.
  if (confirmandoBorrar) {
    return (
      <div className="border-vino bg-vino-suave flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <p className="text-tinta text-sm">
          ¿Borrar la cuenta de <strong>{admin.usuario}</strong>? No se puede
          deshacer, y si tiene la sesión abierta se le cierra.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            className="px-3 py-2 text-sm"
            disabled={borrando}
            onClick={onBorrar}
          >
            {borrando ? 'Borrando…' : 'Sí, borrar'}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-2 text-sm"
            onClick={() => setConfirmandoBorrar(false)}
          >
            No, volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-borde bg-superficie-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-tinta font-medium">{admin.usuario}</p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
              admin.rol === 'super_admin'
                ? 'bg-miel-suave text-miel'
                : 'bg-borde-suave text-tinta-tenue'
            }`}
          >
            {ETIQUETA_ROL[admin.rol]}
          </span>
          {esPropia && (
            <span className="text-tinta-tenue text-xs">(vos)</span>
          )}
        </div>
        {/* Una cuenta sin email no puede entrar, porque el login es por email. Decirlo
            acá es lo que evita que quede una cuenta muerta sin que nadie se entere. */}
        <p
          className={`text-sm ${admin.email ? 'text-tinta-suave' : 'text-vino'}`}
        >
          {admin.email ?? 'Sin email — esta cuenta no puede entrar'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* "Datos" sí está disponible sobre la cuenta propia: corregirse el mail no es un
            privilegio que se pueda abusar, y prohibirlo dejaría al administrador general
            sin forma de arreglar su propia dirección. */}
        <Button
          variant="ghost"
          className="px-3 py-2 text-sm"
          onClick={onEditar}
        >
          Datos
        </Button>
        {!esPropia && (
          <>
            <Button
              variant="outline"
              className="px-3 py-2 text-sm"
              onClick={onResetear}
            >
              Cambiarle la contraseña
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-2 text-sm"
              disabled={cambiandoRol}
              onClick={() =>
                onCambiarRol(
                  admin.rol === 'super_admin' ? 'admin' : 'super_admin',
                )
              }
            >
              {cambiandoRol
                ? 'Guardando…'
                : admin.rol === 'super_admin'
                  ? 'Pasar a peluquería'
                  : 'Hacer general'}
            </Button>
            <Button
              variant="ghost"
              className="text-vino px-3 py-2 text-sm"
              onClick={() => setConfirmandoBorrar(true)}
            >
              Borrar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/** La recuperación que funciona aunque el mail no salga: el super admin le fija una
 * contraseña a otra cuenta y se la pasa por donde sea. Cierra las sesiones abiertas de
 * esa cuenta, que es lo que uno quiere cuando resetea la contraseña de alguien. */
function ModalResetear({
  admin,
  onClose,
}: {
  admin: AdministradorResumen
  onClose: () => void
}) {
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => resetearPasswordDe(admin.id, password),
  })

  return (
    <Modal titulo={`Contraseña de ${admin.usuario}`} onClose={onClose}>
      {mutation.isSuccess ? (
        <div className="flex flex-col gap-4">
          <div className="border-bien bg-bien-suave text-bien rounded-md border px-3 py-2 text-sm">
            Listo. Pasale esta contraseña y que la cambie desde "Mi cuenta"
            cuando entre.
          </div>
          <p className="text-tinta-tenue text-sm">
            Las sesiones que tuviera abiertas en otros dispositivos se cerraron.
          </p>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (password.length >= LARGO_MINIMO) mutation.mutate()
          }}
        >
          <p className="text-tinta-suave text-sm">
            Le fijás una contraseña nueva a {admin.email ?? admin.usuario}. Sirve
            cuando el link por mail no es una opción.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-tinta-suave text-sm">Contraseña nueva</span>
            <input
              required
              autoFocus
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
            />
            {/* En texto plano y no oculta: la tiene que poder leer para dictársela. Es
                una contraseña temporal que la otra persona va a cambiar. */}
            <span className="text-tinta-tenue text-xs">
              Se muestra en claro para que se la puedas pasar. Al menos{' '}
              {LARGO_MINIMO} caracteres.
            </span>
          </label>

          {mutation.isError && (
            <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
              {mensajeDeError(mutation.error, 'No pudimos cambiarla.')}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primaryVino"
              className="flex-1"
              disabled={password.length < LARGO_MINIMO || mutation.isPending}
            >
              {mutation.isPending ? 'Guardando…' : 'Cambiar la contraseña'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** Corregir el nombre o el email de una cuenta.
 *
 * Es la pantalla que faltaba: sin ella, un email mal cargado no se podía cambiar por
 * ningún lado —el seed solo lo completa cuando está vacío— y como el login es por email,
 * eso dejaba la cuenta inutilizable sin entrar a la base a mano. */
function ModalEditarDatos({
  admin,
  onClose,
}: {
  admin: AdministradorResumen
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [usuario, setUsuario] = useState(admin.usuario)
  const [email, setEmail] = useState(admin.email ?? '')

  const mutation = useMutation({
    mutationFn: () =>
      actualizarAdministrador(admin.id, {
        usuario: usuario.trim(),
        email: email.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['administradores'] })
      // También "me": si se editó la cuenta propia, el email de "Mi cuenta" y el nav
      // quedarían mostrando el dato viejo hasta la próxima recarga.
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      onClose()
    },
  })

  const listo =
    usuario.trim().length > 0 &&
    email.trim().length > 0 &&
    (usuario.trim() !== admin.usuario || email.trim() !== (admin.email ?? ''))

  return (
    <Modal titulo={`Datos de ${admin.usuario}`} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (listo) mutation.mutate()
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-tinta-suave text-sm">Nombre</span>
          <input
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
          />
          <span className="text-tinta-tenue text-xs">
            Solo se muestra en el panel.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-tinta-suave text-sm">Email</span>
          <input
            required
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
          />
          <span className="text-tinta-tenue text-xs">
            Con esto entra al panel, y acá le llega el link si se olvida la
            contraseña. Cambiarlo no le cierra la sesión.
          </span>
        </label>

        {mutation.isError && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {mensajeDeError(mutation.error, 'No pudimos guardar los cambios.')}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primaryVino"
            className="flex-1"
            disabled={!listo || mutation.isPending}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ModalCrearCuenta({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [usuario, setUsuario] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<RolAdmin>('admin')

  const mutation = useMutation({
    mutationFn: () => crearAdministrador({ usuario, email, password, rol }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['administradores'] })
      onClose()
    },
  })

  const listo =
    usuario.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= LARGO_MINIMO

  return (
    <Modal titulo="Nueva cuenta" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (listo) mutation.mutate()
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-tinta-suave text-sm">Nombre</span>
          <input
            required
            autoFocus
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Ariel"
            className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
          />
          <span className="text-tinta-tenue text-xs">
            Solo se muestra en el panel. Con lo que se entra es el email.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-tinta-suave text-sm">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-tinta-suave text-sm">Contraseña inicial</span>
          <input
            required
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2.5 text-base"
          />
          <span className="text-tinta-tenue text-xs">
            Al menos {LARGO_MINIMO} caracteres. Se la pasás y la cambia desde "Mi
            cuenta".
          </span>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-tinta-suave text-sm">Rol</span>
          <div className="flex flex-wrap gap-2">
            {(['admin', 'super_admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRol(r)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  rol === r
                    ? 'border-miel bg-miel-suave text-miel font-medium'
                    : 'border-borde bg-superficie text-tinta-suave hover:text-tinta'
                }`}
              >
                {ETIQUETA_ROL[r]}
              </button>
            ))}
          </div>
          <span className="text-tinta-tenue text-xs">
            "Peluquería" puede todo menos esta pantalla. "Administrador general"
            además administra las cuentas.
          </span>
        </div>

        {mutation.isError && (
          <div className="border-vino bg-vino-suave text-vino rounded-md border px-3 py-2 text-sm">
            {mensajeDeError(mutation.error, 'No pudimos crear la cuenta.')}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primaryVino"
            className="flex-1"
            disabled={!listo || mutation.isPending}
          >
            {mutation.isPending ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
