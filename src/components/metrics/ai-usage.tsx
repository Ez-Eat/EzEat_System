import { Sparkles, AlertTriangle } from 'lucide-react'
import type { AiUsageReport } from '@/actions/restaurants'

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`
const tokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n)

/**
 * Consumo de IA del SaaS: total del período, desglose por negocio y por modelo.
 *
 * El costo es ESTIMADO (tokens x precio lista). La cifra que factura es la de
 * AWS; esto sirve para repartir el gasto entre negocios y detectar quién se
 * dispara, que es justo lo que no se podía ver antes.
 */
export function AiUsageSection({ usage }: { usage: AiUsageReport | null }) {
  if (!usage) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-900">Consumo de IA</h2>
        </div>
        <p className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={14} /> No se pudo leer el consumo del SaaS.
        </p>
      </div>
    )
  }

  const { total, byRestaurant, byModel, range } = usage
  const max = Math.max(1, ...byRestaurant.map((r) => r.estimatedCostUsd))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-900">Consumo de IA</h2>
        </div>
        <span className="text-xs text-slate-400">{range.from} → {range.to}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Costo estimado" value={usd(total.estimatedCostUsd)} accent="text-emerald-600" />
        <Stat label="Llamadas" value={total.calls.toLocaleString('es-MX')} />
        <Stat label="Tokens entrada" value={tokens(total.inputTokens)} />
        <Stat label="Tokens salida" value={tokens(total.outputTokens)} />
      </div>

      {byRestaurant.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">
          Sin consumo en el período. Se registra en cuanto un negocio use la IA.
        </p>
      ) : (
        <>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Por negocio</p>
          <div className="space-y-1.5 mb-5">
            {byRestaurant.map((r) => (
              <div key={r.restaurantId ?? 'none'} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-slate-700" title={r.name}>
                  {r.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${Math.max(2, (r.estimatedCostUsd / max) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm font-semibold text-slate-900 tabular-nums">
                  {usd(r.estimatedCostUsd)}
                </span>
                <span className="w-24 shrink-0 text-right text-xs text-slate-400 tabular-nums">
                  {r.calls} · {tokens(r.inputTokens + r.outputTokens)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {byModel.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Por modelo</p>
          <div className="flex flex-wrap gap-2">
            {byModel.map((m) => (
              <span
                key={`${m.provider}:${m.model}`}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600"
              >
                {m.model.replace(/^us\./, '')}{' '}
                <span className="font-bold text-slate-900">{usd(m.estimatedCostUsd)}</span>
                <span className="text-slate-400"> · {m.calls}</span>
              </span>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        Costo estimado con precio lista ({process.env.NEXT_PUBLIC_AI_PRICE_NOTE || '$1 / $5 por millón de tokens'}).
        La cifra que factura es la de AWS.
      </p>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
