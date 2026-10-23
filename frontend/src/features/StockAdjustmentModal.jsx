import { ArrowRight, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { opsApi } from '../api'
import { AvailabilityBadge } from '../components/Badge'
import { Button } from '../components/Button'
import { Input, Label, Textarea } from '../components/Form'
import { Modal } from '../components/Overlay'
import { ProductImage } from '../components/ProductImage'
import { InlineError } from '../components/States'

const MAX_UNITS = 10000
const REASON_LIMIT = 200

const statusFor = (quantity, reorderLevel) => (quantity <= 0 ? 'OUT_OF_STOCK' : quantity <= reorderLevel ? 'LOW_STOCK' : 'IN_STOCK')

/** Mirrors the server's rules for instant feedback; the server re-validates against the database. */
function validate(amountText, direction, current) {
  const text = amountText.trim()
  if (!text) return { error: null, delta: null }
  if (!/^\d+$/.test(text)) return { error: 'Enter a whole number of units.', delta: null }
  const amount = Number(text)
  if (amount === 0) return { error: 'The adjustment must be at least 1 unit.', delta: null }
  if (amount > MAX_UNITS) return { error: `Adjust at most ${MAX_UNITS.toLocaleString('en-IN')} units at a time.`, delta: null }
  if (direction === 'decrease' && amount > current) {
    return { error: `Only ${current} in stock, so you can remove at most ${current}.`, delta: null }
  }
  return { error: null, delta: direction === 'increase' ? amount : -amount }
}

function DirectionButton({ active, icon: Icon, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white text-ink shadow-xs ring-1 ring-hairline' : 'text-ink-2 hover:text-ink'
      }`}
      {...props}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </button>
  )
}

export function StockAdjustmentModal({ row, onClose, onUpdated }) {
  const [direction, setDirection] = useState('increase')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const amountRef = useRef(null)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const { error: validationError, delta } = validate(amount, direction, row.quantity)
  const resulting = delta === null ? null : row.quantity + delta

  const submit = async (event) => {
    event.preventDefault()
    if (delta === null || saving) return
    setSaving(true)
    setError(null)
    try {
      // Only the requested change is sent; the server derives permissions from the session and reads stock itself.
      const result = await opsApi.adjustStock({ productId: row.productId, storeId: row.storeId, delta, reason: reason.trim() || null })
      onUpdated(result)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Modal open title="Update stock" subtitle="Changes are applied immediately and recorded in the audit log." onClose={saving ? undefined : onClose}>
      <form onSubmit={submit} noValidate>
        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-hairline">
            <ProductImage src={row.imageUrl} categorySlug={row.categorySlug} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{row.productName}</p>
              <p className="text-xs text-ink-3">
                <span className="font-mono">{row.productId}</span> · {row.storeName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] uppercase tracking-wide text-ink-3">Current stock</p>
              <p className="text-lg font-semibold tabular-nums text-ink">{row.quantity}</p>
            </div>
          </div>

          <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Adjustment type">
            <DirectionButton active={direction === 'increase'} icon={Plus} onClick={() => setDirection('increase')} disabled={saving}>
              Increase
            </DirectionButton>
            <DirectionButton active={direction === 'decrease'} icon={Minus} onClick={() => setDirection('decrease')} disabled={saving}>
              Decrease
            </DirectionButton>
          </div>

          <div>
            <Label htmlFor="adjust-amount">{direction === 'increase' ? 'Units to add' : 'Units to remove'}</Label>
            <Input
              id="adjust-amount"
              ref={amountRef}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              max={MAX_UNITS}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
              aria-invalid={Boolean(validationError)}
              aria-describedby="adjust-amount-help"
              placeholder="e.g. 20"
              className="tabular-nums"
            />
            <p id="adjust-amount-help" className={`mt-1 text-xs ${validationError ? 'text-red-700' : 'text-ink-3'}`}>
              {validationError || 'A whole number of units.'}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2.5" aria-live="polite">
            <span className="text-sm text-ink-2">Resulting stock</span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="text-ink-3">{row.quantity}</span>
              <ArrowRight className="size-3.5 text-ink-3" aria-hidden="true" />
              <span className="text-lg font-semibold text-ink">{resulting ?? '—'}</span>
              {resulting !== null && <AvailabilityBadge status={statusFor(resulting, row.reorderLevel)} />}
            </span>
          </div>

          <div>
            <Label htmlFor="adjust-reason" hint="(optional)">
              Reason
            </Label>
            <Textarea
              id="adjust-reason"
              rows={2}
              maxLength={REASON_LIMIT}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
              placeholder="e.g. Supplier delivery, damaged in storage, stock count correction"
            />
            <p className="mt-1 text-right text-[11px] text-ink-3">
              {reason.length}/{REASON_LIMIT}
            </p>
          </div>

          <InlineError error={error} />
        </div>

        <footer className="flex justify-end gap-2 border-t border-hairline bg-slate-50/60 px-5 py-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={delta === null}>
            Confirm update
          </Button>
        </footer>
      </form>
    </Modal>
  )
}
