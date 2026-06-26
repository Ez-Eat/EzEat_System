'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createRestaurant } from '@/actions/restaurants'
import { Store, Globe, Palette, Image as ImageIcon, Mail, Lock, Check, Loader2, ArrowRight, Copy, ExternalLink } from 'lucide-react'

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

type Created = { url: string; slug: string; plan: string }

export function CreateRestaurantForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [plan, setPlan] = useState('tier1')
  const [showPass, setShowPass] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.set('slug', slug)
      fd.set('plan', plan)
      const res = await createRestaurant(fd)
      setCreated({ url: res.url, slug: res.slug, plan: res.plan })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el negocio')
    } finally {
      setCreating(false)
    }
  }

  if (created) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <Check className="text-emerald-600" size={26} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Negocio creado</h2>
        <p className="text-sm text-slate-500 mb-5">Tenant provisionado en el SaaS con su dueño y las funciones del plan {created.plan}.</p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">URL del negocio</p>
            <div className="flex items-center gap-2">
              <a href={created.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 break-all">
                {created.url} <ExternalLink size={13} />
              </a>
              <button onClick={() => navigator.clipboard.writeText(created.url)} className="p-1 text-slate-400 hover:text-slate-700"><Copy size={13} /></button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Acceso del dueño</p>
            <p className="text-sm text-slate-700 font-mono">{ownerEmail}</p>
            <p className="text-sm text-slate-700 font-mono">{ownerPassword}</p>
            <p className="text-[11px] text-amber-600 mt-1">Comparte estas credenciales con el dueño. No se vuelven a mostrar.</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => router.push('/restaurants')} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800">Ver negocios</button>
          <button onClick={() => { setCreated(null); setSlug(''); setSlugTouched(false); setPlan('tier1'); setOwnerEmail(''); setOwnerPassword(''); formRef.current?.reset() }} className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">Crear otro</button>
        </div>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}

      {/* Identidad */}
      <Section icon={Store} title="Identidad del negocio">
        <Field label="Nombre del negocio" required>
          <input name="name" required autoFocus placeholder="Ej. Tacos El Rey"
            onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)) }}
            className={inputCls} />
        </Field>
        <Field label="Subdominio (slug)" required hint="Solo minúsculas, números y guiones.">
          <div className="flex items-center">
            <span className="text-slate-400 mr-1"><Globe size={14} /></span>
            <input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} required placeholder="tacoselrey"
              className={`${inputCls} rounded-r-none`} />
            <span className="px-3 py-2.5 border border-l-0 border-slate-200 rounded-r-lg bg-slate-50 text-sm text-slate-500 whitespace-nowrap">.ezeat.com.mx</span>
          </div>
        </Field>
      </Section>

      {/* Plan */}
      <Section icon={ArrowRight} title="Plan">
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: 'tier1', t: 'Tier 1 — Operación', d: 'POS, cocina, kiosko, inventario, finanzas', p: '$599' },
            { v: 'tier2', t: 'Tier 2 — Operación + IA', d: 'Todo + IA, canales, contabilidad, predicción', p: '$1,799' },
          ].map((o) => (
            <button type="button" key={o.v} onClick={() => setPlan(o.v)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${plan === o.v ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">{o.t}</p>
                {plan === o.v && <Check size={15} className="text-slate-900" />}
              </div>
              <p className="text-xs text-slate-500 mt-1">{o.d}</p>
              <p className="text-sm font-bold text-slate-900 mt-2">{o.p}<span className="text-xs font-normal text-slate-400"> /mes</span></p>
            </button>
          ))}
        </div>
      </Section>

      {/* Marca */}
      <Section icon={Palette} title="Marca" optional>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Color">
            <input name="color" type="color" defaultValue="#2b49f3" className="w-full h-[42px] px-1 py-1 border border-slate-200 rounded-lg cursor-pointer" />
          </Field>
          <Field label="Logo" hint="PNG/JPG/WEBP">
            <label className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
              <ImageIcon size={14} /> Subir logo
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const l = e.currentTarget.parentElement?.querySelector('span'); if (l) l.textContent = e.target.files?.[0]?.name || '' }} />
              <span className="text-xs text-slate-400 truncate" />
            </label>
          </Field>
        </div>
        <Field label="Mensaje de bienvenida" hint="Vacío = «Bienvenido a [nombre]».">
          <input name="welcomeMessage" placeholder="Bienvenido a Tacos El Rey" className={inputCls} />
        </Field>
      </Section>

      {/* Dueño */}
      <Section icon={Lock} title="Acceso del dueño">
        <Field label="Correo del dueño" required>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="ownerEmail" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="dueno@correo.com" className={`${inputCls} pl-9`} />
          </div>
        </Field>
        <Field label="Contraseña del dueño" required hint="Mínimo 6 caracteres.">
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="ownerPassword" type={showPass ? 'text' : 'password'} required minLength={6} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="mín. 6 caracteres" className={`${inputCls} pl-9 pr-16`} />
            <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700">{showPass ? 'Ocultar' : 'Ver'}</button>
          </div>
        </Field>
      </Section>

      <Section icon={Store} title="Notas internas" optional>
        <textarea name="notes" rows={2} placeholder="Contexto, contacto, observaciones..." className={`${inputCls} resize-none`} />
      </Section>

      <div className="flex gap-3 sticky bottom-0 bg-slate-50/80 backdrop-blur py-3">
        <button type="submit" disabled={creating} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60">
          {creating ? <><Loader2 size={16} className="animate-spin" /> Creando negocio...</> : <>Crear negocio <ArrowRight size={16} /></>}
        </button>
        <button type="button" onClick={() => router.push('/restaurants')} className="px-5 py-3 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">Cancelar</button>
      </div>
    </form>
  )
}

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

function Section({ icon: Icon, title, optional, children }: { icon: React.ElementType; title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {optional && <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">opcional</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}
