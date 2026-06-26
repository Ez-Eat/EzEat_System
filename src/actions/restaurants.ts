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

export interface SaasMetrics {
  mrr: number
  arr: number
  currency: string
  tenants: { total: number; active: number; inactive: number; newThisMonth: number }
  churnRate: number
  byPlan: Record<string, number>
  perTenant: { id: string; name: string; slug: string; plan: string; active: boolean; mrr: number; orders30d: number; revenue30d: number }[]
}

export async function getSaasMetrics(): Promise<SaasMetrics | null> {
  await requireSession()
  const cfg = {
    baseUrl: process.env.EZEAT_API_URL || '',
    apiKey: process.env.EZEAT_API_KEY || '',
    label: 'saas',
  }
  if (!cfg.baseUrl || !cfg.apiKey) return null
  try {
    const res = await fetchBackend<{ success: boolean; data: SaasMetrics }>(cfg, '/internal/metrics', { revalidate: 60 })
    return res.data
  } catch {
    return null
  }
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

export type CreateRestaurantResult =
  | { ok: true; id: string; slug: string; url: string; plan: string }
  | { ok: false; error: string }

function cleanBackendError(msg: string): string {
  // Extrae el mensaje útil de "Backend saas 500: {json...}"
  const m = msg.match(/"message"\s*:\s*"([^"]+)"/)
  return m?.[1] ?? msg.replace(/^Backend \w+ \d+:\s*/, '')
}

export async function createRestaurant(formData: FormData): Promise<CreateRestaurantResult> {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!session || user?.role !== 'ADMIN') return { ok: false, error: 'No autorizado' }

  const name          = (formData.get('name') as string)?.trim()
  const slug          = (formData.get('slug') as string)?.trim().toLowerCase()
  const ownerEmail    = (formData.get('ownerEmail') as string)?.trim().toLowerCase()
  const ownerPassword = (formData.get('ownerPassword') as string) || ''
  const plan          = (formData.get('plan') as string) || 'tier1'
  const primaryColor  = (formData.get('color') as string) || '#2b49f3'
  const welcomeMessage = (formData.get('welcomeMessage') as string)?.trim() || ''
  const logo          = formData.get('logo') as File | null
  const notes         = (formData.get('notes') as string) || null

  if (!name) return { ok: false, error: 'Nombre requerido' }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: 'Slug inválido (a-z, 0-9, guiones)' }
  if (!ownerEmail) return { ok: false, error: 'Correo del dueño requerido' }
  if (!ownerPassword || ownerPassword.length < 6) return { ok: false, error: 'Contraseña mín. 6 caracteres' }

  const cfg = {
    baseUrl: process.env.EZEAT_API_URL || '',
    apiKey: process.env.EZEAT_API_KEY || '',
    label: 'saas',
  }
  if (!cfg.baseUrl || !cfg.apiKey) return { ok: false, error: 'Backend SaaS no configurado (EZEAT_API_URL / EZEAT_API_KEY)' }

  try {
    // Provisiona el tenant real en el backend SaaS (crea restaurante + dueño + features del tier)
    const result = await fetchBackend<{ success: boolean; restaurant: { id: string; slug: string; url: string } }>(
      cfg, '/internal/restaurants',
      { method: 'POST', body: JSON.stringify({ slug, name, ownerEmail, ownerPassword, plan, primaryColor, welcomeMessage }) }
    )

    // Logo (opcional): subida multipart al backend SaaS → S3 → branding.logoUrl
    if (logo && logo.size > 0) {
      const fd = new FormData()
      fd.append('logo', logo)
      const logoRes = await fetch(`${cfg.baseUrl}/internal/restaurants/${result.restaurant.id}/logo`, {
        method: 'PUT',
        headers: { 'x-api-key': cfg.apiKey }, // sin Content-Type: el boundary lo pone FormData
        body: fd,
        cache: 'no-store',
      })
      if (!logoRes.ok) {
        const txt = await logoRes.text().catch(() => '')
        // El negocio quedó creado; el logo se puede subir luego desde el panel.
        console.error('Logo no subido:', logoRes.status, txt.slice(0, 200))
      }
    }

    // Registro local en EzEat System
    await prisma.restaurant.create({
      data: { name, ezeatId: result.restaurant.id, status: RestaurantStatus.ACTIVE, notes },
    })
    revalidatePath('/restaurants')

    return {
      ok: true,
      id: result.restaurant.id,
      slug: result.restaurant.slug || slug,
      url: result.restaurant.url || `https://${slug}.ezeat.com.mx`,
      plan,
    }
  } catch (err) {
    return { ok: false, error: cleanBackendError(err instanceof Error ? err.message : 'Error al crear el negocio') }
  }
}
