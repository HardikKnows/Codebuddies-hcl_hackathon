import { CreditCard, LogIn, Minus, Plus, ShoppingBag, ShoppingCart, Store, Trash2, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ordersApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { AvailabilityBadge, roleLabel } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Input, Label } from '../../components/Form'
import { Card } from '../../components/Misc'
import { useToast } from '../../components/Overlay'
import { EmptyState, InlineError, Skeleton } from '../../components/States'
import { useCart } from '../../features/CartContext'
import { useStores } from '../../features/StoreContext'
import { formatINR } from '../../lib/format'
import { useDebouncedValue } from '../../lib/useApi'

function FulfillmentOption({ active, onClick, icon: Icon, title, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 items-start gap-3 rounded-xl border p-4 text-left transition ${
        active ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20' : 'border-hairline bg-white hover:border-brand-300'
      }`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${active ? 'text-brand-700' : 'text-ink-3'}`} aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-2">{description}</span>
      </span>
    </button>
  )
}

export function CartPage() {
  const { items, setQuantity, removeItem, clear, maxPerLine } = useCart()
  const { selectedStoreId, selectedStore } = useStores()
  const { user, isCustomer } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [fulfillment, setFulfillment] = useState('PICKUP')
  const [address, setAddress] = useState({ line1: '', city: user?.city || '', postalCode: '' })
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState(null)
  const requestId = useRef(null) // one id per checkout attempt makes retries safe

  const cartKey = useDebouncedValue(JSON.stringify(items), 250)

  useEffect(() => {
    requestId.current = null
    if (!items.length) {
      setQuote(null)
      return undefined
    }
    let alive = true
    setQuoting(true)
    setQuoteError(null)
    ordersApi
      .quote({
        fulfillmentType: fulfillment,
        storeId: fulfillment === 'PICKUP' ? selectedStoreId : undefined,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      })
      .then((result) => alive && setQuote(result))
      .catch((error) => alive && setQuoteError(error))
      .finally(() => alive && setQuoting(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, fulfillment, selectedStoreId])

  if (!items.length) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Your cart is empty"
        description="Browse the catalog or ask the AI assistant to recommend something that fits your needs."
        action={
          <Button as={Link} to="/" icon={ShoppingBag}>
            Start shopping
          </Button>
        }
      />
    )
  }

  const quantities = Object.fromEntries(items.map((i) => [i.productId, i.quantity]))
  const addressValid = address.line1.trim().length >= 3 && address.city.trim().length >= 2 && address.postalCode.trim().length >= 3
  const blockers = []
  if (fulfillment === 'DELIVERY' && !addressValid) blockers.push('Add a complete delivery address.')
  if (quote && !quote.canCheckout) blockers.push('Some items are not available in the quantity requested.')
  const canPlace = isCustomer && quote && !quoting && blockers.length === 0

  const placeOrder = async () => {
    setPlacing(true)
    setPlaceError(null)
    if (!requestId.current) requestId.current = crypto.randomUUID()
    try {
      const order = await ordersApi.place({
        clientRequestId: requestId.current,
        fulfillmentType: fulfillment,
        storeId: fulfillment === 'PICKUP' ? selectedStoreId : undefined,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        deliveryAddress: fulfillment === 'DELIVERY' ? { line1: address.line1, city: address.city, postalCode: address.postalCode } : undefined,
      })
      clear()
      toast(`Order ${order.orderNumber} placed`)
      navigate(`/orders/${order.orderNumber}?placed=1`)
    } catch (error) {
      setPlaceError(error)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">Your cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">How would you like to get it?</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <FulfillmentOption
                active={fulfillment === 'PICKUP'}
                onClick={() => setFulfillment('PICKUP')}
                icon={Store}
                title={`Pick up at ${selectedStore ? selectedStore.name.replace('NovaMart ', '') : 'your store'}`}
                description="Free · change the store from the header"
              />
              <FulfillmentOption
                active={fulfillment === 'DELIVERY'}
                onClick={() => setFulfillment('DELIVERY')}
                icon={Truck}
                title="Home delivery"
                description="Ships from the central warehouse · free above ₹5,000"
              />
            </div>
            {fulfillment === 'DELIVERY' && (
              <div className="mt-4 grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <Label htmlFor="line1">Address</Label>
                  <Input id="line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} placeholder="Flat, building, street" maxLength={200} />
                </div>
                <div className="sm:col-span-4">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} maxLength={80} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="postal">PIN code</Label>
                  <Input id="postal" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} inputMode="numeric" maxLength={12} />
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">Items</h2>
              <span className="text-xs text-ink-3">
                Stock checked at {quote?.fulfillmentStore?.name || (fulfillment === 'PICKUP' ? selectedStore?.name : 'the warehouse')}
              </span>
            </div>
            {quoteError ? (
              <div className="p-5">
                <InlineError error={quoteError} />
              </div>
            ) : !quote ? (
              <div className="space-y-3 p-5">
                {items.map((i) => (
                  <Skeleton key={i.productId} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <ul className={`divide-y divide-hairline/70 transition-opacity ${quoting ? 'opacity-60' : ''}`}>
                {quote.lines.map((line) => (
                  <li key={line.productId} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link to={`/products/${line.productId}`} className="text-sm font-semibold text-ink hover:text-brand-700">
                        {line.name}
                      </Link>
                      <p className="text-xs text-ink-3">
                        {line.brand} · {formatINR(line.unitPrice)} each
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <AvailabilityBadge status={line.availability} quantity={line.availableQuantity} showQuantity />
                        {!line.ok && <span className="text-xs font-medium text-red-700">{line.message}</span>}
                      </div>
                    </div>
                    <div className="inline-flex h-9 items-center rounded-lg border border-hairline">
                      <button type="button" onClick={() => setQuantity(line.productId, (quantities[line.productId] || 1) - 1)} aria-label={`Decrease ${line.name}`} className="flex h-full w-8 items-center justify-center text-ink-2 hover:text-ink">
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm tabular-nums">{quantities[line.productId] ?? line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.productId, (quantities[line.productId] || 0) + 1)}
                        disabled={(quantities[line.productId] || 0) >= maxPerLine}
                        aria-label={`Increase ${line.name}`}
                        className="flex h-full w-8 items-center justify-center text-ink-2 hover:text-ink disabled:text-ink-3"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <p className="w-24 text-right text-sm font-semibold tabular-nums text-ink">{formatINR(line.lineTotal)}</p>
                    <button type="button" onClick={() => removeItem(line.productId)} aria-label={`Remove ${line.name}`} className="rounded-lg p-2 text-ink-3 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside>
          <Card className="p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold text-ink">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="tabular-nums text-ink">{quote ? formatINR(quote.subtotal) : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">{fulfillment === 'PICKUP' ? 'Store pickup' : 'Delivery'}</dt>
                <dd className="tabular-nums text-ink">{quote ? (quote.shippingFee ? formatINR(quote.shippingFee) : 'Free') : '—'}</dd>
              </div>
              <div className="flex justify-between border-t border-hairline pt-3 text-base font-semibold">
                <dt className="text-ink">Total</dt>
                <dd className="tabular-nums text-ink">{quote ? formatINR(quote.total) : '—'}</dd>
              </div>
            </dl>

            {quote?.warnings?.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                {quote.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}

            <div className="mt-5 space-y-3">
              {!user ? (
                <Button className="w-full" size="lg" icon={LogIn} onClick={() => navigate('/login', { state: { from: '/cart' } })}>
                  Sign in to place your order
                </Button>
              ) : !isCustomer ? (
                <p className="rounded-lg bg-slate-100 p-3 text-xs text-ink-2">
                  You're signed in as {roleLabel(user.role).toLowerCase()}. Sign in with a customer account to place orders.
                </p>
              ) : (
                <Button className="w-full" size="lg" icon={CreditCard} loading={placing} disabled={!canPlace} onClick={placeOrder}>
                  Place order
                </Button>
              )}
              {isCustomer && blockers.map((b) => <p key={b} className="text-xs text-ink-3">{b}</p>)}
              <InlineError error={placeError} />
              <p className="text-center text-[11px] text-ink-3">Payment is simulated for this demo. No card details are needed.</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
