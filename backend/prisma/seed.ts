import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Datos reales confirmados con Franco (ver Docs/modelo-datos.md). El `orden` es el de
// exhibición al cliente, del servicio más pedido al menos pedido.
const SERVICIOS = [
  { nombre: 'Corte clásico', duracionMinutos: 30, orden: 1 },
  { nombre: 'Corte + Barba', duracionMinutos: 45, orden: 2 },
  { nombre: 'Barba', duracionMinutos: 20, orden: 3 },
  // "Color" vivía acá con orden 4. Se sacó el 14/8/2026 junto con la migración que borra
  // la fila: Ariel no ofrece más ese servicio. ⚠️ Las dos cosas hacen falta — este seed
  // busca por nombre y crea el que no encuentra, así que dejarlo acá lo resucitaría en el
  // próximo `npm run seed`, y encima activo y sin foto.
]

function hora(h: number, m = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, h, m))
}

// 0=domingo … 6=sábado. Martes a sábado, mañana 10-13 y tarde 17-20 (sábado 17-20:30).
const HORARIO_LABORAL = [
  { diaSemana: 2, horaInicio: hora(10), horaFin: hora(13) },
  { diaSemana: 2, horaInicio: hora(17), horaFin: hora(20) },
  { diaSemana: 3, horaInicio: hora(10), horaFin: hora(13) },
  { diaSemana: 3, horaInicio: hora(17), horaFin: hora(20) },
  { diaSemana: 4, horaInicio: hora(10), horaFin: hora(13) },
  { diaSemana: 4, horaInicio: hora(17), horaFin: hora(20) },
  { diaSemana: 5, horaInicio: hora(10), horaFin: hora(13) },
  { diaSemana: 5, horaInicio: hora(17), horaFin: hora(20) },
  { diaSemana: 6, horaInicio: hora(10), horaFin: hora(13) },
  { diaSemana: 6, horaInicio: hora(17), horaFin: hora(20, 30) },
]

const COSTO_BCRYPT = 10

/**
 * Avisa cuando la contraseña del `.env` no es la que tiene la cuenta en la base.
 *
 * **El seed nunca pisa la contraseña de una cuenta que ya existe, y eso no va a cambiar:**
 * si lo hiciera, volver a correrlo en producción le resetearía la contraseña a Ariel a la
 * que quedó vieja en una variable de entorno. Lo que sí cambia es que deje de hacerlo en
 * silencio.
 *
 * Pasó de verdad: se cambió `SUPER_ADMIN_PASSWORD` en el `.env` esperando que eso cambiara
 * la contraseña, el seed no dijo nada, y el login empezó a rechazar la contraseña "nueva"
 * sin ninguna pista de por qué.
 */
async function avisarSiLaPasswordNoCoincide(
  cuenta: { usuario: string; passwordHash: string },
  passwordDelEnv: string,
) {
  if (await bcrypt.compare(passwordDelEnv, cuenta.passwordHash)) return

  console.warn(
    `\n⚠️  La cuenta "${cuenta.usuario}" ya existía y su contraseña NO es la del .env.\n` +
      `   El seed nunca pisa la contraseña de una cuenta ya creada — si lo hiciera, correrlo\n` +
      `   en producción le resetearía la contraseña a quien la haya cambiado desde el panel.\n` +
      `   Para cambiarla: entrá con la contraseña vieja y usá "Mi cuenta", o pedile al\n` +
      `   administrador general que te la fije desde "Administradores".\n`,
  )
}

/**
 * Las cuentas del panel (HU-15, HU-26).
 *
 * Hace tres cosas, y las tres son idempotentes — se puede correr todas las veces que haga
 * falta sin pisar nada:
 *
 * 1. Crea la cuenta de Ariel si no existe (lo de siempre).
 * 2. **Le carga el email a la cuenta que ya existía**, si todavía no lo tiene. Esto es lo
 *    que hace que el cambio de "entrar con usuario" a "entrar con email" no deje a nadie
 *    afuera: la columna se agregó nullable, y sin este paso la única cuenta de la base no
 *    tendría con qué loguearse. Por eso el seed avisa fuerte cuando falta `ADMIN_EMAIL`.
 * 3. Crea la cuenta super admin de Franco, si están sus variables.
 *
 * Ninguna contraseña vive en el repo: todo sale de `backend/.env`, que está gitignoreado.
 * `.env.example` solo lista los nombres.
 */
