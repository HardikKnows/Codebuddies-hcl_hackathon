import { ChevronRight, Minus, Plus, SearchX, ShieldCheck, ShoppingCart, Sparkles, Store, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { catalogApi } from '../../api'
import { AvailabilityBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Card, CardHeader, Rating, table } from '../../components/Misc'
import { useToast } from '../../components/Overlay'
import { ProductImage } from '../../components/ProductImage'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { useAssistant } from '../../features/assistant/AssistantContext'
import { useCart } from '../../features/CartContext'
import { useStores } from '../../features/StoreContext'
import { formatINR, formatSpecValue, prettySpecKey } from '../../lib/format'
import { useApi } from '../../lib/useApi'

function QuantityStepper({ value, onChange, max = 10 }) {
  return (
    <div className="inline-flex h-11 items-center rounded-xl border border-hairline bg-white">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Decrease quantity" className="flex h-full w-10 items-center justify-center text-ink-2 hover:text-ink disabled:text-ink-3">
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity" className="flex h-full w-10 items-center justify-center text-ink-2 hover:text-ink disabled:text-ink-3">
        <Plus className="size-4" />
      </button>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-56" />
      </div>
    </div>
  )
}

export function ProductPage() {
  const { sku } = useParams()
  const { selectedStoreId, selectedStore } = useStores()
  const { addItem } = useCart()
  const { openWith } = useAssistant()
  const toast = useToast()
  const [quantity, setQuantity] = useState(1)
  const { data: product, error, reload } = useApi(() => catalogApi.product(sku, selectedStoreId), [sku, selectedStoreId])

  if (error) {
    return error.status === 404 ? (
      <EmptyState
        icon={SearchX}
        title="Product not found"
        description={`We couldn't find a product with ID ${sku}. It may have been removed from the catalog.`}
        action={
          <Button as={Link} to="/" variant="secondary">
            Back to catalog
          </Button>
        }
      />
    ) : (
      <ErrorState error={error} onRetry={reload} title="We couldn't load this product" />
    )
  }
  if (!product || product.productId !== sku.toUpperCase()) return <ProductSkeleton />

  const warehouse = product.stores.find((s) => s.type === 'WAREHOUSE')
  const atStore = product.stores.find((s) => s.storeId === selectedStoreId)
  const specs = Object.entries(product.specifications || {})

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1 text-sm text-ink-3" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink">
          Catalog
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <Link to={`/?category=${product.categorySlug}`} className="hover:text-ink">
          {product.category}
        </Link>
        <ChevronRight className="size-4" aria-hidden="true" />
        <span className="truncate text-ink-2">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <ProductImage src={product.imageUrl} alt={product.name} categorySlug={product.categorySlug} brand={product.brand} size="lg" className="shadow-sm" />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Rating value={product.rating} count={product.ratingCount} />
            <span className="font-mono text-xs text-ink-3">ID {product.productId}</span>
          </div>
          <p className="mt-5 text-3xl font-semibold text-ink">{formatINR(product.price)}</p>
          <p className="mt-1 text-xs text-ink-3">Inclusive of all taxes · price verified from NovaMart's catalog</p>
          <p className="mt-5 text-sm leading-relaxed text-ink-2">{product.description}</p>

          <div className="mt-6 space-y-2.5 rounded-2xl border border-hairline bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Store className="size-4 text-ink-3" aria-hidden="true" />
              <span className="text-ink-2">
                Pickup at <span className="font-medium text-ink">{selectedStore?.name || 'your store'}</span>
              </span>
              <span className="ml-auto">
                <AvailabilityBadge status={atStore?.status || 'OUT_OF_STOCK'} quantity={atStore?.quantity} showQuantity />
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Truck className="size-4 text-ink-3" aria-hidden="true" />
              <span className="text-ink-2">Home delivery from the central warehouse</span>
              <span className="ml-auto">
                <AvailabilityBadge status={warehouse?.status || 'OUT_OF_STOCK'} quantity={warehouse?.quantity} showQuantity />
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <Button
              size="lg"
              icon={ShoppingCart}
              onClick={() => {
                addItem(product.productId, quantity)
                toast(`${quantity} × ${product.name} added to cart`)
              }}
            >
              Add to cart
            </Button>
          </div>
          <Button
            variant="subtle"
            icon={Sparkles}
            className="mt-3"
            onClick={() =>
              openWith({
                product: { productId: product.productId, name: product.name },
                prompt: `What are the return and warranty terms for the ${product.name}?`,
              })
            }
          >
            Ask about returns & warranty
          </Button>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-3">
            <ShieldCheck className="size-4 text-good" aria-hidden="true" />
            Answers come from NovaMart's approved policy documents, with sources.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Specifications" />
          {specs.length ? (
            <dl className="divide-y divide-hairline/70">
              {specs.map(([key, value]) => (
                <div key={key} className="grid grid-cols-5 gap-4 px-5 py-2.5 text-sm">
                  <dt className="col-span-2 text-ink-3">{prettySpecKey(key)}</dt>
                  <dd className="col-span-3 text-ink">{formatSpecValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-5 py-4 text-sm text-ink-3">No specifications listed.</p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Availability by location" description="Live stock from NovaMart's inventory system" />
          <div className={table.wrapper}>
            <table className={table.table}>
              <thead className={table.head}>
                <tr>
                  <th className={table.th}>Location</th>
                  <th className={`${table.th} text-right`}>Units</th>
                  <th className={table.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {product.stores.map((store) => {
                  const mine = store.storeId === selectedStoreId
                  return (
                    <tr key={store.storeId} className={`${table.row} ${mine ? 'bg-brand-50/60' : ''}`}>
                      <td className={table.td}>
                        <p className="font-medium text-ink">
                          {store.storeName.replace('NovaMart ', '')}
                          {mine && <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">Your store</span>}
                        </p>
                        <p className="text-xs text-ink-3">{store.type === 'WAREHOUSE' ? 'Home delivery' : store.city}</p>
                      </td>
                      <td className={table.num}>{store.quantity}</td>
                      <td className={table.td}>
                        <AvailabilityBadge status={store.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
