import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { AvailabilityBadge } from '../components/Badge'
import { Button } from '../components/Button'
import { Rating } from '../components/Misc'
import { useToast } from '../components/Overlay'
import { ProductImage } from '../components/ProductImage'
import { Skeleton } from '../components/States'
import { formatINR } from '../lib/format'
import { useCart } from './CartContext'

export function ProductCard({ product, storeName }) {
  const { addItem } = useCart()
  const toast = useToast()
  const href = `/products/${product.productId}`

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={href} className="block p-2.5 pb-0" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.imageUrl} categorySlug={product.categorySlug} brand={product.brand} className="transition group-hover:brightness-105" />
      </Link>
      <div className="flex flex-1 flex-col p-4 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{product.brand}</p>
        <Link to={href} className="mt-0.5 line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-ink hover:text-brand-700">
          {product.name}
        </Link>
        <Rating value={product.rating} count={product.ratingCount} className="mt-1.5" />
        <div className="mt-auto pt-3">
          <p className="text-lg font-semibold text-ink">{formatINR(product.price)}</p>
          {/* Narrow cards stack availability above a full-width button, so neither is ever clipped. */}
          <div className="mt-2 flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between">
            <span title={storeName ? `Stock at ${storeName}` : 'Stock across all locations'}>
              <AvailabilityBadge status={product.availability} quantity={product.availableQuantity} showQuantity />
            </span>
            <Button
              size="xs"
              variant="subtle"
              icon={Plus}
              onClick={() => {
                addItem(product.productId, 1)
                toast(`${product.name} added to cart`)
              }}
              aria-label={`Add ${product.name} to cart`}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-hairline bg-white p-2.5">
      <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      <div className="space-y-2 p-2 pt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-4 h-6 w-24" />
      </div>
    </div>
  )
}
