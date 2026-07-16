import { prisma } from '@/lib/db'
import { resolveBackendByEzeatId, fetchBackend, type BackendConfig } from '@/lib/backend-registry'

export interface EzEatRestaurant {
  id: string
  name: string
  slug: string
  /** active | suspended | inactive | unknown */
  status: string
  plan: string
  createdAt: string
  suspendedAt?: string | null
  suspensionReason?: string
  /** Etiqueta de la instancia backend de origen (multi-instancia) */
  backendLabel?: string
}

/**
 * Lista restaurantes consolidando TODAS las instancias backend registradas
 * (Opción A multi-instancia). Cada backend reporta su propio restaurante.
 * Fallback: si no hay backends registrados, usa env EZEAT_API_URL/KEY.
 */
export async function getRestaurants(): Promise<EzEatRestaurant[]> {
  const backends = await prisma.backend.findMany({ where: { active: true } })

  const configs: BackendConfig[] = backends.length
    ? backends.map(b => ({ baseUrl: b.baseUrl, apiKey: b.apiKey, label: b.label }))
    : process.env.EZEAT_API_URL && process.env.EZEAT_API_KEY
      ? [{ baseUrl: process.env.EZEAT_API_URL, apiKey: process.env.EZEAT_API_KEY, label: 'env-fallback' }]
      : []

  if (!configs.length) throw new Error('No hay backends configurados')

  const results = await Promise.allSettled(
    configs.map(cfg =>
      fetchBackend<{ success: boolean; data: EzEatRestaurant[] }>(cfg, '/internal/restaurants', { revalidate: 300 })
        .then(res => (res.data ?? []).map(r => ({ ...r, backendLabel: cfg.label })))
    )
  )

  return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
}

export async function getRestaurant(ezeatId: string): Promise<EzEatRestaurant> {
  const backend = await resolveBackendByEzeatId(ezeatId)
  return fetchBackend<EzEatRestaurant>(backend, `/internal/restaurants/${ezeatId}`)
}

export async function updateRestaurantStatus(
  ezeatId: string,
  status: string,
  opts?: { suspensionReason?: string; suspensionMessage?: string }
): Promise<void> {
  const backend = await resolveBackendByEzeatId(ezeatId)
  await fetchBackend(backend, `/internal/restaurants/${ezeatId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...opts }),
    revalidate: 0,
  })
}

export interface PlatformSettings {
  contactEmail: string
  contactPhone: string
  contactWhatsapp: string
  suspensionMessage: string
  notFoundMessage: string
}

function saasConfig(): BackendConfig | null {
  const baseUrl = process.env.EZEAT_API_URL || ''
  const apiKey = process.env.EZEAT_API_KEY || ''
  return baseUrl && apiKey ? { baseUrl, apiKey, label: 'saas' } : null
}

/** Contacto/textos que ve un negocio suspendido. Viven en el SaaS; aquí se editan. */
export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  const cfg = saasConfig()
  if (!cfg) return null
  const res = await fetchBackend<{ success: boolean; data: PlatformSettings }>(cfg, '/internal/platform-settings', { revalidate: 0 })
  return res.data
}

export async function savePlatformSettings(patch: Partial<PlatformSettings>): Promise<void> {
  const cfg = saasConfig()
  if (!cfg) throw new Error('Backend SaaS no configurado (EZEAT_API_URL / EZEAT_API_KEY)')
  await fetchBackend(cfg, '/internal/platform-settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
    revalidate: 0,
  })
}

export async function deleteRestaurant(ezeatId: string): Promise<void> {
  const backend = await resolveBackendByEzeatId(ezeatId)
  await fetchBackend(backend, `/internal/restaurants/${ezeatId}`, {
    method: 'DELETE',
    revalidate: 0,
  })
}
