import type { ReactNode } from 'react'
import type { Servicio } from '../types/api'
import type { UseQueryResult } from '@tanstack/react-query'

interface LandingProps {
  query: UseQueryResult<Servicio[]>
  onElegir: (servicio: Servicio) => void
}

// Datos reales de contacto (los mismos que Franco cargó en el diseño original).
const DIRECCION = 'Pastor Taboada 10, X5016 Córdoba'
const TELEFONO = 'Tel / WhatsApp: 3514593325'
const HORARIO = 'Martes a sábado, 10 - 13hs y 17 - 20:30hs'
const WHATSAPP_URL = 'https://wa.me/5493514593325'
const MAPA_URL =
  'https://maps.google.com/maps?q=Pastor%20Taboada%2010%2C%20C%C3%B3rdoba%2C%20Argentina&z=16&output=embed'

// Fotos de stock (blanco y negro) — solo para los espacios donde todavía no hay foto
// real de Ariel/el local. `lock` fija siempre la misma foto (si no, LoremFlickr
// devuelve una distinta en cada carga).
function fotoStock(tags: string, w: number, h: number, lock: number): string {
  return `https://loremflickr.com/g/${w}/${h}/${tags}?lock=${lock}`
}

const FOTO_POR_SERVICIO: Record<string, string> = {
  'Corte clásico': '/imagenes/servicio-corte.jpg',
  Barba: fotoStock('fade,barber', 500, 650, 1),
  'Corte + Barba': fotoStock('barbershop,haircut', 500, 650, 22),
  Color: '/imagenes/servicio-color.jpg',
}

function fotoParaServicio(nombre: string, lockPorDefecto: number): string {
  return (
    FOTO_POR_SERVICIO[nombre] ??
    fotoStock('barber,haircut', 500, 650, lockPorDefecto)
  )
}

const PRODUCTOS = [
  {
    nombre: 'Shampoo',
    categoria: 'Cabello',
    desc: 'Limpieza diaria para todo tipo de cabello.',
    foto: fotoStock('shampoo,bottle', 500, 500, 41),
  },
  {
    nombre: 'Aceite para barba',
    categoria: 'Barba',
    desc: 'Hidrata y da brillo.',
    foto: '/imagenes/producto-aceite.jpg',
  },
  {
    nombre: 'Cera moldeadora',
    categoria: 'Peinado',
    desc: 'Fijación y brillo natural.',
    foto: '/imagenes/producto-cera.jpg',
  },
  {
    nombre: 'Crema de afeitar',
    categoria: 'Cuidado',
    desc: 'Afeitado suave y preciso.',
    foto: '/imagenes/producto-crema.jpg',
  },
]

const BENEFICIOS = [
  {
    label: 'Productos de calidad',
    foto: fotoStock('grooming,products', 500, 650, 50),
  },
  { label: 'Equipo de calidad', foto: '/imagenes/beneficio-equipo.jpg' },
  {
    label: 'Atención personalizada',
    foto: '/imagenes/beneficio-atencion.jpg',
  },
]

// Botones del diseño original: outline (acento) y texto solo (ghost) — distintos del
// <Button> compartido (que es sólido relleno), así que van locales acá nomás.
const BTN_OUTLINE =
  'inline-flex items-center justify-center rounded-md border border-miel px-4 py-2.5 font-display text-sm font-semibold text-miel transition hover:bg-miel/10 active:bg-miel/20'
const BTN_GHOST =
  'inline-flex items-center justify-center rounded-md px-2 py-2.5 font-display text-sm font-semibold text-miel transition hover:bg-miel/10 active:bg-miel/20'

function scrollA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="mb-3 inline-block rounded bg-[#5a3b0a] px-2.5 py-1 text-xs font-medium tracking-wider text-white uppercase">
      {children}
    </span>
  )
}

