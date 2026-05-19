import { fetchProviders } from '@/actions/payment-providers'
import { PaymentProvidersForm } from '@/components/restaurants/payment-providers-form'
import type { PaymentProviderInfo } from '@/lib/payment-providers-client'
import { prisma } from '@/lib/db'
import { ArrowLeft, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { name: true, ezeatId: true },
  })
  if (!restaurant) notFound()

  let providers: PaymentProviderInfo[] = []
  let error: string | null = null
  try {
    providers = await fetchProviders(restaurant.ezeatId)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido'
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href={`/restaurants/${id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft size={16} /> Volver al restaurante
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
          <CreditCard size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Métodos de Pago</h1>
          <p className="text-sm text-slate-500">{restaurant.name}</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-6 max-w-2xl">
        Activa o desactiva los proveedores de pago disponibles para este restaurante. Cada uno usa
        las credenciales propias del restaurante (no las de Ez-eat). Las credenciales se almacenan
        encriptadas (AES-256-GCM) en la base de datos del backend.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <p className="font-semibold mb-1">No se pudieron cargar los proveedores</p>
          <p className="text-xs font-mono">{error}</p>
        </div>
      )}

      <PaymentProvidersForm restaurantId={restaurant.ezeatId} providers={providers} />
    </div>
  )
}
