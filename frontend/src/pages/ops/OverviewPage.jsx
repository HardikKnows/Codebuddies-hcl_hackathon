import { ArrowRight, Bot, CircleAlert, CircleX, IndianRupee, PencilLine, Receipt, RefreshCw, Ticket, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { opsApi } from '../../api'
import { MANAGER_ROLES, useAuth } from '../../auth/AuthContext'
import { AvailabilityBadge, OutcomeBadge, SourceBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card, CardHeader, PageHeader, table } from '../../components/Misc'
import { useToast } from '../../components/Overlay'
import { ProductImage } from '../../components/ProductImage'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { StockAdjustmentModal } from '../../features/StockAdjustmentModal'
import { formatINR, formatINRCompact, formatNumber, prettyAction, timeAgo } from '../../lib/format'
import { useApi } from '../../lib/useApi'

const ICON_COLORS = { warning: 'text-warning', critical: 'text-critical', serious: 'text-serious', neutral: 'text-ink-3' }

/** Stat tile: label, value in ink (never the status color), and an icon that carries the status. */
export function StatTile({ label, value, note, icon: Icon, tone = 'neutral', title }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white px-4 py-3.5 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <Icon className={`size-4 shrink-0 ${ICON_COLORS[tone]}`} aria-hidden="true" />
      </div>
      <p className="mt-1.5 text-[1.75rem] font-semibold leading-9 tracking-tight text-ink tabular-nums" title={title}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-3">{note}</p>
    </div>
  )
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-27 rounded-2xl" />
      ))}
    </div>
  )
}

