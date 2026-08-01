import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.ts'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

// Singleton: evita abrir una conexión nueva por cada hot-reload en desarrollo.
export const prisma = new PrismaClient({ adapter })
