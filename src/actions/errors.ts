'use server'
import { auth } from '@/lib/auth'
import { fetchBackend } from '@/lib/backend-registry'

export async function resolveError(id: string): Promise<{ ok: boolean }> {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'ADMIN') return { ok: false }
  const cfg = {
    baseUrl: process.env.EZEAT_API_URL || '',
    apiKey: process.env.EZEAT_API_KEY || '',
    label: 'saas',
  }
  if (!cfg.baseUrl || !cfg.apiKey) return { ok: false }
  try {
    await fetchBackend(cfg, `/internal/errors/${id}`, { method: 'PATCH', body: JSON.stringify({ resolved: true }) })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
