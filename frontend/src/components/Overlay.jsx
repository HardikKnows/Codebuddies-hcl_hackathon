import { CircleCheck, CircleX, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function Drawer({ open, onClose, title, subtitle, children, footer, widthClass = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label={title} className={`rp-slide-in relative flex h-full w-full ${widthClass} flex-col bg-white shadow-2xl`}>
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-3 hover:bg-slate-100 hover:text-ink">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-hairline px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  )
}

/** Centered dialog. Pass `onClose={undefined}` while saving to keep it open. */
export function Modal({ open, onClose, title, subtitle, children, widthClass = 'max-w-md' }) {
  useEffect(() => {
    if (!open || !onClose) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className={`rp-fade-up relative w-full ${widthClass} overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-3 hover:bg-slate-100 hover:text-ink disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const ToastContext = createContext(() => {})

const TOAST_ICONS = {
  good: <CircleCheck className="size-4 text-good" aria-hidden="true" />,
  critical: <CircleX className="size-4 text-critical" aria-hidden="true" />,
  info: <Info className="size-4 text-brand-400" aria-hidden="true" />,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, tone = 'good') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-70 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="rp-fade-up pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
              {TOAST_ICONS[toast.tone] || TOAST_ICONS.info}
              {toast.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
