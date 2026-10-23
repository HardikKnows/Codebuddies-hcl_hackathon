import { ChevronDown, LayoutDashboard, LogIn, LogOut, MapPin, Package, Search, ShoppingCart, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { roleLabel, TierBadge } from '../components/Badge'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'
import { AssistantLauncher, AssistantPanel } from '../features/assistant/AssistantPanel'
import { useCart } from '../features/CartContext'
import { useStores } from '../features/StoreContext'

function StoreSelector() {
  const { pickupStores, selectedStoreId, setSelectedStoreId } = useStores()
  return (
    <label className="flex h-10 items-center gap-1.5 rounded-lg border border-hairline bg-white pl-2.5 pr-1 text-sm shadow-xs focus-within:ring-2 focus-within:ring-brand-500/25">
      <MapPin className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
      <span className="sr-only">Your store</span>
      <select
        value={selectedStoreId ?? ''}
        onChange={(e) => setSelectedStoreId(Number(e.target.value))}
        className="max-w-56 bg-transparent py-1 pr-1 text-sm text-ink focus:outline-none"
      >
        {pickupStores.length === 0 && <option value="">Loading stores…</option>}
        {pickupStores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name.replace('NovaMart ', '')} · {store.city}
          </option>
        ))}
      </select>
    </label>
  )
}

function CartButton() {
  const { count } = useCart()
  return (
    <Link
      to="/cart"
      aria-label={`Cart with ${count} item${count === 1 ? '' : 's'}`}
      className="relative inline-flex size-10 items-center justify-center rounded-lg border border-hairline bg-white text-ink-2 shadow-xs hover:text-ink"
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-semibold text-white tabular-nums">
          {count}
        </span>
      )}
    </Link>
  )
}

function AccountMenu() {
  const { user, isStaff, isCustomer, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => !ref.current?.contains(event.target) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) {
    return (
      <Button as={Link} to="/login" variant="secondary" icon={LogIn}>
        Sign in
      </Button>
    )
  }

  const initials = user.fullName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
  const item = 'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-slate-100 hover:text-ink'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-lg border border-hairline bg-white pl-1.5 pr-2 shadow-xs hover:bg-slate-50"
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-brand-100 text-xs font-semibold text-brand-800">{initials}</span>
        <span className="hidden text-sm font-medium text-ink md:block">{user.fullName.split(' ')[0]}</span>
        <ChevronDown className="size-4 text-ink-3" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="rp-fade-up absolute right-0 z-40 mt-2 w-64 rounded-xl border border-hairline bg-white p-2 shadow-lg">
          <div className="border-b border-hairline px-2.5 pb-2.5 pt-1">
            <p className="text-sm font-semibold text-ink">{user.fullName}</p>
            <p className="truncate text-xs text-ink-3">{user.email}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-xs text-ink-2">{roleLabel(user.role)}</span>
              <TierBadge tier={user.membershipTier} />
            </div>
          </div>
          <div className="pt-1.5">
            {isCustomer && (
              <Link to="/orders" className={item} onClick={() => setOpen(false)} role="menuitem">
                <Package className="size-4" aria-hidden="true" /> My orders
              </Link>
            )}
            {isStaff && (
              <Link to="/ops" className={item} onClick={() => setOpen(false)} role="menuitem">
                <LayoutDashboard className="size-4" aria-hidden="true" /> Operations dashboard
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/')
              }}
            >
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SiteHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { isStaff } = useAuth()
  const [query, setQuery] = useState(params.get('q') || '')

  useEffect(() => {
    if (location.pathname === '/') setQuery(params.get('q') || '')
  }, [location.pathname, params])

  const onSearch = (event) => {
    event.preventDefault()
    const next = new URLSearchParams()
    if (query.trim()) next.set('q', query.trim())
    navigate(`/${next.toString() ? `?${next}` : ''}`)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Logo />
        <form onSubmit={onSearch} role="search" className="order-last w-full md:order-0 md:w-auto md:flex-1">
          <label className="relative block">
            <span className="sr-only">Search products</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search laptops, phones, appliances…"
              className="h-10 w-full rounded-lg border border-hairline bg-slate-50 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <StoreSelector />
          {isStaff && (
            <Button as={Link} to="/ops" variant="ghost" icon={LayoutDashboard} className="hidden lg:inline-flex">
              Operations
            </Button>
          )}
          <CartButton />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}

export function StorefrontLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-brand-900 px-4 py-1.5 text-center text-xs text-brand-100">
        <Truck className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />
        Free home delivery on orders above ₹5,000 · Pick up at any NovaMart store · Payments are simulated in this demo
      </div>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="border-t border-hairline bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ink-3 sm:px-6 lg:px-8">
          <p>© 2026 NovaMart · RetailPulse AI hackathon demo</p>
          <p>AI answers cite approved NovaMart documents. Every operational action is audited.</p>
        </div>
      </footer>
      <AssistantLauncher />
      <AssistantPanel />
    </div>
  )
}
