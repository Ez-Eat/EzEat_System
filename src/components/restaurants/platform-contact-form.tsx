'use client'
import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { updatePlatformSettings } from '@/actions/restaurants'
import type { PlatformSettings } from '@/lib/ezeat-client'

/**
 * Contacto y textos del aviso que ve un negocio suspendido (o un subdominio
 * muerto). Viven en el SaaS, así que cambiarlos aquí pega en vivo sin redesplegar.
 */
export function PlatformContactForm({ settings }: { settings: PlatformSettings | null }) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!settings) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
        <p className="text-sm text-slate-500">
          No se pudo leer la configuración del SaaS. Revisa <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">EZEAT_API_URL</code> y{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">EZEAT_API_KEY</code>.
        </p>
      </div>
    )
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    const res = await updatePlatformSettings(new FormData(e.currentTarget))
    setBusy(false)
    if (!res.ok) { alert(res.error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">Aviso de suspensión</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Lo que ve un negocio bloqueado. Se guarda en el SaaS y pega en vivo, sin redesplegar.
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field name="contactEmail" label="Correo" defaultValue={settings.contactEmail} placeholder="soporte@ezeat.com.mx" type="email" />
          <Field name="contactWhatsapp" label="WhatsApp" defaultValue={settings.contactWhatsapp} placeholder="52 55 1234 5678" />
          <Field name="contactPhone" label="Teléfono" defaultValue={settings.contactPhone} placeholder="55 1234 5678" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
            Mensaje por defecto al suspender
          </label>
          <textarea name="suspensionMessage" rows={2} defaultValue={settings.suspensionMessage}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          <p className="text-[11px] text-slate-400 mt-1">Se usa cuando suspendes sin escribir un mensaje propio.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
            Mensaje de negocio inexistente
          </label>
          <textarea name="notFoundMessage" rows={2} defaultValue={settings.notFoundMessage}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          <p className="text-[11px] text-slate-400 mt-1">Lo ve quien abre un subdominio borrado o que nunca existió.</p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <span className="text-xs font-semibold text-teal-600">Guardado ✓</span>}
        </div>
      </div>
    </form>
  )
}

function Field({ name, label, defaultValue, placeholder, type = 'text' }: {
  name: string; label: string; defaultValue?: string; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">{label}</label>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
    </div>
  )
}
