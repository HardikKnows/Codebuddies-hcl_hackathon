import { CircleX, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from './Button'

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 py-10 text-sm text-ink-3 ${className}`}>
      <LoaderCircle className="size-5 animate-spin text-brand-500" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} aria-hidden="true" />
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-slate-100">
          <Icon className="size-6 text-ink-3" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function AiNotConfiguredNotice({ error, compact = false }) {
  return (
    <div className={`rounded-xl border border-brand-200 bg-brand-50/60 ${compact ? 'p-3' : 'p-5'}`} role="status">
      <div className="flex gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-ink">The AI assistant isn't switched on yet</p>
          <p className="mt-1 text-ink-2">
            An administrator needs to add the OpenAI API key and model IDs to <code className="font-mono text-xs">backend/.env</code>.
            Shopping, checkout, orders and operations keep working in the meantime.
          </p>
          {error?.message && !compact && <p className="mt-2 text-xs text-ink-3">{error.message}</p>}
        </div>
      </div>
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Something went wrong', className = '' }) {
  if (error?.code === 'AI_NOT_CONFIGURED') return <AiNotConfiguredNotice error={error} />
  return (
    <div role="alert" className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-red-50">
        <CircleX className="size-6 text-critical" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-2">{error?.message || 'Please try again.'}</p>
      {error?.requestId && <p className="mt-1 font-mono text-[11px] text-ink-3">Reference {error.requestId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  )
}

export function InlineError({ error }) {
  if (!error) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      <CircleX className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
      <span>{error.message || String(error)}</span>
    </div>
  )
}
