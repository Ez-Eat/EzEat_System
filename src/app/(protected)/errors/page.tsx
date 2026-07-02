import { fetchBackend } from '@/lib/backend-registry'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AlertTriangle, Bug } from 'lucide-react'
import { ResolveErrorButton } from '@/components/errors/resolve-error-button'

export const dynamic = 'force-dynamic'

interface ErrorRow {
  _id: string
  message: string
  stack: string
  method: string
  path: string
  source: string
  restaurantSlug: string
  count: number
  lastSeen: string
  resolved: boolean
}

async function getErrors(): Promise<ErrorRow[] | null> {
  const cfg = {
    baseUrl: process.env.EZEAT_API_URL || '',
    apiKey: process.env.EZEAT_API_KEY || '',
    label: 'saas',
  }
  if (!cfg.baseUrl || !cfg.apiKey) return null
  try {
    const res = await fetchBackend<{ success: boolean; data: ErrorRow[] }>(cfg, '/internal/errors?resolved=false')
    return res.data ?? []
  } catch {
    return null
  }
}

export default async function ErrorsPage() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'ADMIN') redirect('/dashboard')

  const errors = await getErrors()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 rounded-full bg-slate-900" />
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Ez-eat</p>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Errores del sistema</h1>
          <p className="text-sm text-slate-500">Autolog del servidor: errores detectados en producción, deduplicados por causa.</p>
        </div>
      </div>

      {errors === null ? (
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertTriangle size={16} /> No se pudo conectar al backend SaaS.
        </div>
      ) : errors.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Bug size={36} className="text-emerald-400 mb-3" />
          <p className="font-semibold text-slate-700">Sin errores activos</p>
          <p className="text-sm text-slate-400">Todo el sistema opera con normalidad.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map((e) => (
            <details key={e._id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <summary className="px-5 py-4 cursor-pointer flex items-center justify-between gap-3 list-none">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{e.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {e.method} {e.path} {e.restaurantSlug && `· ${e.restaurantSlug}`} · {e.source} · última: {new Date(e.lastSeen).toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${e.count > 10 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>×{e.count}</span>
                  <ResolveErrorButton id={e._id} />
                </div>
              </summary>
              <pre className="px-5 pb-4 text-[11px] text-slate-500 overflow-x-auto whitespace-pre-wrap border-t border-slate-100 pt-3 bg-slate-50/50">{e.stack || 'Sin stack trace'}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
