import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Kicker } from '../../components/ui/Kicker'
import { Insignias } from '../../components/admin/Insignia'
import { ModalCobro } from '../../components/admin/ModalCobro'
import { obtenerCobros } from '../../api/cobros'
import { ETIQUETA_MEDIO_PAGO, formatearPesos } from '../../utils/dinero'
import { fechaLegible, hoyIso, sumarDias } from '../../utils/fecha'
import type { TurnoCobrado } from '../../types/api'

// HU-27 — Lo que entró.
//
// Sección propia y no un pie de la agenda: el día se mira turno por turno y la plata se
// mira sumada, y son dos preguntas distintas ("¿qué tengo hoy?" contra "¿cuánto hice esta
// semana?"). Es lo mismo que se decidió con Clientes en HU-25.

type Atajo = 'hoy' | 'semana' | 'mes'

/** El domingo→sábado de la semana calendario, no los últimos 7 días: "esta semana" para
 * Ariel es la que está viviendo, no una ventana móvil. */
function rangoDeAtajo(atajo: Atajo): { desde: string; hasta: string } {
  const hoy = hoyIso()
  if (atajo === 'hoy') return { desde: hoy, hasta: hoy }

  const fecha = new Date(`${hoy}T00:00:00`)
  if (atajo === 'semana') {
    const desde = sumarDias(hoy, -fecha.getDay())
    return { desde, hasta: sumarDias(desde, 6) }
  }

  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  // El día 0 del mes siguiente es el último del actual, sin tabla de días por mes ni
  // caso especial para febrero bisiesto.
  const ultimo = new Date(anio, fecha.getMonth() + 1, 0).getDate()
  return {
    desde: `${anio}-${mes}-01`,
    hasta: `${anio}-${mes}-${String(ultimo).padStart(2, '0')}`,
  }
}

