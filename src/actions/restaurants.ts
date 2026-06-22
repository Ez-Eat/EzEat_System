'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getRestaurants, updateRestaurantStatus } from '@/lib/ezeat-client'
import { fetchBackend } from '@/lib/backend-registry'
import { RestaurantStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return session.user as { id: string; role: string }
}

function toDbStatus(s: string): RestaurantStatus {
  const map: Record<string, RestaurantStatus> = {
    active: RestaurantStatus.ACTIVE,
    inactive: RestaurantStatus.INACTIVE,
    suspended: RestaurantStatus.SUSPENDED,
  }
  return map[s.toLowerCase()] ?? RestaurantStatus.UNKNOWN
}

export async function listRestaurants() {
  await requireSession()

  // 1. Data viva de los backends que respondan (best-effort).
  let live: Awaited<ReturnType<typeof getRestaurants>> = []
  try {
    live = await getRestaurants()
    for (const r of live) {
      await prisma.restaurant.upsert({
        where: { ezeatId: r.id },
        update: { name: r.name, status: toDbStatus(r.status) },
        create: { ezeatId: r.id, name: r.name, status: toDbStatus(r.status) },
      })
    }
  } catch {
    // ignora: caemos al registro de Postgres
  }

  const liveById = new Map(live.map(r => [r.id, r]))

  // 2. Fuente de verdad = restaurantes registrados en Postgres.
  //    Aparecen aunque su backend esté caído (marcados con su último estado).
  const registered = await prisma.restaurant.findMany({ orderBy: { name: 'asc' } })

  return registered.map(r => {
    const l = liveById.get(r.ezeatId)
    return {
      id: r.ezeatId,
      ezeatId: r.ezeatId,
      name: l?.name ?? r.name,
      status: l?.status ?? r.status.toLowerCase(),
      plan: l?.plan ?? 'free',
      online: !!l,
    }
  })
}

export async function getRestaurantDetail(ezeatId: string) {
  await requireSession()
  return prisma.restaurant.findFirst({ where: { ezeatId } })
}

export async function patchRestaurantStatus(ezeatId: string, status: string) {
  const user = await requireSession()
  if (user.role !== 'ADMIN') throw new Error('Forbidden')
  await updateRestaurantStatus(ezeatId, status).catch(() => null)
  await prisma.restaurant.update({ where: { ezeatId }, data: { status: toDbStatus(status) } })
  revalidatePath('/restaurants')
}

export async function updateRestaurant(id: string, formData: FormData) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!session || user?.role !== 'ADMIN') throw new Error('Forbidden')

  const notes        = (formData.get('notes') as string) || null
  const domain       = (formData.get('domain') as string) || null
  const contactEmail = (formData.get('contactEmail') as string) || null
  const contactPhone = (formData.get('contactPhone') as string) || null
  const rawDate      = formData.get('paymentDate') as string | null
  const paymentDate  = rawDate ? new Date(rawDate) : null

  await prisma.restaurant.update({
    where: { id },
    data: { notes, domain, contactEmail, contactPhone, paymentDate },
  })
  revalidatePath(`/restaurants/${id}`)
  revalidatePath('/restaurants')
}

export async function createRestaurant(formData: FormData) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!session || user?.role !== 'ADMIN') throw new Error('Forbidden')

  const name          = (formData.get('name') as string)?.trim()
  const slug          = (formData.get('slug') as string)?.trim().toLowerCase()
  const ownerEmail    = (formData.get('ownerEmail') as string)?.trim().toLowerCase()
  const ownerPassword = (formData.get('ownerPassword') as string) || ''
  const plan          = (formData.get('plan') as string) || 'tier1'
  const primaryColor  = (formData.get('color') as string) || '#e02a36'
  const notes         = (formData.get('notes') as string) || null

  if (!name) throw new Error('Nombre requerido')
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error('Slug inválido (a-z, 0-9, guiones)')
  if (!ownerEmail) throw new Error('Correo del dueño requerido')
  if (!ownerPassword || ownerPassword.length < 6) throw new Error('Contraseña mín. 6 caracteres')

  const cfg = {
    baseUrl: process.env.EZEAT_API_URL || '',
    apiKey: process.env.EZEAT_API_KEY || '',
    label: 'saas',
  }
  if (!cfg.baseUrl || !cfg.apiKey) throw new Error('Backend SaaS no configurado (EZEAT_API_URL / EZEAT_API_KEY)')

  // Provisiona el tenant real en el backend SaaS (crea restaurante + dueño + features del tier)
  const result = await fetchBackend<{ success: boolean; restaurant: { id: string; slug: string; url: string } }>(
    cfg, '/internal/restaurants',
    { method: 'POST', body: JSON.stringify({ slug, name, ownerEmail, ownerPassword, plan, primaryColor }) }
  )

  // Registro local en EzEat System
  await prisma.restaurant.create({
    data: { name, ezeatId: result.restaurant.id, status: RestaurantStatus.ACTIVE, notes },
  })
  revalidatePath('/restaurants')
}