export function Landing({ query, onElegir }: LandingProps) {
  return (
    <div className="bg-fondo">
      <header className="border-borde bg-fondo/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-5 px-[clamp(20px,5vw,72px)] py-3">
          <span className="font-display text-tinta mr-auto text-lg font-semibold">
            La Peluquería de Ariel Enrique
          </span>
          <button
            onClick={() => scrollA('servicios')}
            className="text-tinta hover:text-miel hidden text-sm transition sm:inline"
          >
            Servicios
          </button>
          <button
            onClick={() => scrollA('productos')}
            className="text-tinta hover:text-miel hidden text-sm transition sm:inline"
          >
            Productos
          </button>
          <button
            onClick={() => scrollA('contacto')}
            className="text-tinta hover:text-miel hidden text-sm transition sm:inline"
          >
            Contacto
          </button>
          <button onClick={() => scrollA('servicios')} className={BTN_OUTLINE}>
            Reservar turno
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1240px] gap-8 px-[clamp(20px,5vw,72px)] py-14 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <Kicker>Peluquería unisex</Kicker>
          <h1 className="font-hero text-tinta text-[clamp(40px,5.5vw,72px)] leading-[1.08] font-extrabold tracking-tight">
            Peluquería de
            <br />
            Ariel Enrique
          </h1>
          <p className="font-body text-tinta mt-4 max-w-[52ch] text-lg leading-relaxed opacity-85">
            Corte, barba y color con la dedicación de siempre. Un espacio para
            todos, atendido por Ariel Enrique.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => scrollA('servicios')}
              className={BTN_OUTLINE}
            >
              Reservar turno
            </button>
            <button onClick={() => scrollA('servicios')} className={BTN_GHOST}>
              Ver servicios
            </button>
          </div>
        </div>
        <div className="aspect-[141/101] overflow-hidden rounded-lg bg-[#12100e]">
          <img
            src="/imagenes/hero.webp"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <hr className="border-borde mx-auto max-w-[1240px]" />

      <section
        id="servicios"
        className="mx-auto max-w-[1240px] scroll-mt-20 px-[clamp(20px,5vw,72px)] py-16 sm:py-20"
      >
        <Kicker>Servicios</Kicker>
        <h2 className="font-display text-tinta text-[34px] leading-tight font-normal">
          Elegí tu servicio y reservá
        </h2>
        <p className="font-body text-tinta mt-2 mb-8 max-w-[60ch] opacity-78">
          Hacé click en un servicio para ir a la reserva de turno.
        </p>

        {query.isPending && (
          <p className="font-body text-tinta-suave">Cargando servicios…</p>
        )}
        {query.isError && (
          <p className="font-body text-vino">
            No pudimos cargar los servicios. Recargá la página.
          </p>
        )}
        {query.data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {query.data.map((s, i) => (
              <ServicioCard
                key={s.id}
                servicio={s}
                lock={90 + i}
                onClick={() => onElegir(s)}
              />
            ))}
          </div>
        )}
      </section>

      <hr className="border-borde mx-auto max-w-[1240px]" />

      <section
        id="productos"
        className="mx-auto max-w-[1240px] scroll-mt-20 px-[clamp(20px,5vw,72px)] py-16 sm:py-20"
      >
        <Kicker>Productos</Kicker>
        <h2 className="font-display text-tinta text-[34px] leading-tight font-normal">
          Cuidado personal para llevar
        </h2>
        <p className="font-body text-tinta mt-2 mb-8 max-w-[60ch] opacity-78">
          Los mismos productos que usamos en el sillón, a la venta en el local.
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {PRODUCTOS.map((p) => (
            <ProductoCard key={p.nombre} producto={p} />
          ))}
        </div>
      </section>

      <section className="bg-[#181512] py-16 sm:py-20">
        <div className="mx-auto max-w-[1240px] px-[clamp(20px,5vw,72px)]">
          <h2 className="font-display mb-8 text-center text-[32px] leading-tight font-normal text-[#f3f2f2]">
            Nuestros beneficios
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {BENEFICIOS.map((b) => (
              <BeneficioCard key={b.label} beneficio={b} />
            ))}
          </div>
        </div>
      </section>

      <hr className="border-borde mx-auto max-w-[1240px]" />

      <section
        id="contacto"
        className="mx-auto grid max-w-[1240px] scroll-mt-20 gap-8 px-[clamp(20px,5vw,72px)] py-16 sm:py-20 lg:grid-cols-[5fr_7fr] lg:items-start"
      >
        <div>
          <Kicker>Contacto</Kicker>
          <h2 className="font-display text-tinta text-[30px] leading-tight font-normal">
            Visitanos
          </h2>
          <p className="font-body text-tinta mt-3 text-base leading-loose">
            {DIRECCION}
            <br />
            {TELEFONO}
            <br />
            {HORARIO}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className={BTN_OUTLINE}
            >
              WhatsApp
            </a>
            <button onClick={() => scrollA('servicios')} className={BTN_GHOST}>
              Reservar turno
            </button>
          </div>
        </div>
        <div className="aspect-video overflow-hidden rounded-md">
          <iframe
            src={MAPA_URL}
            className="h-full w-full border-0"
            loading="lazy"
            title="Ubicación en el mapa"
          />
        </div>
      </section>

      <footer className="border-borde text-tinta border-t px-[clamp(20px,5vw,72px)] py-6 text-xs opacity-70">
        <div className="mx-auto max-w-[1240px]">
          Peluquería de Ariel Enrique — {DIRECCION}
        </div>
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
      className="group relative block aspect-[3/4] overflow-hidden rounded-md text-left shadow-sm"
    >
      <img
        src={fotoParaServicio(servicio.nombre, lock)}
        alt={servicio.nombre}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="font-display text-xl text-[#f3f2f2]">
          {servicio.nombre}
        </h3>
        <span className="text-sm text-[#f3f2f2] opacity-85">
          {servicio.duracionMinutos} min
        </span>
      </div>
    </button>
  )
}

function ProductoCard({ producto }: { producto: (typeof PRODUCTOS)[number] }) {
  return (
    <div className="border-borde flex flex-col gap-2 rounded-md border p-3">
      <div className="aspect-square overflow-hidden rounded-md">
        <img
          src={producto.foto}
          alt={producto.nombre}
          className="h-full w-full object-cover"
        />
      </div>
      <span className="inline-block w-fit rounded bg-[#5a3b0a] px-2 py-0.5 text-[10px] tracking-wider text-white uppercase">
        {producto.categoria}
      </span>
      <h3 className="font-display text-tinta text-[17px]">{producto.nombre}</h3>
      <p className="text-tinta text-[13px] opacity-80">{producto.desc}</p>
    </div>
  )
}

function BeneficioCard({
  beneficio,
}: {
  beneficio: (typeof BENEFICIOS)[number]
}) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-md">
      <img src={beneficio.foto} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
      <span className="absolute inset-x-4 bottom-4 text-xs font-semibold tracking-wider text-[#f3f2f2] uppercase">
        {beneficio.label}
      </span>
    </div>
  )
}
