import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    console.warn('SEED_ADMIN_EMAIL/PASSWORD no definidos — saltando creación de admin')
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Admin user already exists: ${email}`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      role: 'ADMIN',
      passwordHash,
    },
  })
  console.log(`Admin user created: ${email}`)
}

/**
 * NO se siembran Backends a propósito.
 *
 * Esto sembraba dos instancias hardcodeadas de la "Opción A multi-instancia"
 * (un backend Ez-eat por restaurante): QueFresa y tacoshabanas.ezeat.com.mx.
 * Esa arquitectura quedó atrás — hoy UN SaaS multi-tenant sirve a todos los
 * negocios y el System le pega por EZEAT_API_URL.
 *
 * El daño no era cosmético: getRestaurants() usa los Backend registrados y solo
 * cae a EZEAT_API_URL cuando NO hay ninguno. Al sembrarlos, el panel consultaba
 * un backend muerto (tacoshabanas se dio de baja) e ignoraba el SaaS real, así
 * que el directorio de negocios salía vacío o incompleto. Se detectó el
 * 2026-07-16 al reconstruir la base y hubo que borrarlos a mano.
 *
 * Registra un Backend SOLO si de verdad levantas una instancia aparte, y hazlo
 * desde el panel con sus datos reales, no desde el seed.
 */
main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
