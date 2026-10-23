import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'

/**
 * A button that opens a small menu of actions (styled like the account menu).
 * items: [{ label, description, icon, onClick, disabled, hint }] - `hint` replaces the description when disabled.
 */
export function MenuButton({ label, icon, items, loading = false, variant = 'secondary', size = 'sm' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => !ref.current?.contains(event.target) && setOpen(false)
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        iconRight={ChevronDown}
        loading={loading}
        disabled={loading}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </Button>
      {open && (
        <div role="menu" className="rp-fade-up absolute right-0 z-40 mt-2 w-72 rounded-xl border border-hairline bg-white p-1.5 shadow-lg">
          {items.map(({ label: itemLabel, description, icon: Icon, onClick, disabled, hint }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                setOpen(false)
                onClick()
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
            >
              {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />}
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{itemLabel}</span>
                {(disabled ? hint : description) && <span className="block text-xs text-ink-3">{disabled ? hint : description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
