import { Boxes, CircleX, Download, FileSpreadsheet, PencilLine, RefreshCw, Search, TriangleAlert, Upload, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { dataApi, opsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { AvailabilityBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Form'
import { MenuButton } from '../../components/Menu'
import { Card, PageHeader, table } from '../../components/Misc'
import { useToast } from '../../components/Overlay'
import { ProductImage } from '../../components/ProductImage'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, InlineError, Spinner } from '../../components/States'
import { INVENTORY_CHANGED_EVENT } from '../../features/assistant/AssistantResults'
import { CsvImportModal } from '../../features/CsvImportModal'
import { StockAdjustmentModal } from '../../features/StockAdjustmentModal'
import { useStores } from '../../features/StoreContext'
import { formatNumber, timeAgo } from '../../lib/format'
import { useApi, useDebouncedValue } from '../../lib/useApi'
import { StatTile } from './OverviewPage'

const PAGE_SIZE = 20

const rowKey = (row) => `${row.storeId}-${row.productId}`

/** Stock-health KPIs for the selected location (or all locations), refreshed after every stock change. */
function StockHealth({ summary, storeId }) {
  if (!summary) return null
  const store = storeId ? summary.stores.find((s) => String(s.storeId) === storeId) : null
  const scope = store ? store.storeName.replace('NovaMart ', '') : 'All locations'
  const low = store ? store.lowStock : summary.lowStockCount
  const out = store ? store.outOfStock : summary.outOfStockCount
  const units = store ? store.totalUnits : summary.stores.reduce((total, s) => total + s.totalUnits, 0)
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatTile label="Low stock" value={formatNumber(low)} note={`${scope} · at or below reorder level`} icon={TriangleAlert} tone="warning" />
      <StatTile label="Out of stock" value={formatNumber(out)} note={`${scope} · zero units`} icon={CircleX} tone="critical" />
      <StatTile label="Units on hand" value={formatNumber(units)} note={scope} icon={Boxes} />
    </div>
  )
}

function SimulationResult({ result, onDismiss }) {
  return (
    <Card className="rp-fade-up mb-6 border-brand-200">
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {result.kind === 'DEMAND_SPIKE' ? 'Demand spike simulated' : 'Restock simulated'} at {result.storeName}
          </p>
          <p className="text-xs text-ink-3">
            {result.changes.length} product{result.changes.length === 1 ? '' : 's'} changed · recorded in the audit log
          </p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded-md p-1 text-ink-3 hover:bg-slate-100 hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      {result.changes.length === 0 ? (
        <p className="px-5 py-3 text-sm text-ink-2">Nothing needed to change.</p>
      ) : (
        <ul className="divide-y divide-hairline/70">
          {result.changes.map((change) => (
            <li key={change.productId} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
              <span className="font-medium text-ink">{change.productName}</span>
              <span className="font-mono text-[11px] text-ink-3">{change.productId}</span>
              <span className="ml-auto tabular-nums text-ink-2">
                {change.before} → <span className="font-semibold text-ink">{change.after}</span>
              </span>
              <AvailabilityBadge status={change.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function InventoryPage() {
  const { user } = useAuth()
  const { stores } = useStores()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const storeId = params.get('storeId') ?? (user.storeId ? String(user.storeId) : '')
  const status = params.get('status') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebouncedValue(search, 300)
  const [simulating, setSimulating] = useState(null)
  const [simResult, setSimResult] = useState(null)
  const [simError, setSimError] = useState(null)
  const [adjusting, setAdjusting] = useState(null)
  const [updatedRows, setUpdatedRows] = useState({}) // rows refreshed in place after an individual update
  const [highlight, setHighlight] = useState(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const summary = useApi(() => opsApi.summary(), [])

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => next.set(key, value))
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (q !== (params.get('q') || '')) update({ q })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const { data, error, loading, reload } = useApi(
    () => opsApi.inventory({ storeId, status, q, page, pageSize: PAGE_SIZE }),
    [storeId, status, q, page],
  )

  // A fresh page of rows replaces any in-place updates.
  useEffect(() => setUpdatedRows({}), [data])

  // Stock changes confirmed in the AI assistant refresh this view too.
  const reloadSummary = summary.reload
  useEffect(() => {
    const onInventoryChanged = () => {
      reload()
      reloadSummary()
    }
    window.addEventListener(INVENTORY_CHANGED_EVENT, onInventoryChanged)
    return () => window.removeEventListener(INVENTORY_CHANGED_EVENT, onInventoryChanged)
  }, [reload, reloadSummary])

  useEffect(() => {
    if (!highlight) return undefined
    const timer = setTimeout(() => setHighlight(null), 4000)
    return () => clearTimeout(timer)
  }, [highlight])

  const selectedStore = stores.find((s) => String(s.id) === storeId)
  const canSimulate = Boolean(storeId) && (user.role === 'ADMIN' || (user.role === 'STORE_MANAGER' && String(user.storeId) === storeId))
  // Mirrors the server's rule (managers: own store, admins: any store); the server enforces it regardless.
  const canAdjustAny = user.role === 'ADMIN' || user.role === 'STORE_MANAGER'
  const canAdjust = (row) => user.role === 'ADMIN' || (user.role === 'STORE_MANAGER' && row.storeId === user.storeId)

  // Product imports change the global catalog (admins); stock imports stay within the user's store (managers, admins).
  const importKinds = [user.role === 'ADMIN' && 'products', canAdjustAny && 'inventory'].filter(Boolean)
  // Exports of inventory are limited to the user's own store unless they are an admin; the server enforces this too.
  const canExportInventory = user.role === 'ADMIN' || (Boolean(storeId) && Number(storeId) === user.storeId)
  const exportScope = selectedStore ? selectedStore.name.replace('NovaMart ', '') : 'All locations'

  const runExport = async (kind) => {
    setExporting(true)
    try {
      const filename = kind === 'catalog' ? await dataApi.exportCatalog() : await dataApi.exportInventory({ storeId, status, q })
      toast(`Downloaded ${filename}`)
    } catch (err) {
      toast(err.message, 'critical')
    } finally {
      setExporting(false)
    }
  }

  const onImported = (result) => {
    toast(`Import complete: ${result.inserted} added, ${result.updated} updated`)
    reload()
    summary.reload()
  }

  const onAdjusted = (result) => {
    const key = rowKey(result.row)
    setUpdatedRows((current) => ({ ...current, [key]: result.row }))
    setHighlight(key)
    setAdjusting(null)
    toast(`${result.row.productName}: ${result.previousQuantity} → ${result.row.quantity} units`)
    summary.reload()
  }

  const simulate = async (kind) => {
    setSimulating(kind)
    setSimError(null)
    try {
      const result = await opsApi.simulate({ storeId: Number(storeId), kind })
      setSimResult(result)
      toast(kind === 'DEMAND_SPIKE' ? 'Demand spike applied' : 'Low items restocked')
      reload()
      summary.reload()
    } catch (err) {
      setSimError(err)
    } finally {
      setSimulating(null)
    }
  }

  return (
    <>
      <PageHeader title="Inventory" description="Live stock by location. Availability is derived from these rows everywhere in the app." />

      <StockHealth summary={summary.data} storeId={storeId} />

      {user.role === 'STORE_MANAGER' && !canSimulate && (
        <p className="mb-4 text-xs text-ink-3">
          Select {user.storeName || 'your store'} to simulate stock events or export its inventory. Managers can only change their own store.
        </p>
      )}
      {simError && (
        <div className="mb-4">
          <InlineError error={simError} />
        </div>
      )}
      {simResult && <SimulationResult result={simResult} onDismiss={() => setSimResult(null)} />}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
          <Select value={storeId} onChange={(e) => update({ storeId: e.target.value })} className="w-auto min-w-48" aria-label="Location">
            <option value="">All locations</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name.replace('NovaMart ', '')} ({store.code})
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => update({ status: e.target.value })} className="w-auto" aria-label="Status">
            <option value="">All statuses</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="IN_STOCK">In stock</option>
          </Select>
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search inventory</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU or brand" className="pl-9" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {canSimulate && (
              <MenuButton
                label="Stock events"
                icon={Zap}
                loading={Boolean(simulating)}
                items={[
                  { label: 'Simulate demand spike', description: 'Drains stock on 3 popular items, like a busy day', icon: Zap, onClick: () => simulate('DEMAND_SPIKE') },
                  { label: 'Restock low items', description: 'Refills every low or out-of-stock item', icon: RefreshCw, onClick: () => simulate('RESTOCK') },
                ]}
              />
            )}
            {importKinds.length > 0 && (
              <Button variant="secondary" size="sm" icon={Upload} onClick={() => setImporting(true)}>
                Import CSV
              </Button>
            )}
            <MenuButton
              label="Export CSV"
              icon={Download}
              loading={exporting}
              items={[
                {
                  label: 'Inventory in this view',
                  description: `${exportScope}${status ? ` · ${status.toLowerCase().replace(/_/g, ' ')}` : ''}${q ? ` · “${q}”` : ''}`,
                  icon: Boxes,
                  disabled: !canExportInventory,
                  hint: `Select ${user.storeName || 'your store'} first: you can only export your own store's inventory.`,
                  onClick: () => runExport('inventory'),
                },
                { label: 'Product catalog', description: 'Every product with price, image URL and specifications', icon: FileSpreadsheet, onClick: () => runExport('catalog') },
              ]}
            />
          </div>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={reload} title="We couldn't load inventory" />
        ) : !data ? (
          <Spinner label="Loading inventory…" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Boxes} title="No inventory rows match" description="Try another location, status or search term." />
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className={table.wrapper}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Product</th>
                    <th className={`${table.th} hidden xl:table-cell`}>Category</th>
                    <th className={table.th}>Location</th>
                    <th className={`${table.th} text-right`}>Units</th>
                    <th className={`${table.th} text-right`}>Reorder at</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Updated</th>
                    {canAdjustAny && (
                      <th className={table.th}>
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((listed) => updatedRows[rowKey(listed)] || listed).map((row) => (
                    <tr key={rowKey(row)} className={`${table.row} transition-colors duration-700 ${highlight === rowKey(row) ? 'bg-green-50' : ''}`}>
                      <td className={table.td}>
                        <div className="flex items-center gap-3">
                          <ProductImage src={row.imageUrl} categorySlug={row.categorySlug} size="thumb" />
                          <div className="min-w-36">
                            <p className="font-medium text-ink">{row.productName}</p>
                            <p className="text-[11px] text-ink-3">
                              <span className="font-mono">{row.productId}</span> · {row.brand}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`${table.td} hidden xl:table-cell`}>{row.category}</td>
                      <td className={table.td}>{row.storeName.replace('NovaMart ', '')}</td>
                      <td className={table.num}>{row.quantity}</td>
                      <td className={`${table.num} text-ink-3`}>{row.reorderLevel}</td>
                      <td className={table.td}>
                        <AvailabilityBadge status={row.status} />
                      </td>
                      <td className={`${table.td} whitespace-nowrap text-xs text-ink-3`}>{timeAgo(row.updatedAt)}</td>
                      {canAdjustAny && (
                        <td className={`${table.td} whitespace-nowrap text-right`}>
                          {canAdjust(row) ? (
                            <Button size="xs" variant="secondary" icon={PencilLine} onClick={() => setAdjusting(row)}>
                              Update stock
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
            <div className="border-t border-hairline px-4 py-3">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(p) => update({ page: String(p) })} />
            </div>
          </div>
        )}
      </Card>

      {adjusting && <StockAdjustmentModal row={adjusting} onClose={() => setAdjusting(null)} onUpdated={onAdjusted} />}
      {importing && <CsvImportModal kinds={importKinds} onClose={() => setImporting(false)} onImported={onImported} />}
    </>
  )
}
