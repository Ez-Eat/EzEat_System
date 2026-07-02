'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, Users2, KeyRound, ClipboardCheck,
  ShieldCheck, History, Plus, Menu, X, MonitorSmartphone, BarChart3, Bug,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',   label: 'Panel General',      icon: LayoutDashboard,    adminOnly: false },
  { href: '/restaurants', label: 'Negocios Afiliados', icon: Users2,             adminOnly: false },
  { href: '/metrics',     label: 'Métricas SaaS',      icon: BarChart3,          adminOnly: true  },
  { href: '/errors',      label: 'Errores',            icon: Bug,                adminOnly: true  },
  { href: '/vault',       label: 'Bóveda de Accesos',  icon: KeyRound,           adminOnly: false },
  { href: '/tasks',       label: 'Gestor de Tareas',   icon: ClipboardCheck,     adminOnly: false },
  { href: '/proyectos',   label: 'Portales Cliente',   icon: MonitorSmartphone,  adminOnly: false },
  { href: '/accounts',    label: 'Control de Acceso',  icon: ShieldCheck,        adminOnly: true  },
]

const bottomItems = [
  { href: '/audit', label: 'Auditoría', icon: History, adminOnly: true },
]

interface SidebarProps { role: string }

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = role === 'ADMIN'
  const visibleNav    = navItems.filter((i) => !i.adminOnly || isAdmin)
  const visibleBottom = bottomItems.filter((i) => !i.adminOnly || isAdmin)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarContent = (
    <aside className="w-60 flex flex-col h-full" style={{ backgroundColor: '#0F172A' }}>
      <div className="px-5 pt-6 pb-5 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-700 rounded-md flex items-center justify-center text-white font-bold text-sm">E</div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Ez-eat Admin</p>
            <p className="text-slate-400 text-[10px] font-medium tracking-widest uppercase mt-0.5">Sistema Seguro</p>
          </div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 py-4 px-3">
        <div className="space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium tracking-wide uppercase transition-all ${
                  active
                    ? 'bg-slate-700/70 text-white border-l-2 border-blue-500 pl-[10px]'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="px-3 pb-4 border-t border-slate-700/50 pt-3">
        <div className="space-y-0.5 mb-3">
          {visibleBottom.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium uppercase tracking-wide transition-all ${
                  active ? 'text-white bg-slate-700/70' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            )
          })}
        </div>
        <Link
          href="/tasks/new"
          onClick={() => setMobileOpen(false)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md text-sm font-medium text-white transition-colors hover:bg-slate-600"
          style={{ backgroundColor: '#1e293b' }}
        >
          <Plus size={15} />
          Nueva solicitud
        </Link>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex h-full">{sidebarContent}</div>
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3.5 left-3.5 z-40 p-2 bg-slate-800 text-white rounded-lg shadow-lg"
        >
          <Menu size={18} />
        </button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="flex-shrink-0 h-full">{sidebarContent}</div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
