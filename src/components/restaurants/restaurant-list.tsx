'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, Plus, X, Building2 } from 'lucide-react'
import { createRestaurant } from '@/actions/restaurants'
import { useRouter } from 'next/navigation'

interface Restaurant {
  id?: string
  ezeatId?: string
  name: string
  status: string
  plan?: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  ACTIVE:    { label: 'Activo',     dot: '#10B981', bg: 'bg-teal-50',   text: 'text-teal-700'  },
  active:    { label: 'Activo',     dot: '#10B981', bg: 'bg-teal-50',   text: 'text-teal-700'  },
  INACTIVE:  { label: 'Inactivo',   dot: '#94A3B8', bg: 'bg-slate-100', text: 'text-slate-600' },
  inactive:  { label: 'Inactivo',   dot: '#94A3B8', bg: 'bg-slate-100', text: 'text-slate-600' },
  SUSPENDED: { label: 'Suspendido', dot: '#EF4444', bg: 'bg-red-50',    text: 'text-red-600'   },
  suspended: { label: 'Suspendido', dot: '#EF4444', bg: 'bg-red-50',    text: 'text-red-600'   },
  UNKNOWN:   { label: 'Verificado', dot: '#10B981', bg: 'bg-green-50',  text: 'text-green-700' },
  unknown:   { label: 'Verificado', dot: '#10B981', bg: 'bg-green-50',  text: 'text-green-700' },
}

const PLAN_LABEL: Record<string, string> = {
  premium: 'Premium',
  basic:   'Básico',
  trial:   'Prueba',
  unknown: 'Básico',
}

const STATUS_FILTERS = ['Todos', 'Activo', 'Inactivo', 'Suspendido']
const PER_PAGE = 12

function matchStatus(s: string, filter: string) {
  if (filter === 'Todos') return true
  const map: Record<string, string[]> = {
    'Activo':     ['ACTIVE', 'active', 'UNKNOWN', 'unknown'],
    'Inactivo':   ['INACTIVE', 'inactive'],
    'Suspendido': ['SUSPENDED', 'suspended'],
  }
  return (map[filter] ?? []).includes(s)
}

export function RestaurantList({ restaurants, isAdmin }: { restaurants: Restaurant[]; isAdmin?: boolean }) {
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('Todos')
  const [page, setPage]             = useState(1)
  const [showModal, setShowModal]   = useState(false)
  const [creating, setCreating]     = useState(false)
  const formRef                     = useRef<HTMLFormElement>(null)
  const router                      = useRouter()

  const filtered = restaurants.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) && matchStatus(r.status, statusFilter)
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    const fd = new FormData(e.currentTarget)
    await createRestaurant(fd)
    setShowModal(false)
    setCreating(false)
    formRef.current?.reset()
    router.refresh()
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Filters bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar negocio..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { setStatus(f); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              Agregar negocio
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="border-b border-slate-100">
              <tr>
                {['ID', 'Nombre del negocio', 'Plan', 'Estado', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <Building2 size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">Sin resultados.</p>
                  </td>
                </tr>
              ) : (
                paged.map((r) => {
                  const id  = r.ezeatId ?? r.id ?? '???'
                  const cfg = STATUS_CONFIG[r.status] ?? { label: 'Activo', dot: '#10B981', bg: 'bg-teal-50', text: 'text-teal-700' }
                  return (
                    <tr key={id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">
                        #{id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{r.name}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {PLAN_LABEL[r.plan ?? 'unknown'] ?? r.plan ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/restaurants/${r.id ?? r.ezeatId}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          Ver detalle
                          <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {filtered.length === 0 ? 'Sin resultados' : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, filtered.length)} de ${filtered.length} negocios`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    page === p ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              {totalPages > 5 && <span className="text-xs text-slate-400 px-1">…</span>}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add restaurant modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Agregar negocio</h2>
                <p className="text-xs text-slate-500 mt-0.5">Registro manual en el sistema</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
                  Nombre del negocio
                </label>
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="ej. Tacos El Rey"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
                  Subdominio (slug)
                </label>
                <div className="flex items-center">
                  <input
                    name="slug"
                    required
                    placeholder="tacoselrey"
                    pattern="[a-z0-9\-]+"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-l-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <span className="px-3 py-2.5 border border-l-0 border-slate-200 rounded-r-lg bg-slate-50 text-sm text-slate-500">.ezeat.com.mx</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">Plan</label>
                  <select name="plan" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300">
                    <option value="tier1">Tier 1 — Operación</option>
                    <option value="tier2">Tier 2 — Operación + IA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">Color</label>
                  <input name="color" type="color" defaultValue="#e02a36" className="w-full h-[42px] px-1 py-1 border border-slate-200 rounded-lg cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">Correo del dueño</label>
                <input name="ownerEmail" type="email" required placeholder="dueno@correo.com" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">Contraseña del dueño</label>
                <input name="ownerPassword" type="text" required minLength={6} placeholder="mín. 6 caracteres" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
                  Notas internas
                  <span className="ml-1.5 text-slate-400 normal-case font-normal text-[11px]">opcional</span>
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Contexto, contacto, observaciones..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {creating ? 'Creando...' : 'Crear negocio'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
