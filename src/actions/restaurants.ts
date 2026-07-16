'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  getRestaurants,
  updateRestaurantStatus,
  deleteRestaurant as deleteRestaurantBackend,
  getPlatformSettings,
  savePlatformSettings,
  type EzEatRestaurant,
  type PlatformSettings,
} from '@/lib/ezeat-client'
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

export interface SubdomainRow {
  ezeatId: string
  name: string
  slug: string
  url: string
  status: string
  plan: string
  createdAt: string | null
  suspendedAt: string | null
  suspensionReason: string
  /** true = el SaaS lo reporta vivo. false = solo queda el registro local (huérfano). */
  live: boolean
  /** true = vive en el SaaS pero nadie lo registró aquí. */
  unregistered: boolean
}

const ROOT_DOMAIN = process.env.EZEAT_ROOT_DOMAIN || 'ezeat.com.mx'

/**
 * Todos los subdominios que EXISTEN de verdad.
 *
 * La fuente de verdad es el SaaS (Restaurant.slug), no el registro de Postgres:
 * el subdominio sirve porque el tenant vive en Mongo, no porque haya una fila
 * aquí. Se cruzan ambos lados para que salten los dos casos peligrosos:
 *   - huérfano local: registrado aquí, ya no en el SaaS (nada que borrar).
 *   - sin registrar : vivo en el SaaS pero invisible en el panel — el caso que
 *     dejaba subdominios sirviendo sin que nadie supiera.
 */
