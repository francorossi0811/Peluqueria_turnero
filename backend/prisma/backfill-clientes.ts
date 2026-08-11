// HU-25 — Crea las fichas de los turnos que ya existían antes de esta etapa.
//
// Se corre una sola vez por base, con `npm run backfill:clientes`. Es idempotente: los
// turnos que ya tienen ficha no se vuelven a tocar, así que correrlo dos veces no duplica
// nada y sirve para completar lo que haya entrado en el medio.
//
// **Por qué es un script TypeScript y no SQL dentro de la migración:** la identidad de un
// cliente es su teléfono pasado a E.164, y esa traducción vive en `utils/telefono.ts`
// apoyada en `libphonenumber-js`. Reescribirla en SQL sería reimplementar el caso que
// justamente nos hizo elegir la librería —dónde termina la característica argentina— con
// otro lenguaje y otra chance de equivocarse. Que la migración cree las tablas vacías y
// los datos los llene esto es la separación correcta.
//
// Recorre del turno más viejo al más nuevo a propósito: `nombre` se pisa en cada paso, así
// que al final queda el del turno más reciente, que es la regla de la ficha.

import 'dotenv/config'
import { prisma } from '../src/config/prisma'
import { aE164 } from '../src/utils/telefono'

async function main() {
  const turnos = await prisma.turno.findMany({
    where: { clienteId: null, clienteTelefono: { not: null } },
    select: { id: true, clienteNombre: true, clienteTelefono: true },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })

  console.log(`${turnos.length} turnos sin ficha y con teléfono.`)

  let vinculados = 0
  const ilegibles: string[] = []
  const fichas = new Map<string, string>()

  for (const turno of turnos) {
    const e164 = aE164(turno.clienteTelefono!)
    if (!e164) {
      // No se tira el turno ni se inventa una ficha: se informa. Un número que la
      // librería no puede interpretar suele ser un error de tipeo, y Ariel puede
      // corregirlo desde el panel — ahí la ficha se crea sola.
      ilegibles.push(`${turno.clienteNombre} · ${turno.clienteTelefono}`)
      continue
    }

    let clienteId = fichas.get(e164)
    if (!clienteId) {
      const cliente = await prisma.cliente.upsert({
        where: { telefonoE164: e164 },
        create: { telefonoE164: e164, nombre: turno.clienteNombre },
        update: { nombre: turno.clienteNombre },
        select: { id: true },
      })
      clienteId = cliente.id
      fichas.set(e164, clienteId)
    } else {
      await prisma.cliente.update({
        where: { id: clienteId },
        data: { nombre: turno.clienteNombre },
      })
    }

    await prisma.turno.update({ where: { id: turno.id }, data: { clienteId } })
    vinculados++
  }

  console.log(`${vinculados} turnos vinculados a ${fichas.size} fichas.`)

  if (ilegibles.length > 0) {
    console.log(
      `\n${ilegibles.length} turnos con un teléfono que no se pudo interpretar (quedan sin ficha):`,
    )
    for (const linea of ilegibles) console.log(`  · ${linea}`)
  }

  const sinTelefono = await prisma.turno.count({
    where: { clienteTelefono: null },
  })
  if (sinTelefono > 0) {
    console.log(
      `\n${sinTelefono} turnos no tienen teléfono (HU-08), así que tampoco tienen ficha. Se enganchan solos en cuanto Ariel les cargue el número desde el panel.`,
    )
  }

  await prisma.$disconnect()
}

void main()
