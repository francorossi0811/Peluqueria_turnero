import { Button } from './ui/Button'
import type { Servicio } from '../types/api'
import type { UseQueryResult } from '@tanstack/react-query'

interface LandingProps {
  query: UseQueryResult<Servicio[]>
  onElegir: (servicio: Servicio) => void
}

// Fotos de stock (blanco y negro) — placeholders hasta tener fotos reales del local y
// de Ariel. `lock` fija siempre la misma foto para esa tarjeta (si no, LoremFlickr
// devuelve una random distinta en cada carga).
function fotoStock(tags: string, w: number, h: number, lock: number): string {
  return `https://loremflickr.com/g/${w}/${h}/${tags}?lock=${lock}`
}

const FOTO_POR_SERVICIO: Record<string, { tags: string; lock: number }> = {
  Barba: { tags: 'fade,barber', lock: 1 },
  Color: { tags: 'hairsalon,haircolor', lock: 21 },
  'Corte + Barba': { tags: 'barbershop,haircut', lock: 22 },
  'Corte clásico': { tags: 'fade,barber', lock: 9 },
}

function fotoParaServicio(nombre: string, lockPorDefecto: number) {
  const foto = FOTO_POR_SERVICIO[nombre] ?? {
    tags: 'barber,haircut',
    lock: lockPorDefecto,
  }
  return fotoStock(foto.tags, 500, 650, foto.lock)
}

const PRODUCTOS_PLACEHOLDER = [
  { nombre: 'Pomadas y ceras', tags: 'pomade,barber' },
  { nombre: 'Aceites para barba', tags: 'beardoil,grooming' },
  { nombre: 'Kits de afeitado', tags: 'shaving,razor' },
]

function scrollA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export function Landing({ query, onElegir }: LandingProps) {
  return (
    <div className="bg-fondo">
      <header className="border-borde bg-fondo/90 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="font-display text-tinta text-lg font-semibold">
            La Peluquería de Ariel Enrique
          </p>
          <nav className="text-tinta-suave hidden gap-6 text-sm sm:flex">
            <button
              onClick={() => scrollA('servicios')}
              className="hover:text-tinta transition"
            >
              Servicios
            </button>
            <button
              onClick={() => scrollA('productos')}
              className="hover:text-tinta transition"
            >
              Productos
            </button>
          </nav>
        </div>
      </header>

      <section className="bg-black text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-medium tracking-widest text-white/60 uppercase">
              La Peluquería de Ariel Enrique
            </p>
            <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">
              Estilo clásico,
              <br />
              actitud moderna
            </h1>
            <p className="mt-4 max-w-md text-white/70">
              Cortes, barba y color con la atención de siempre — reservá tu
              turno online en un par de clicks, sin esperar respuesta por
              WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => scrollA('servicios')}>
                Reservar turno
              </Button>
              <button
                onClick={() => scrollA('productos')}
                className="rounded-md border border-white/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ver productos
              </button>
            </div>
          </div>
          <div className="aspect-[4/5] overflow-hidden rounded-lg">
            <img
              src={fotoStock('fade,barber', 800, 1000, 5)}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2">
        <img
          src={fotoStock('barbershop,tools', 700, 500, 11)}
          alt=""
          className="h-64 w-full object-cover sm:h-80"
        />
        <img
          src={fotoStock('haircut,scissors', 700, 500, 12)}
          alt=""
          className="h-64 w-full object-cover sm:h-80"
        />
      </section>

      <section id="servicios" className="bg-fondo px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-miel text-xs font-medium tracking-widest uppercase">
            Elegí y reservá
          </p>
          <h2 className="font-display text-tinta mt-2 text-3xl font-semibold">
            Servicios
          </h2>

          {query.isPending && (
            <p className="text-tinta-suave mt-6">Cargando servicios…</p>
          )}
          {query.isError && (
            <p className="text-vino mt-6">
              No pudimos cargar los servicios. Recargá la página.
            </p>
          )}
          {query.data && (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {query.data.map((s, i) => (
                <ServicioCard
                  key={s.id}
                  servicio={s}
                  lock={20 + i}
                  onClick={() => onElegir(s)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="productos" className="bg-superficie-2 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-miel text-xs font-medium tracking-widest uppercase">
            De cara al futuro
          </p>
          <h2 className="font-display text-tinta mt-2 text-3xl font-semibold">
            Productos
          </h2>
          <p className="text-tinta-suave mt-2 max-w-lg">
            Muy pronto vas a poder comprar acá los productos que usamos en el
            local.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PRODUCTOS_PLACEHOLDER.map((p, i) => (
              <div
                key={p.nombre}
                className="group relative aspect-[3/4] overflow-hidden rounded-lg"
              >
                <img
                  src={fotoStock(p.tags, 500, 650, 30 + i)}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <span className="bg-miel-suave text-miel absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                  Próximamente
                </span>
                <p className="font-display absolute inset-x-0 bottom-0 p-4 text-lg font-semibold text-white">
                  {p.nombre}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-black px-6 py-10 text-center text-white/60">
        <p className="font-display text-lg font-semibold text-white">
          La Peluquería de Ariel Enrique
        </p>
        <p className="mt-2 text-sm">Turnos online, sin vueltas.</p>
      </footer>
    </div>
  )
}

function ServicioCard({
  servicio,
  lock,
  onClick,
}: {
  servicio: Servicio
  lock: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[3/4] overflow-hidden rounded-lg text-left"
    >
      <img
        src={fotoParaServicio(servicio.nombre, lock)}
        alt={servicio.nombre}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-display text-lg font-semibold text-white">
          {servicio.nombre}
        </p>
        <p className="text-sm text-white/70">{servicio.duracionMinutos} min</p>
      </div>
    </button>
  )
}
