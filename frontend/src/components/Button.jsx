import { LoaderCircle } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'border border-hairline bg-white text-ink shadow-sm hover:bg-slate-50 disabled:text-ink-3',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300',
  ghost: 'text-ink-2 hover:bg-slate-100 hover:text-ink disabled:text-ink-3',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300',
  // For dark or brand-colored backgrounds. Use a variant rather than overriding colors via className,
  // since two utilities for the same property don't reliably resolve in source order.
  light: 'bg-white text-brand-800 shadow-sm hover:bg-brand-50',
  onDark: 'text-white hover:bg-white/15',
}

const SIZES = {
  xs: 'h-7 gap-1 rounded-md px-2 text-xs',
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-base',
}

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const isButton = Component === 'button'
  const iconSize = size === 'xs' ? 'size-3.5' : 'size-4'
  return (
    <Component
      type={isButton ? props.type || 'button' : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <LoaderCircle className={`${iconSize} animate-spin`} aria-hidden="true" />
      ) : (
        Icon && <Icon className={iconSize} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className={iconSize} aria-hidden="true" />}
    </Component>
  )
}

export function IconButton({ icon: Icon, label, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:text-ink-3 ${className}`}
      {...props}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  )
}