export async function listSubdomains(): Promise<SubdomainRow[]> {
  await requireSession()

  let live: EzEatRestaurant[] = []
  let backendDown = false
  try {
    live = await getRestaurants()
  } catch {
    backendDown = true
  }

  const registered = await prisma.restaurant.findMany()
  const regByEzeatId = new Map(registered.map(r => [r.ezeatId, r]))
  const liveById = new Map(live.map(r => [r.id, r]))

  const rows: SubdomainRow[] = live.map(r => {
    const reg = regByEzeatId.get(r.id)
    return {
      ezeatId: r.id,
      name: r.name,
      slug: r.slug,
      url: reg?.domain || (r.slug ? `${r.slug}.${ROOT_DOMAIN}` : ''),
      status: r.status,
      plan: r.plan,
      createdAt: r.createdAt ?? null,
      suspendedAt: r.suspendedAt ?? null,
      suspensionReason: r.suspensionReason ?? '',
      live: true,
      unregistered: !reg,
    }
  })

  // Registros locales que el SaaS ya no reporta. Si el backend está caído no
  // sabemos nada, así que no los marcamos como huérfanos por error.
  if (!backendDown) {
    for (const reg of registered) {
      if (liveById.has(reg.ezeatId)) continue
      rows.push({
        ezeatId: reg.ezeatId,
        name: reg.name,
        slug: reg.domain?.split('.')[0] ?? '',
        url: reg.domain ?? '',
        status: 'orphan',
        plan: '—',
        createdAt: reg.createdAt.toISOString(),
        suspendedAt: null,
        suspensionReason: '',
        live: false,
        unregistered: false,
      })
    }
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

/** Quita un registro local huérfano (el tenant ya no existe en el SaaS). */
export async function purgeOrphanRecord(ezeatId: string): Promise<DeleteRestaurantResult> {
  const user = await requireSession()
  if (user.role !== 'ADMIN') return { ok: false, error: 'No autorizado' }

  // Verificar que de verdad esté muerto antes de borrar el registro: si el SaaS
  // responde, no es huérfano y borrarlo aquí lo dejaría sirviendo sin rastro.
  try {
    const live = await getRestaurants()
    if (live.some(r => r.id === ezeatId)) {
      return { ok: false, error: 'Este negocio SÍ existe en el SaaS. Usa Eliminar para darlo de baja de verdad.' }
    }
  } catch {
    return { ok: false, error: 'No se pudo confirmar con el SaaS. Intenta cuando el backend responda.' }
  }

  await prisma.restaurant.deleteMany({ where: { ezeatId } })
  revalidatePath('/subdominios')
  revalidatePath('/restaurants')
  return { ok: true }
}

export type DeleteRestaurantResult = { ok: true } | { ok: false; error: string }

export async function deleteRestaurant(ezeatId: string): Promise<DeleteRestaurantResult> {
  const user = await requireSession()
  if (user.role !== 'ADMIN') return { ok: false, error: 'No autorizado' }

  // El borrado del tenant real MANDA. Antes esto era best-effort (catch + log) y
  // se borraba el registro local igual: si el backend fallaba, el negocio
  // desaparecía del panel pero seguía vivo y sirviendo en su subdominio, sin
  // rastro de que existía. Si el SaaS no confirma, no se toca nada y se avisa.
  try {
    await deleteRestaurantBackend(ezeatId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Backend delete falló — se conserva el registro local:', msg)
    return {
      ok: false,
      error: `No se pudo eliminar el negocio en el SaaS, así que sigue activo. El registro se conservó para no perderlo de vista. Detalle: ${cleanBackendError(msg)}`,
    }
  }

  await prisma.restaurant.deleteMany({ where: { ezeatId } })

  revalidatePath('/restaurants')
  revalidatePath('/subdominios')
  return { ok: true }
}

export type StatusResult = { ok: true } | { ok: false; error: string }

/**
 * Cambia el estado del tenant. `suspended` bloquea el sistema del negocio y le
 * muestra el aviso de incumplimiento con el contacto de EzEat.
 *
 * El backend manda, igual que en el borrado: si el SaaS no confirma, no se marca
 * como suspendido en el panel — decir "suspendido" mientras el negocio sigue
 * vendiendo es peor que fallar.
 */
export async function patchRestaurantStatus(
  ezeatId: string,
  status: string,
  opts?: { suspensionReason?: string; suspensionMessage?: string }
): Promise<StatusResult> {
  const user = await requireSession()
  if (user.role !== 'ADMIN') return { ok: false, error: 'No autorizado' }

  try {
    await updateRestaurantStatus(ezeatId, status, opts)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `El SaaS no aplicó el cambio, el negocio sigue como estaba: ${cleanBackendError(msg)}` }
  }

  await prisma.restaurant.updateMany({ where: { ezeatId }, data: { status: toDbStatus(status) } })
  revalidatePath('/restaurants')
  revalidatePath('/subdominios')
  return { ok: true }
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

/** Contacto y textos que ve un negocio suspendido. Viven en el SaaS. */
export async function loadPlatformSettings(): Promise<PlatformSettings | null> {
  await requireSession()
  try {
    return await getPlatformSettings()
  } catch {
    return null
  }
}

export async function updatePlatformSettings(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireSession()
  if (user.role !== 'ADMIN') return { ok: false, error: 'No autorizado' }

  const str = (k: string) => ((formData.get(k) as string) ?? '').trim()
  const email = str('contactEmail')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Correo inválido' }

  try {
    await savePlatformSettings({
      contactEmail: email,
      contactPhone: str('contactPhone'),
      contactWhatsapp: str('contactWhatsapp'),
      suspensionMessage: str('suspensionMessage'),
      notFoundMessage: str('notFoundMessage'),
    })
  } catch (e) {
    return { ok: false, error: cleanBackendError(e instanceof Error ? e.message : 'Error al guardar') }
  }

  revalidatePath('/subdominios')
  return { ok: true }
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
  const secondaryColor = (formData.get('secondaryColor') as string) || '#5170ff'
  const welcomeMessage = (formData.get('welcomeMessage') as string)?.trim() || ''
  const logo          = formData.get('logo') as File | null
  const notes         = (formData.get('notes') as string)?.trim() || null
  // Detalles del negocio (registro local EzEat System) — guardados al crear
  const domain        = (formData.get('domain') as string)?.trim() || null
  const contactEmail  = (formData.get('contactEmail') as string)?.trim() || null
  const contactPhone  = (formData.get('contactPhone') as string)?.trim() || null
  const rawPayDate    = (formData.get('paymentDate') as string) || ''
  const paymentDate   = rawPayDate ? new Date(rawPayDate) : null

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
      { method: 'POST', body: JSON.stringify({ slug, name, ownerEmail, ownerPassword, plan, primaryColor, secondaryColor, welcomeMessage }) }
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

    // Registro local en EzEat System — con TODOS los detalles capturados al crear
    await prisma.restaurant.create({
      data: {
        name,
        ezeatId: result.restaurant.id,
        status: RestaurantStatus.ACTIVE,
        notes,
        domain: domain ?? `${slug}.ezeat.com.mx`,
        contactEmail: contactEmail ?? ownerEmail,
        contactPhone,
        paymentDate,
      },
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
