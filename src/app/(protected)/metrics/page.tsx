import { getSaasMetrics } from '@/actions/restaurants'
import { BarChart3, TrendingUp, Users, UserCheck, UserX, AlertTriangle } from 'lucide-react'

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0 })} MXN`

export default async function MetricsPage() {
  const m = await getSaasMetrics()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 rounded-full bg-slate-900" />
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Ez-eat</p>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Métricas del SaaS</h1>
          <p className="text-sm text-slate-500">Ingresos, tenants y uso de la plataforma.</p>
        </div>
      </div>

      {!m ? (
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertTriangle size={16} /> No se pudo cargar métricas. Revisa EZEAT_API_URL / EZEAT_API_KEY.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={TrendingUp} label="MRR" value={money(m.mrr)} hint={`ARR ${money(m.arr)}`} accent="text-emerald-600" />
            <Kpi icon={Users} label="Tenants" value={String(m.tenants.total)} hint={`+${m.tenants.newThisMonth} este mes`} />
            <Kpi icon={UserCheck} label="Activos" value={String(m.tenants.active)} accent="text-emerald-600" />
            <Kpi icon={UserX} label="Inactivos" value={String(m.tenants.inactive)} hint={`Churn ${m.churnRate}%`} accent="text-rose-600" />
          </div>

          {/* Por plan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-slate-400" />
              <h2 className="font-semibold text-slate-900">Por plan</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(m.byPlan).map(([plan, count]) => (
                <span key={plan} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  {plan} <span className="font-bold text-slate-900">{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Uso por tenant */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Uso por negocio (30 días)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    {['Negocio', 'Plan', 'Estado', 'MRR', 'Órdenes 30d', 'Ingreso 30d'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.perTenant.map(t => (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{t.name}<span className="text-slate-400 font-normal"> · {t.slug}</span></td>
                      <td className="px-4 py-2.5 text-slate-600">{t.plan}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                          {t.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{money(t.mrr)}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{t.orders30d}</td>
                      <td className="px-4 py-2.5 text-slate-600">{money(t.revenue30d)}</td>
                    </tr>
                  ))}
                  {m.perTenant.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Sin negocios registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: React.ElementType; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        <Icon size={13} />
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent || 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}