async function seedAdministradores() {
  const {
    ADMIN_USUARIO,
    ADMIN_PASSWORD,
    ADMIN_EMAIL,
    SUPER_ADMIN_USUARIO,
    SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_EMAIL,
  } = process.env

  if (ADMIN_USUARIO && ADMIN_PASSWORD) {
    const existente = await prisma.administrador.findUnique({
      where: { usuario: ADMIN_USUARIO },
    })

    if (!existente) {
      await prisma.administrador.create({
        data: {
          usuario: ADMIN_USUARIO,
          email: ADMIN_EMAIL,
          rol: 'admin',
          passwordHash: await bcrypt.hash(ADMIN_PASSWORD, COSTO_BCRYPT),
        },
      })
    } else {
      if (!existente.email && ADMIN_EMAIL) {
        // La cuenta ya estaba y le falta el email: se lo cargamos sin tocar la contraseña.
        await prisma.administrador.update({
          where: { id: existente.id },
          data: { email: ADMIN_EMAIL },
        })
        console.log(
          `Email cargado en la cuenta "${ADMIN_USUARIO}": ${ADMIN_EMAIL}`,
        )
      }
      await avisarSiLaPasswordNoCoincide(existente, ADMIN_PASSWORD)
    }
  } else {
    console.log(
      'Sin ADMIN_USUARIO/ADMIN_PASSWORD en .env — se omite el seed de administrador.',
    )
  }

  if (SUPER_ADMIN_USUARIO && SUPER_ADMIN_PASSWORD && SUPER_ADMIN_EMAIL) {
    const yaExiste = await prisma.administrador.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
    })
    if (!yaExiste) {
      await prisma.administrador.create({
        data: {
          usuario: SUPER_ADMIN_USUARIO,
          email: SUPER_ADMIN_EMAIL,
          rol: 'super_admin',
          passwordHash: await bcrypt.hash(SUPER_ADMIN_PASSWORD, COSTO_BCRYPT),
        },
      })
      console.log(`Cuenta super admin creada: ${SUPER_ADMIN_EMAIL}`)
    } else {
      await avisarSiLaPasswordNoCoincide(yaExiste, SUPER_ADMIN_PASSWORD)
    }
  }

  // El aviso más importante del seed: una cuenta sin email no puede entrar al panel,
  // porque el login es por email desde HU-26.
  const sinEmail = await prisma.administrador.findMany({
    where: { email: null },
    select: { usuario: true },
  })
  if (sinEmail.length > 0) {
    console.warn(
      `\n⚠️  ${sinEmail.length} cuenta(s) sin email y por lo tanto SIN PODER ENTRAR: ${sinEmail
        .map((a) => a.usuario)
        .join(', ')}\n   Cargá ADMIN_EMAIL en backend/.env y volvé a correr el seed.\n`,
    )
  }
}

/** Color inicial de la etiqueta automática. Azul: es el único de la paleta de insignias que
 * no choca con los tres estados del turno (miel, verde, rojo). Ariel lo puede cambiar. */
const AZUL_CLIENTE_NUEVO = '#2d8cff'
const CLAVE_CLIENTE_NUEVO = 'cliente_nuevo'

/**
 * Asegura la etiqueta que el sistema le pone solo a las fichas nuevas (HU-25).
 *
 * Tres caminos, y el del medio es el que importa: si ya hay una etiqueta que Ariel creó a
 * mano para esto, **se la adopta** poniéndole la clave, en vez de crear una segunda con un
 * nombre parecido. Es exactamente lo que pasó en desarrollo, donde ya existía una "nuevo"
 * azul antes de que el automatismo estuviera hecho.
 */
async function seedEtiquetaClienteNuevo() {
  const porClave = await prisma.etiqueta.findUnique({
    where: { clave: CLAVE_CLIENTE_NUEVO },
  })
  if (porClave) return

  const porNombre = await prisma.etiqueta.findFirst({
    where: { nombre: { equals: 'nuevo', mode: 'insensitive' } },
  })

  if (porNombre) {
    await prisma.etiqueta.update({
      where: { id: porNombre.id },
      data: { clave: CLAVE_CLIENTE_NUEVO },
    })
    console.log(
      `Etiqueta "${porNombre.nombre}" adoptada como la automática de cliente nuevo.`,
    )
    return
  }

  await prisma.etiqueta.create({
    data: {
      nombre: 'Nuevo',
      color: AZUL_CLIENTE_NUEVO,
      clave: CLAVE_CLIENTE_NUEVO,
    },
  })
  console.log('Etiqueta "Nuevo" creada.')
}

async function main() {
  await seedEtiquetaClienteNuevo()

  for (const servicio of SERVICIOS) {
    const existe = await prisma.servicio.findFirst({
      where: { nombre: servicio.nombre },
    })
    if (!existe) await prisma.servicio.create({ data: servicio })
  }

  const yaTieneHorario = await prisma.horarioLaboral.findFirst()
  if (!yaTieneHorario) {
    await prisma.horarioLaboral.createMany({ data: HORARIO_LABORAL })
  }

  await seedAdministradores()

  console.log('Seed listo:', {
    servicios: await prisma.servicio.count(),
    franjas: await prisma.horarioLaboral.count(),
    administradores: await prisma.administrador.count(),
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
