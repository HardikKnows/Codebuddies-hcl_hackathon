import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '../lib/format'

function pageWindow(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages))
  const sorted = [...set].sort((a, b) => a - b)
  const result = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…')
    result.push(p)
  })
  return result
}

export function Pagination({ page, pageSize, total, onPageChange, className = '' }) {
  if (!total) return null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const navButton =
    'inline-flex size-8 items-center justify-center rounded-lg text-sm text-ink-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent'

  return (
    <nav className={`flex flex-wrap items-center justify-between gap-3 ${className}`} aria-label="Pagination">
      <p className="text-sm text-ink-3">
        Showing <span className="font-medium text-ink-2">{formatNumber(from)}–{formatNumber(to)}</span> of{' '}
        <span className="font-medium text-ink-2">{formatNumber(total)}</span>
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={navButton} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pageWindow(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-ink-3">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm tabular-nums ${
                  p === page ? 'bg-brand-600 font-semibold text-white' : 'text-ink-2 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className={navButton} onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  )
}
