import { Star } from 'lucide-react'
import { formatNumber } from '../lib/format'

export function Rating({ value, count, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-ink-2 ${className}`} title={`Rated ${value} out of 5`}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-medium text-ink">{Number(value).toFixed(1)}</span>
      {count != null && <span className="text-ink-3">({formatNumber(count)})</span>}
    </span>
  )
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-2xl border border-hairline bg-white shadow-xs ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Shared table styling: hairline rows, recessive header, tabular numbers in numeric cells. Outer cells line up with card headers. */
export const table = {
  wrapper: 'overflow-x-auto',
  table: 'min-w-full text-left text-sm',
  head: 'border-b border-hairline bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-ink-3',
  th: 'whitespace-nowrap px-3 py-2 font-semibold first:pl-5 last:pr-5',
  row: 'border-b border-hairline/70 transition-colors last:border-0 hover:bg-slate-50/60',
  td: 'px-3 py-2.5 align-middle text-ink-2 first:pl-5 last:pr-5',
  num: 'px-3 py-2.5 text-right align-middle tabular-nums text-ink first:pl-5 last:pr-5',
}
