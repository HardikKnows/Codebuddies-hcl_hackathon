const fieldBase =
  'rounded-lg border border-hairline bg-white px-3 text-sm text-ink shadow-xs placeholder:text-ink-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:bg-slate-50 disabled:text-ink-3'

// Full width by default, unless the caller sets a width (conflicting width utilities don't resolve predictably).
const width = (className) => (/(^|\s)(w-|flex-1)/.test(className) ? '' : 'w-full')

export function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
    </label>
  )
}

export function Input({ className = '', ...props }) {
  return <input className={`${fieldBase} ${width(className)} h-10 ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${fieldBase} ${width(className)} py-2 ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${fieldBase} ${width(className)} h-10 pr-8 ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Toggle({ checked, onChange, label, id }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink">
      <span>{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  )
}
