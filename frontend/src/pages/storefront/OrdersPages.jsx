import { CircleCheck, LifeBuoy, MapPin, Package, Receipt, Store, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ordersApi } from '../../api'
import { OrderStatusBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card, CardHeader, table } from '../../components/Misc'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, Spinner } from '../../components/States'
import { useAssistant } from '../../features/assistant/AssistantContext'
import { formatDate, formatDateTime, formatINR, prettyEnum } from '../../lib/format'
import { useApi } from '../../lib/useApi'

export function OrdersPage() {
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useApi(() => ordersApi.mine({ page, pageSize: 10 }), [page])

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">My orders</h1>
      {error ? (
        <ErrorState error={error} onRetry={reload} title="We couldn't load your orders" />
      ) : !data ? (
        <Spinner label="Loading your orders…" />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order it will show up here with its live status."
          action={
            <Button as={Link} to="/">
              Start shopping
            </Button>
          }
        />
      ) : (
        <div className={loading ? 'opacity-60' : ''}>
          <ul className="space-y-3">
            {data.items.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  to={`/orders/${order.orderNumber}`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-white p-4 shadow-xs transition hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50">
                    {order.fulfillmentType === 'PICKUP' ? <Store className="size-5 text-brand-700" /> : <Truck className="size-5 text-brand-700" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-ink">{order.orderNumber}</p>
                    <p className="text-xs text-ink-3">
                      {formatDate(order.placedAt)} · {order.itemCount} item{order.itemCount > 1 ? 's' : ''} ·{' '}
                      {order.fulfillmentType === 'PICKUP' ? `Pickup at ${order.storeName.replace('NovaMart ', '')}` : 'Home delivery'}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  <p className="w-24 text-right text-sm font-semibold tabular-nums text-ink">{formatINR(order.total)}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination className="mt-5" page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

const STEPS = {
  PICKUP: ['PLACED', 'PACKED', 'READY_FOR_PICKUP', 'PICKED_UP'],
  DELIVERY: ['PLACED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
}

export function OrderTimeline({ order }) {
  if (order.status === 'CANCELLED') {
    return <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-ink-2">This order was cancelled.</p>
  }
  const steps = STEPS[order.fulfillmentType] || STEPS.DELIVERY
  const current = steps.indexOf(order.status)
  return (
    <ol className="flex flex-wrap items-center gap-y-3">
      {steps.map((step, index) => {
        const done = index <= current
        return (
          <li key={step} className="flex items-center">
            <span className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  done ? 'bg-brand-600 text-white' : 'bg-slate-200 text-ink-3'
                } ${index === current ? 'ring-4 ring-brand-100' : ''}`}
              >
                {done ? <CircleCheck className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className={`text-xs ${index === current ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-ink-3'}`}>{prettyEnum(step)}</span>
            </span>
            {index < steps.length - 1 && <span className={`mx-2 h-px w-6 sm:w-10 ${index < current ? 'bg-brand-400' : 'bg-hairline'}`} aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

export function OrderItemsTable({ order }) {
  return (
    <div className={table.wrapper}>
      <table className={table.table}>
        <thead className={table.head}>
          <tr>
            <th className={table.th}>Item</th>
            <th className={`${table.th} text-right`}>Qty</th>
            <th className={`${table.th} text-right`}>Price</th>
            <th className={`${table.th} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.productId} className={table.row}>
              <td className={table.td}>
                <Link to={`/products/${item.productId}`} className="font-medium text-ink hover:text-brand-700">
                  {item.name}
                </Link>
                <p className="font-mono text-[11px] text-ink-3">{item.productId}</p>
              </td>
              <td className={table.num}>{item.quantity}</td>
              <td className={table.num}>{formatINR(item.unitPrice)}</td>
              <td className={table.num}>{formatINR(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <tr>
            <td colSpan={3} className="px-4 pt-3 text-right text-ink-2">Subtotal</td>
            <td className="px-4 pt-3 text-right tabular-nums text-ink">{formatINR(order.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="px-4 pt-1 text-right text-ink-2">{order.fulfillmentType === 'PICKUP' ? 'Pickup' : 'Delivery'}</td>
            <td className="px-4 pt-1 text-right tabular-nums text-ink">{order.shippingFee ? formatINR(order.shippingFee) : 'Free'}</td>
          </tr>
          <tr>
            <td colSpan={3} className="px-4 pb-4 pt-2 text-right font-semibold text-ink">Total</td>
            <td className="px-4 pb-4 pt-2 text-right font-semibold tabular-nums text-ink">{formatINR(order.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function FulfillmentDetails({ order }) {
  const address = order.deliveryAddress
  return order.fulfillmentType === 'PICKUP' ? (
    <p className="flex items-start gap-2 text-sm text-ink-2">
      <Store className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span>
        Pickup at <span className="font-medium text-ink">{order.fulfillmentStore.name}</span>
        <span className="block text-xs text-ink-3">{order.fulfillmentStore.address}</span>
      </span>
    </p>
  ) : (
    <p className="flex items-start gap-2 text-sm text-ink-2">
      <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span>
        Deliver to <span className="font-medium text-ink">{address?.line1 || '—'}</span>
        <span className="block text-xs text-ink-3">
          {[address?.city, address?.postalCode || address?.postal_code].filter(Boolean).join(' ')} · ships from {order.fulfillmentStore.name}
        </span>
      </span>
    </p>
  )
}

export function OrderDetailPage() {
  const { orderNumber } = useParams()
  const [params] = useSearchParams()
  const { openWith } = useAssistant()
  const { data: order, error, reload } = useApi(() => ordersApi.get(orderNumber), [orderNumber])

  if (error) {
    return error.status === 404 ? (
      <EmptyState
        icon={Receipt}
        title="Order not found"
        description="We couldn't find that order on your account."
        action={
          <Button as={Link} to="/orders" variant="secondary">
            View my orders
          </Button>
        }
      />
    ) : (
      <ErrorState error={error} onRetry={reload} title="We couldn't load this order" />
    )
  }
  if (!order) return <Spinner label="Loading order…" />

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {params.get('placed') && (
        <div className="rp-fade-up flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-good" aria-hidden="true" />
          <div>
            <p className="font-semibold text-ink">Thank you! Your order is confirmed.</p>
            <p className="text-sm text-ink-2">
              Order <span className="font-mono font-semibold">{order.orderNumber}</span> was placed and payment was simulated. Stock has been reserved for you.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">
            <Link to="/orders" className="hover:text-ink">
              My orders
            </Link>{' '}
            / {order.orderNumber}
          </p>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">{order.orderNumber}</h1>
          <p className="text-sm text-ink-3">Placed {formatDateTime(order.placedAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card className="p-5">
        <OrderTimeline order={order} />
        <div className="mt-5 border-t border-hairline pt-4">
          <FulfillmentDetails order={order} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Items" description={`Payment: ${prettyEnum(order.paymentStatus)}`} />
        <OrderItemsTable order={order} />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-white p-4">
        <p className="text-sm text-ink-2">Something wrong with this order? The assistant can look it up and prepare a support ticket for you.</p>
        <Button variant="subtle" icon={LifeBuoy} onClick={() => openWith({ prompt: `I need help with my order ${order.orderNumber}` })}>
          Get help
        </Button>
      </div>
    </div>
  )
}
