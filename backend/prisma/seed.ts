import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.ts'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Datos reales confirmados con Franco (ver Docs/modelo-datos.md).
const SERVICIOS = [
  { nombre: 'Corte clásico', duracionMinutos: 30 },
  { nombre: 'Corte + Barba', duracionMinutos: 45 },
  { nombre: 'Color', duracionMinutos: 90 },
  { nombre: 'Barba', duracionMinutos: 20 },
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

async function main() {
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

  const { ADMIN_USUARIO, ADMIN_PASSWORD } = process.env
  if (ADMIN_USUARIO && ADMIN_PASSWORD) {
    const yaExiste = await prisma.administrador.findUnique({
      where: { usuario: ADMIN_USUARIO },
    })
    if (!yaExiste) {
      await prisma.administrador.create({
        data: {
          usuario: ADMIN_USUARIO,
          passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        },
      })
    }
  } else {
    console.log(
      'Sin ADMIN_USUARIO/ADMIN_PASSWORD en .env — se omite el seed de administrador.',
    )
  }

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
