import { Receipt, Search } from 'lucide-react'
import { useState } from 'react'
import { opsApi, ordersApi } from '../../api'
import { OrderStatusBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Form'
import { Card, PageHeader, table } from '../../components/Misc'
import { Drawer } from '../../components/Overlay'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, InlineError, Spinner } from '../../components/States'
import { formatDateTime, formatINR, prettyEnum, timeAgo } from '../../lib/format'
import { useApi, useDebouncedValue } from '../../lib/useApi'
import { FulfillmentDetails, OrderItemsTable, OrderTimeline } from '../storefront/OrdersPages'

const ORDER_STATUSES = ['PLACED', 'PACKED', 'READY_FOR_PICKUP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKED_UP', 'CANCELLED']

function OrderDrawer({ orderNumber, onClose }) {
  const { data: order, error, reload } = useApi(() => ordersApi.get(orderNumber), [orderNumber])
  return (
    <Drawer open onClose={onClose} title={orderNumber} subtitle={order ? `${order.customerName} · placed ${formatDateTime(order.placedAt)}` : 'Loading…'} widthClass="max-w-2xl">
      {error ? (
        <ErrorState error={error} onRetry={reload} title="We couldn't load this order" />
      ) : !order ? (
        <Spinner label="Loading order…" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-xs text-ink-3">Payment {prettyEnum(order.paymentStatus).toLowerCase()}</span>
          </div>
          <OrderTimeline order={order} />
          <FulfillmentDetails order={order} />
          <div className="rounded-xl border border-hairline">
            <OrderItemsTable order={order} />
          </div>
        </div>
      )}
    </Drawer>
  )
}

export function OpsOrdersPage() {
  const [lookup, setLookup] = useState('')
  const [lookupError, setLookupError] = useState(null)
  const [looking, setLooking] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebouncedValue(filter, 300)
  const { data, error, loading, reload } = useApi(() => opsApi.orders({ q, status, page, pageSize: 15 }), [q, status, page])

  const onLookup = async (event) => {
    event.preventDefault()
    const number = lookup.trim().toUpperCase()
    if (!number) return
    setLooking(true)
    setLookupError(null)
    try {
      await ordersApi.get(number)
      setSelected(number)
    } catch (err) {
      setLookupError(err)
    } finally {
      setLooking(false)
    }
  }

  return (
    <>
      <PageHeader title="Order lookup" description="Find any order by its number and check its live status, items and fulfillment." />

      <Card className="mb-6 p-5">
        <form onSubmit={onLookup} className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="mb-1.5 block text-sm font-medium text-ink">Order number</span>
            <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="e.g. NM-100042" className="font-mono uppercase" />
          </label>
          <Button type="submit" icon={Search} loading={looking}>
            Look up
          </Button>
        </form>
        {lookupError && (
          <div className="mt-3">
            <InlineError error={lookupError} />
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
          <h2 className="mr-auto text-sm font-semibold text-ink">Recent orders</h2>
          <Input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
            placeholder="Filter by order number"
            className="w-56"
            aria-label="Filter by order number"
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="w-auto"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {prettyEnum(s)}
              </option>
            ))}
          </Select>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} title="We couldn't load orders" />
        ) : !data ? (
          <Spinner label="Loading orders…" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Receipt} title="No orders match" />
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className={table.wrapper}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Order</th>
                    <th className={table.th}>Customer</th>
                    <th className={table.th}>Fulfillment</th>
                    <th className={`${table.th} text-right`}>Items</th>
                    <th className={`${table.th} text-right`}>Total</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((order) => (
                    <tr key={order.orderNumber} className={`${table.row} cursor-pointer hover:bg-slate-50`} onClick={() => setSelected(order.orderNumber)}>
                      <td className={table.td}>
                        <button type="button" className="font-mono font-medium text-ink hover:text-brand-700" onClick={() => setSelected(order.orderNumber)}>
                          {order.orderNumber}
                        </button>
                      </td>
                      <td className={table.td}>{order.customerName}</td>
                      <td className={table.td}>
                        {order.fulfillmentType === 'PICKUP' ? `Pickup · ${order.storeName.replace('NovaMart ', '')}` : 'Home delivery'}
                      </td>
                      <td className={table.num}>{order.itemCount}</td>
                      <td className={table.num}>{formatINR(order.total)}</td>
                      <td className={table.td}>
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className={`${table.td} whitespace-nowrap text-xs text-ink-3`}>{timeAgo(order.placedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-hairline px-4 py-3">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </div>
          </div>
        )}
      </Card>

      {selected && <OrderDrawer orderNumber={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
