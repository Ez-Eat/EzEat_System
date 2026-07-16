'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Trash2, Loader2, ExternalLink, Ban, Play, AlertTriangle, Search } from 'lucide-react'
import { deleteRestaurant, patchRestaurantStatus, purgeOrphanRecord, type SubdomainRow } from '@/actions/restaurants'

interface StatusStyle { label: string; bg: string; text: string; dot: string }

const ACTIVE_STYLE: StatusStyle = { label: 'Activo', bg: 'bg-teal-50', text: 'text-teal-700', dot: '#10B981' }

const STATUS: Record<string, StatusStyle> = {
  active:    ACTIVE_STYLE,
  unknown:   ACTIVE_STYLE,
  suspended: { label: 'Suspendido',  bg: 'bg-red-50',    text: 'text-red-600',    dot: '#EF4444' },
  inactive:  { label: 'Inactivo',    bg: 'bg-slate-100', text: 'text-slate-600',  dot: '#94A3B8' },
  orphan:    { label: 'Huérfano',    bg: 'bg-amber-50',  text: 'text-amber-700',  dot: '#F59E0B' },
}

export function SubdomainList({ rows }: { rows: SubdomainRow[] }) {
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [suspendFor, setSuspendFor] = useState<SubdomainRow | null>(null)
  const router = useRouter()

  const filtered = rows.filter(r =>
    `${r.name} ${r.slug} ${r.url}`.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(row: SubdomainRow) {
    const ok = confirm(
      `¿Eliminar "${row.name}" (${row.url})?\n\n` +
      `Se borra el negocio del SaaS: el subdominio deja de servir y muestra el aviso de "negocio no disponible".\n\n` +
      `No se puede deshacer.`
    )
    if (!ok) return
    setBusyId(row.ezeatId)
    try {
      const res = row.live ? await deleteRestaurant(row.ezeatId) : await purgeOrphanRecord(row.ezeatId)
      if (!res.ok) alert(res.error)
      else router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function handleReactivate(row: SubdomainRow) {
    setBusyId(row.ezeatId)
    try {
      const res = await patchRestaurantStatus(row.ezeatId, 'active')
      if (!res.ok) alert(res.error)
      else router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  const orphans = rows.filter(r => r.status === 'orphan').length
  const unregistered = rows.filter(r => r.unregistered).length

  return (
    <>
      {(orphans > 0 || unregistered > 0) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle size={15} /> Descuadre entre el panel y el SaaS
          </p>
          <ul className="mt-1.5 text-xs text-amber-700 space-y-0.5 list-disc list-inside">
            {unregistered > 0 && (
              <li><strong>{unregistered}</strong> {unregistered === 1 ? 'subdominio vive' : 'subdominios viven'} en el SaaS sin registro aquí: {unregistered === 1 ? 'está sirviendo' : 'están sirviendo'} sin que nadie lo controle.</li>
            )}
            {orphans > 0 && (
              <li><strong>{orphans}</strong> {orphans === 1 ? 'registro quedó' : 'registros quedaron'} sin tenant en el SaaS. Ya no {orphans === 1 ? 'sirve' : 'sirven'}; puedes limpiarlos.</li>
            )}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar subdominio o negocio..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <p className="ml-auto text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'subdominio' : 'subdominios'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="border-b border-slate-100">
              <tr>
                {['Subdominio', 'Negocio', 'Estado', 'Alta', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <Globe size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">Sin subdominios.</p>
                  </td>
                </tr>
              ) : filtered.map(row => {
                const cfg = STATUS[row.status] ?? ACTIVE_STYLE
                const busy = busyId === row.ezeatId
                return (
                  <tr key={row.ezeatId} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">{row.url || '—'}</span>
                        {row.live && row.url && (
                          <a href={`https://${row.url}`} target="_blank" rel="noreferrer"
                            className="text-slate-300 hover:text-slate-600 transition-colors" title="Abrir">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      {row.unregistered && (
                        <span className="mt-1 inline-block text-[10px] font-semibold text-amber-700">Sin registrar en el panel</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      {row.suspensionReason && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{row.suspensionReason}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.live && row.status !== 'suspended' && (
                          <button onClick={() => setSuspendFor(row)} disabled={busy} title="Suspender por incumplimiento"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50 cursor-pointer">
                            <Ban size={14} />
                          </button>
                        )}
                        {row.live && row.status === 'suspended' && (
                          <button onClick={() => handleReactivate(row)} disabled={busy} title="Reactivar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 cursor-pointer">
                            <Play size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(row)} disabled={busy}
                          title={row.live ? 'Eliminar del SaaS' : 'Limpiar registro huérfano'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer">
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {suspendFor && (
        <SuspendModal
          row={suspendFor}
          onClose={() => setSuspendFor(null)}
          onDone={() => { setSuspendFor(null); router.refresh() }}
        />
      )}
    </>
  )
}

/** Suspensión: motivo interno + mensaje que verá el negocio en su pantalla. */
function SuspendModal({ row, onClose, onDone }: { row: SubdomainRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res = await patchRestaurantStatus(row.ezeatId, 'suspended', {
      suspensionReason: reason,
      suspensionMessage: message,
    })
    setBusy(false)
    if (!res.ok) { alert(res.error); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Suspender {row.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bloquea tienda, POS, cocina y panel. Solo verán el aviso con nuestro contacto.
          </p>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
              Motivo interno
              <span className="ml-1.5 text-slate-400 normal-case font-normal text-[11px]">no lo ve el negocio</span>
            </label>
            <input value={reason} onChange={e => setReason(e.target.value)} autoFocus
              placeholder="ej. 2 mensualidades vencidas"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
              Mensaje para el negocio
              <span className="ml-1.5 text-slate-400 normal-case font-normal text-[11px]">opcional · vacío = texto por defecto</span>
            </label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder="Se muestra tal cual en su pantalla, junto al contacto de EzEat."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer">
              {busy ? 'Suspendiendo…' : 'Suspender negocio'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