export function OverviewPage() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi(() => opsApi.summary(), [])
  const toast = useToast()
  const [updatedAt, setUpdatedAt] = useState(null)
  const [adjusting, setAdjusting] = useState(null)
  const canSeeAudit = MANAGER_ROLES.includes(user.role)
  // Mirrors the server's rule for showing the action; the server still authorizes every update.
  const canAdjustAny = user.role === 'ADMIN' || user.role === 'STORE_MANAGER'
  const canAdjust = (row) => user.role === 'ADMIN' || (user.role === 'STORE_MANAGER' && row.storeId === user.storeId)

  const onAdjusted = (result) => {
    setAdjusting(null)
    toast(`${result.row.productName}: ${result.previousQuantity} → ${result.row.quantity} units`)
    reload()
  }

  useEffect(() => {
    if (data) setUpdatedAt(new Date())
  }, [data])

  const actions = (
    <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading && Boolean(data)} onClick={reload}>
      Refresh
    </Button>
  )

  if (error) {
    return (
      <>
        <PageHeader title="Operations overview" actions={actions} />
        <ErrorState error={error} onRetry={reload} title="We couldn't load the overview" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={user.storeName || 'All locations'}
        title="Operations overview"
        description={`Inventory health, support load and AI activity across NovaMart${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}`}
        actions={actions}
      />

      {!data ? (
        <TilesSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Low stock" value={formatNumber(data.lowStockCount)} note="Product–location pairs at or below reorder level" icon={TriangleAlert} tone="warning" />
          <StatTile label="Out of stock" value={formatNumber(data.outOfStockCount)} note="Product–location pairs with zero units" icon={CircleX} tone="critical" />
          <StatTile label="Open tickets" value={formatNumber(data.openTickets)} note="Open, in progress or escalated" icon={Ticket} />
          <StatTile label="Escalated tickets" value={formatNumber(data.escalatedTickets)} note="Waiting on a manager" icon={CircleAlert} tone="serious" />
          <StatTile label="Orders today" value={formatNumber(data.ordersToday)} note="Excludes cancelled orders" icon={Receipt} />
          <StatTile label="Revenue today" value={formatINRCompact(data.revenueToday)} note={formatINR(data.revenueToday)} title={formatINR(data.revenueToday)} icon={IndianRupee} />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Low-stock alerts"
            description={canAdjustAny ? 'Most urgent first. Update stock for your store right here.' : 'Most urgent first: out of stock, then lowest units'}
            action={
              <Button as={Link} to="/ops/inventory?status=LOW_STOCK" variant="ghost" size="xs" iconRight={ArrowRight}>
                All inventory
              </Button>
            }
          />
          {!data ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : data.lowStockItems.length === 0 ? (
            <EmptyState icon={TriangleAlert} title="No low-stock items" description="Every location is above its reorder level." />
          ) : (
            <div className={table.wrapper}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Product</th>
                    <th className={table.th}>Location</th>
                    <th className={table.th}>Stock</th>
                    {canAdjustAny && (
                      <th className={`${table.th} text-right`}>
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockItems.map((row) => (
                    <tr key={`${row.storeId}-${row.productId}`} className={table.row}>
                      <td className={table.td}>
                        <div className="flex items-center gap-2.5">
                          <ProductImage src={row.imageUrl} categorySlug={row.categorySlug} size="thumb" />
                          <div className="min-w-0">
                            <p className="font-medium text-ink">{row.productName}</p>
                            <p className="font-mono text-[11px] text-ink-3">{row.productId}</p>
                          </div>
                        </div>
                      </td>
                      <td className={table.td}>
                        {row.storeName.replace('NovaMart ', '')}
                        {row.storeId === user.storeId && <p className="text-[11px] text-brand-700">Your store</p>}
                      </td>
                      <td className={table.td}>
                        <AvailabilityBadge status={row.status} quantity={row.quantity} showQuantity />
                        <p className="mt-0.5 text-[11px] text-ink-3">Reorder at {row.reorderLevel}</p>
                      </td>
                      {canAdjustAny && (
                        <td className={`${table.td} whitespace-nowrap text-right`}>
                          {canAdjust(row) ? (
                            <Button size="xs" variant="secondary" icon={PencilLine} onClick={() => setAdjusting(row)} aria-label={`Update stock for ${row.productName}`}>
                              Update
                            </Button>
                          ) : (
                            <span className="text-xs text-ink-3" title="Managers can only update their own store">
                              —
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Stock health by location" description="Product–location pairs needing attention" />
          {!data ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <div className={table.wrapper}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Location</th>
                    <th className={`${table.th} text-right`}>Low</th>
                    <th className={`${table.th} text-right`}>Out</th>
                    <th className={`${table.th} text-right`}>Units</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stores.map((store) => (
                    <tr key={store.storeId} className={`${table.row} ${store.storeId === user.storeId ? 'bg-brand-50/60' : ''}`}>
                      <td className={table.td}>
                        <Link to={`/ops/inventory?storeId=${store.storeId}`} className="font-medium text-ink hover:text-brand-700">
                          {store.storeName.replace('NovaMart ', '')}
                        </Link>
                        <p className="text-[11px] text-ink-3">
                          {store.storeCode} · {store.type === 'WAREHOUSE' ? 'Warehouse' : 'Store'}
                          {store.storeId === user.storeId ? ' · your store' : ''}
                        </p>
                      </td>
                      <td className={table.num}>
                        <span className="inline-flex items-center gap-1">
                          <TriangleAlert className="size-3.5 text-warning" aria-label="Low stock" />
                          {store.lowStock}
                        </span>
                      </td>
                      <td className={table.num}>
                        <span className="inline-flex items-center gap-1">
                          <CircleX className="size-3.5 text-critical" aria-label="Out of stock" />
                          {store.outOfStock}
                        </span>
                      </td>
                      <td className={`${table.num} text-ink-2`}>{formatNumber(store.totalUnits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Recent activity"
          description="Latest audited actions, including every AI tool call"
          action={
            canSeeAudit && (
              <Button as={Link} to="/ops/audit" variant="ghost" size="xs" iconRight={ArrowRight}>
                Audit log
              </Button>
            )
          }
        />
        {!canSeeAudit ? (
          <p className="px-5 py-6 text-sm text-ink-3">The activity feed is available to store managers and admins.</p>
        ) : !data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.recentActivity.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-3">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-hairline/70">
            {data.recentActivity.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <OutcomeBadge outcome={event.outcome} />
                <span className="font-medium text-ink">{prettyAction(event.action)}</span>
                {event.entityId && <span className="font-mono text-xs text-ink-2">{event.entityId}</span>}
                {event.source === 'AI_ASSISTANT' && <SourceBadge source={event.source} />}
                <span className="ml-auto flex items-center gap-1 text-xs text-ink-3">
                  {event.source === 'AI_ASSISTANT' && <Bot className="size-3.5" aria-hidden="true" />}
                  {event.actorName || 'System'} · {timeAgo(event.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {adjusting && <StockAdjustmentModal row={adjusting} onClose={() => setAdjusting(null)} onUpdated={onAdjusted} />}
    </>
  )
}
