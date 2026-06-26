import { CreateRestaurantForm } from '@/components/restaurants/create-restaurant-form'
import { auth } from '@/lib/auth'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NewRestaurantPage() {
  const session = await auth()
  if ((session?.user as { role?: string })?.role !== 'ADMIN') redirect('/restaurants')

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Link href="/restaurants" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft size={16} /> Volver a negocios
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-slate-900" />
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Ez-eat</p>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Crear negocio desde cero</h1>
            <p className="text-sm text-slate-500">Provisiona un tenant nuevo en el SaaS: subdominio, plan, marca y dueño.</p>
          </div>
        </div>
      </div>

      <CreateRestaurantForm />
    </div>
  )
}
