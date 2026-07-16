import { redirect } from 'next/navigation'
import { Globe } from 'lucide-react'
import { listSubdomains, loadPlatformSettings } from '@/actions/restaurants'
import { SubdomainList } from '@/components/restaurants/subdomain-list'
import { PlatformContactForm } from '@/components/restaurants/platform-contact-form'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SubdomainsPage() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'ADMIN') redirect('/dashboard')

  const [rows, settings] = await Promise.all([listSubdomains(), loadPlatformSettings()])
  const live = rows.filter(r => r.live).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-slate-900" />
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Ez-eat</p>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Subdominios</h1>
            <p className="text-sm text-slate-500">
              Direcciones que están sirviendo ahora mismo. Aquí se suspenden y se dan de baja.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <Globe size={14} className="text-slate-400" />
          <span className="font-semibold">{live}</span> sirviendo
        </div>
      </div>

      <SubdomainList rows={rows} />
      <PlatformContactForm settings={settings} />
    </div>
  )
}
