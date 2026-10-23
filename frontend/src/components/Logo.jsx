import { Activity } from 'lucide-react'
import { Link } from 'react-router'

export function Logo({ to = '/', inverted = false, subtitle = 'by NovaMart' }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-violet-600 text-white shadow-sm">
        <Activity className="size-5" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className={`block text-base font-bold tracking-tight ${inverted ? 'text-white' : 'text-ink'}`}>RetailPulse</span>
        <span className={`block text-[10px] font-medium uppercase tracking-[0.2em] ${inverted ? 'text-white/60' : 'text-ink-3'}`}>{subtitle}</span>
      </span>
    </Link>
  )
}