export function CobrosPage() {
  const [atajo, setAtajo] = useState<Atajo | null>('hoy')
  const [rango, setRango] = useState(() => rangoDeAtajo('hoy'))
  const [turnoCobrar, setTurnoCobrar] = useState<TurnoCobrado | null>(null)

  function elegirAtajo(nuevo: Atajo) {
    setAtajo(nuevo)
    setRango(rangoDeAtajo(nuevo))
  }

  // Tocar una fecha a mano apaga el atajo: si quedara encendido diría que estás viendo
  // "el mes" mientras mirás otra cosa.
  function cambiarFecha(campo: 'desde' | 'hasta', valor: string) {
    if (!valor) return
    setAtajo(null)
    setRango((r) => ({ ...r, [campo]: valor }))
  }

  const query = useQuery({
    queryKey: ['cobros', rango.desde, rango.hasta],
    queryFn: () => obtenerCobros(rango.desde, rango.hasta),
    // El rango invertido lo rechaza el backend; no vale la pena pedírselo para que diga
    // que no.
    enabled: rango.hasta >= rango.desde,
  })

  const resumen = query.data
  const unSoloDia = rango.desde === rango.hasta

  return (
    <div>
      <div className="mb-6">
        <Kicker>Panel de Ariel</Kicker>
        <h1 className="font-hero text-tinta mb-1 text-[clamp(26px,3.5vw,34px)] leading-[1.15] font-extrabold">
          Cobros
        </h1>
        <p className="text-tinta-suave text-sm">
          Lo que entró, por período y por medio de pago.
        </p>
      </div>

      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(['hoy', 'semana', 'mes'] as Atajo[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => elegirAtajo(a)}
              aria-pressed={atajo === a}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                atajo === a
                  ? 'border-miel-fuerte bg-miel-fuerte text-sobre-acento'
                  : 'border-borde bg-superficie text-tinta hover:bg-superficie-2'
              }`}
            >
              {a === 'hoy' ? 'Hoy' : a === 'semana' ? 'Esta semana' : 'Este mes'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Desde
            </span>
            <input
              type="date"
              value={rango.desde}
              onChange={(e) => cambiarFecha('desde', e.target.value)}
              className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-tinta-tenue text-xs tracking-wide uppercase">
              Hasta
            </span>
            <input
              type="date"
              value={rango.hasta}
              onChange={(e) => cambiarFecha('hasta', e.target.value)}
              className="border-borde bg-superficie text-tinta rounded-md border px-3 py-2"
            />
          </label>
        </div>
      </div>

      {query.isError && (
        <p className="text-vino text-sm">
          No pudimos traer los cobros. Probá de nuevo.
        </p>
      )}
      {query.isPending && (
        <p className="text-tinta-suave text-sm">Cargando…</p>
      )}

      {resumen && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card>
              <p className="text-tinta-tenue text-xs tracking-wide uppercase">
                Total
              </p>
              {/* ⚠️ El total va en la tipografía del cuerpo y **no** en `font-hero`, que
                  es la que usan los títulos. No es una preferencia estética: Playfair
                  dibuja el `$` con **doble barra**, que es la convención tipográfica del
                  dólar, y el peso argentino se escribe con barra simple. El carácter es el
                  mismo, lo que engaña es el glifo — y en el número más grande de la
                  pantalla. Lora lo dibuja con barra simple, igual que el resto de los
                  montos del panel. */}
              <p className="text-tinta text-[clamp(28px,5vw,40px)] leading-tight font-extrabold">
                {formatearPesos(resumen.total)}
              </p>
              <p className="text-tinta-suave text-sm">
                {resumen.turnos.length}{' '}
                {resumen.turnos.length === 1 ? 'turno' : 'turnos'} ·{' '}
                {unSoloDia
                  ? fechaLegible(rango.desde)
                  : `${fechaLegible(rango.desde)} al ${fechaLegible(rango.hasta)}`}
              </p>
              {/* Lo que le falta al total, dicho y no escondido: si no estuviera, el
                  número no cerraría contra la caja y no habría forma de saber por qué. */}
              {resumen.sinRegistrar > 0 && (
                <p className="text-alerta mt-2 text-sm font-semibold">
                  {resumen.sinRegistrar}{' '}
                  {resumen.sinRegistrar === 1
                    ? 'turno realizado sin cobro registrado'
                    : 'turnos realizados sin cobro registrado'}
                  . No están sumados acá.
                </p>
              )}
            </Card>

            <Card>
              <p className="text-tinta-tenue mb-2 text-xs tracking-wide uppercase">
                Por medio de pago
              </p>
              {resumen.porMedio.length === 0 ? (
                <p className="text-tinta-suave text-sm">
                  Todavía no hay cobros registrados en este período.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {resumen.porMedio.map((fila) => (
                    <li
                      key={fila.medioPago}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-tinta">
                        {ETIQUETA_MEDIO_PAGO[fila.medioPago]}
                        <span className="text-tinta-tenue text-sm">
                          {' '}
                          · {fila.turnos}
                        </span>
                      </span>
                      <span className="text-tinta font-semibold">
                        {formatearPesos(fila.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* La grilla de turnos: quién pagó qué y cómo. Es lo que la planilla marcaba
              con el color azul/violeta, ahora con el dato adentro y no en el color.

              **Cada fila se toca y abre el cobro.** Acá es donde Ariel ve juntos los que
              le faltan cargar, así que tener que ir a buscar cada uno a su día en la
              agenda convertía la lista en un reproche en vez de en algo que se resuelve.
              La fila entera es el botón —y no un "Registrar" al costado— porque es el
              blanco más grande posible, que es lo que importa en el celular y con lentes;
              y vale para todas, porque corregir un cobro cargado es la misma acción. */}
          {resumen.turnos.length === 0 ? (
            <p className="text-tinta-suave text-sm">
              No hay turnos realizados en este período.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {resumen.turnos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTurnoCobrar(t)}
                  title={
                    t.medioPago
                      ? 'Corregir el cobro de este turno'
                      : 'Registrar el cobro de este turno'
                  }
                  className="border-borde bg-superficie-2 hover:border-miel flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-left transition"
                >
                  <div className="min-w-0">
                    <p className="text-tinta flex flex-wrap items-center gap-2 font-medium">
                      {/* El apodo manda sobre el nombre, como en toda la interfaz. */}
                      <span>{t.cliente?.apodo || t.clienteNombre}</span>
                      {t.cliente && <Insignias etiquetas={t.cliente.etiquetas} />}
                    </p>
                    <p className="text-tinta-suave text-sm">
                      {t.servicio.nombre} · {fechaLegible(t.fecha)} · {t.hora}
                    </p>
                  </div>
                  {/* ⚠️ En celular la fila envuelve, y entonces `text-right` alinea
                      contra un bloque que se encoge al contenido: el monto quedaba
                      indentado respecto del medio de pago, distinto en cada fila según
                      cuál de los dos textos fuera más largo. A ancho de celular el bloque
                      ocupa todo y alinea a la izquierda como el resto de la fila; recién
                      cuando entra al lado del nombre se va a la derecha. */}
                  <div className="w-full text-left sm:w-auto sm:text-right">
                    {t.medioPago && t.montoCobrado != null ? (
                      <>
                        <p className="text-tinta font-semibold">
                          {formatearPesos(t.montoCobrado)}
                        </p>
                        <p className="text-tinta-tenue text-xs">
                          {ETIQUETA_MEDIO_PAGO[t.medioPago]}
                        </p>
                      </>
                    ) : (
                      <p className="text-alerta text-sm font-semibold">
                        Sin cobro registrado
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* El mismo modal que usa la agenda. Al guardar invalida `cobros`, así que la lista
          y los totales de arriba se actualizan solos. */}
      {turnoCobrar && (
        <ModalCobro turno={turnoCobrar} onClose={() => setTurnoCobrar(null)} />
      )}
    </div>
  )
}
