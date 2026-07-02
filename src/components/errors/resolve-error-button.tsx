'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { resolveError } from '@/actions/errors'

export function ResolveErrorButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  return (
    <button
      onClick={async (e) => {
        e.preventDefault()
        setBusy(true)
        const r = await resolveError(id)
        setBusy(false)
        if (r.ok) router.refresh()
      }}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Resuelto
    </button>
  )
}
