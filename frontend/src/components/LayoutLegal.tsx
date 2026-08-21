import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DIRECCION } from '../utils/contacto'

/** El marco compartido de las dos páginas legales (`/privacidad` y `/eliminar-datos`).
 *
 * ⚠️ Estas dos páginas cuelgan **fuera** de todo: no son un paso del wizard de
 * `ReservarPage` como la landing, no piden token como `/turno/:id` y no pasan por
 * `RequireAuth`. Meta abre la URL con un robot, sin sesión y sin haber pasado por el
 * inicio, así que tienen que renderizar solas y en frío. Por eso son rutas de verdad y
 * no una sección de la landing. */
export function LayoutLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string
  actualizado?: string
  children: ReactNode
}) {
  return (
    <div className="bg-fondo min-h-screen">
      <header className="border-borde bg-fondo/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[860px] items-center gap-5 px-[clamp(20px,5vw,72px)] py-3">
          <span className="font-display text-tinta mr-auto text-lg font-semibold">
            La Peluquería de Ariel Enrique
          </span>
          {/* `Link` y no un `<a href>`: quien llega acá desde el pie de la landing no
              tiene por qué recargar la aplicación entera para volver. */}
          <Link
            to="/"
            className="text-tinta hover:text-miel text-sm transition"
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[860px] px-[clamp(20px,5vw,72px)] py-10">
        <h1 className="font-display text-tinta text-3xl font-semibold sm:text-4xl">
          {titulo}
        </h1>
        {actualizado ? (
          <p className="text-tinta-tenue mt-2 text-sm">{actualizado}</p>
        ) : null}
        <div className="text-tinta-suave mt-8 text-[15px] leading-relaxed">
          {children}
        </div>
      </main>

      <footer className="border-borde text-tinta border-t px-[clamp(20px,5vw,72px)] py-6 text-xs opacity-70">
        <div className="mx-auto max-w-[860px]">
          Peluquería de Ariel Enrique — {DIRECCION}
        </div>
      </footer>
    </div>
  )
}

/** Título de sección. Numerado a mano, como en el texto original. */
export function SeccionLegal({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <section className="border-borde-suave mt-8 border-t pt-8 first:mt-0 first:border-0 first:pt-0">
      <h2 className="font-display text-tinta mb-3 text-xl font-semibold">
        {titulo}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/** Lista con viñetas, con el mismo interlineado que los párrafos. */
export function ListaLegal({ children }: { children: ReactNode }) {
  return (
    <ul className="marker:text-miel list-disc space-y-2 pl-5">{children}</ul>
  )
}
