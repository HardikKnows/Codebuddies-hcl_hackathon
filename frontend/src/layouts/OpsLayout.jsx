import { BookOpen, Boxes, LayoutDashboard, LogOut, Menu, Receipt, ScrollText, Sparkles, Store, Ticket, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { MANAGER_ROLES, useAuth } from '../auth/AuthContext'
import { roleLabel } from '../components/Badge'
import { Logo } from '../components/Logo'
import { useAssistant } from '../features/assistant/AssistantContext'
import { AssistantLauncher, AssistantPanel } from '../features/assistant/AssistantPanel'

const NAV = [
  { to: '/ops', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/ops/inventory', label: 'Inventory', icon: Boxes },
  { to: '/ops/tickets', label: 'Support tickets', icon: Ticket },
  { to: '/ops/orders', label: 'Order lookup', icon: Receipt },
  { to: '/ops/audit', label: 'Audit log', icon: ScrollText, roles: MANAGER_ROLES },
  { to: '/ops/knowledge', label: 'Knowledge base', icon: BookOpen, roles: MANAGER_ROLES },
]

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const { setOpen: openAssistant } = useAssistant()
  const navigate = useNavigate()
  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role))

  return (
    <div className="flex h-full flex-col bg-linear-to-b from-brand-900 to-brand-950 text-brand-100">
      <div className="px-5 pb-4 pt-5">
        <Logo to="/ops" inverted subtitle="Store operations" />
      </div>
      {/* On desktop the assistant opens from here, so no floating button sits over the tables. */}
      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={() => {
            openAssistant(true)
            onNavigate?.()
          }}
          className="flex w-full items-center gap-2.5 rounded-lg bg-linear-to-r from-brand-500 to-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-black/20 ring-1 ring-white/15 transition hover:from-brand-400 hover:to-brand-500"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Ask RetailPulse AI
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Operations">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/12 text-white ring-1 ring-white/10' : 'text-brand-100/80 hover:bg-white/8 hover:text-white'
              }`
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <NavLink to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-brand-100/80 hover:bg-white/8 hover:text-white">
          <Store className="size-4" aria-hidden="true" /> View storefront
        </NavLink>
        <div className="flex items-center gap-3 rounded-lg bg-white/8 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
            <p className="truncate text-xs text-brand-100/75">
              {roleLabel(user.role)}
              {user.storeName ? ` · ${user.storeName.replace('NovaMart ', '')}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-md p-1.5 text-brand-100/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function OpsLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="min-h-screen bg-plane">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="rp-slide-in relative h-full w-64">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-5 rounded-md p-1 text-brand-100/80 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-hairline bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 text-ink-2 hover:bg-slate-100">
            <Menu className="size-5" />
          </button>
          <Logo to="/ops" subtitle="Store operations" />
        </div>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>
      <AssistantLauncher className="lg:hidden" />
      <AssistantPanel />
    </div>
  )
}
