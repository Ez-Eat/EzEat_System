import { fetchFeatures, fetchPlans } from '@/actions/features'
import { FeaturesForm } from '@/components/restaurants/features-form'
import { PlanSelector } from '@/components/restaurants/plan-selector'
import type { FeatureFlag, PlanPreset } from '@/lib/features-client'
import { prisma } from '@/lib/db'
import { ArrowLeft, Sliders } from 'lucide-react'
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

  let features: FeatureFlag[] = []
  let plans: PlanPreset[] = []
  let error: string | null = null
  try {
    ;[features, plans] = await Promise.all([
      fetchFeatures(restaurant.ezeatId),
      fetchPlans(),
    ])
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
          <Sliders size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Funciones</h1>
          <p className="text-sm text-slate-500">{restaurant.name}</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-6 max-w-2xl">
        Activa o desactiva módulos para este restaurante de forma remota. Los cambios se aplican
        en el siguiente request del cliente — sin necesidad de tocar código ni redesplegar.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <p className="font-semibold mb-1">No se pudieron cargar las funciones</p>
          <p className="text-xs font-mono">{error}</p>
        </div>
      )}

      {plans.length > 0 && (
        <PlanSelector
          restaurantId={restaurant.ezeatId}
          prismaRestaurantId={id}
          plans={plans}
        />
      )}

      <FeaturesForm
        restaurantId={restaurant.ezeatId}
        prismaRestaurantId={id}
        initialFeatures={features}
      />
    </div>
  )
}
