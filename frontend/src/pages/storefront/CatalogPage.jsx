import { SearchX, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { catalogApi } from '../../api'
import { Button } from '../../components/Button'
import { Input, Select, Toggle } from '../../components/Form'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState } from '../../components/States'
import { useAssistant } from '../../features/assistant/AssistantContext'
import { ProductCard, ProductCardSkeleton } from '../../features/ProductCard'
import { useStores } from '../../features/StoreContext'
import { formatINR, formatNumber } from '../../lib/format'
import { useApi } from '../../lib/useApi'

const PAGE_SIZE = 12

const SORTS = [
  ['relevance', 'Best match'],
  ['rating', 'Top rated'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name', 'Name A–Z'],
]

const PRICE_RANGES = [
  { label: 'Under ₹10k', max: 10000 },
  { label: '₹10k – ₹30k', min: 10000, max: 30000 },
  { label: '₹30k – ₹60k', min: 30000, max: 60000 },
  { label: '₹60k – ₹1L', min: 60000, max: 100000 },
  { label: 'Above ₹1L', min: 100000 },
]

function Hero({ onAsk, onBrowse }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-brand-900 via-brand-700 to-brand-500 px-6 py-6 text-white shadow-lg shadow-brand-900/15 sm:px-10">
      <div className="absolute -right-16 -top-24 size-72 rounded-full bg-white/10" aria-hidden="true" />
      <div className="absolute -bottom-28 right-28 size-56 rounded-full bg-violet-300/20" aria-hidden="true" />
      <div className="relative max-w-2xl">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
          <Sparkles className="size-3.5" aria-hidden="true" /> New: AI shopping assistant
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[2.125rem] sm:leading-tight">Find the right product, in stock at your store.</h1>
        <p className="mt-1.5 text-sm text-brand-100 sm:text-base">
          Describe what you need in plain words. RetailPulse recommends real products from NovaMart's catalog, checks live stock
          and answers policy questions with sources.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={onAsk} variant="light" icon={Sparkles}>
            Ask the assistant
          </Button>
          <Button onClick={onBrowse} variant="onDark">
            Browse laptops
          </Button>
        </div>
      </div>
    </section>
  )
}

function Filters({ categories, brands, filters, update, storeLabel }) {
  const [minDraft, setMinDraft] = useState(filters.minPrice)
  const [maxDraft, setMaxDraft] = useState(filters.maxPrice)
  const parents = categories.filter((c) => !c.parentSlug)
  const childrenOf = (slug) => categories.filter((c) => c.parentSlug === slug)
  const categoryButton = (active) =>
    `block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
      active ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-2 hover:bg-slate-100 hover:text-ink'
    }`

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Category</h2>
        <button type="button" className={categoryButton(!filters.category)} onClick={() => update({ category: '' })}>
          All products
        </button>
        {parents.map((parent) => (
          <div key={parent.slug} className="mt-1">
            <button type="button" className={`${categoryButton(filters.category === parent.slug)} font-medium`} onClick={() => update({ category: parent.slug })}>
              {parent.name}
            </button>
            <div className="ml-3 border-l border-hairline pl-1.5">
              {childrenOf(parent.slug).map((child) => (
                <button key={child.slug} type="button" className={categoryButton(filters.category === child.slug)} onClick={() => update({ category: child.slug })}>
                  {child.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Availability</h2>
        <Toggle id="in-stock" checked={filters.inStock} onChange={(checked) => update({ inStock: checked })} label={`In stock at ${storeLabel}`} />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Brand</h2>
        <Select value={filters.brand} onChange={(e) => update({ brand: e.target.value })} aria-label="Brand">
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.name}>
              {brand.name}
            </option>
          ))}
        </Select>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Price</h2>
        <div className="flex flex-wrap gap-1.5">
          {PRICE_RANGES.map((range) => {
            const active = filters.minPrice === String(range.min ?? '') && filters.maxPrice === String(range.max ?? '')
            return (
              <button
                key={range.label}
                type="button"
                onClick={() => {
                  const next = active ? { minPrice: '', maxPrice: '' } : { minPrice: range.min ?? '', maxPrice: range.max ?? '' }
                  setMinDraft(String(next.minPrice))
                  setMaxDraft(String(next.maxPrice))
                  update(next)
                }}
                className={`rounded-full px-2.5 py-1 text-xs ring-1 transition ${
                  active ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-2 ring-hairline hover:ring-brand-300'
                }`}
              >
                {range.label}
              </button>
            )
          })}
        </div>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            update({ minPrice: minDraft, maxPrice: maxDraft })
          }}
        >
          <Input type="number" min="0" inputMode="numeric" placeholder="Min" value={minDraft} onChange={(e) => setMinDraft(e.target.value)} aria-label="Minimum price" className="h-9" />
          <span className="text-ink-3">–</span>
          <Input type="number" min="0" inputMode="numeric" placeholder="Max" value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} aria-label="Maximum price" className="h-9" />
          <Button type="submit" size="sm" variant="secondary">
            Go
          </Button>
        </form>
      </section>
    </div>
  )
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const { selectedStoreId, selectedStore } = useStores()
  const { openWith } = useAssistant()
  const [showFilters, setShowFilters] = useState(false)

  const filters = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    brand: params.get('brand') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    inStock: params.get('inStock') === '1',
  }
  const sort = params.get('sort') || (filters.q ? 'relevance' : 'rating')
  const page = Math.max(1, Number(params.get('page')) || 1)

  const update = (changes, keepPage = false) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key)
      else next.set(key, value === true ? '1' : String(value))
    })
    if (!keepPage) next.delete('page')
    setParams(next)
  }

  const categories = useApi(() => catalogApi.categories(), [])
  const brands = useApi(() => catalogApi.brands(), [])
  const products = useApi(
    () =>
      catalogApi.products({
        q: filters.q,
        category: filters.category,
        brand: filters.brand,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        inStock: filters.inStock || undefined,
        storeId: selectedStoreId,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [filters.q, filters.category, filters.brand, filters.minPrice, filters.maxPrice, filters.inStock, sort, page, selectedStoreId],
  )

  const categoryName = useMemo(
    () => categories.data?.find((c) => c.slug === filters.category)?.name,
    [categories.data, filters.category],
  )
  const storeLabel = selectedStore ? selectedStore.name.replace('NovaMart ', '') : 'my store'
  const hasFilters = Boolean(filters.q || filters.category || filters.brand || filters.minPrice || filters.maxPrice || filters.inStock)

  const chips = [
    filters.q && { key: 'q', label: `“${filters.q}”` },
    filters.category && { key: 'category', label: categoryName || filters.category },
    filters.brand && { key: 'brand', label: filters.brand },
    (filters.minPrice || filters.maxPrice) && {
      key: 'price',
      label: `${filters.minPrice ? formatINR(filters.minPrice) : '₹0'} – ${filters.maxPrice ? formatINR(filters.maxPrice) : 'any'}`,
    },
    filters.inStock && { key: 'inStock', label: `In stock at ${storeLabel}` },
  ].filter(Boolean)

  const removeChip = (key) => (key === 'price' ? update({ minPrice: '', maxPrice: '' }) : update({ [key]: '' }))
  const title = filters.q ? `Results for “${filters.q}”` : categoryName || 'All products'

  return (
    <>
      {!hasFilters && page === 1 && (
        <Hero
          onAsk={() => openWith({ prompt: 'Laptop for Java development under ₹80,000' })}
          onBrowse={() => update({ category: 'laptops' })}
        />
      )}

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
          <div className="rounded-2xl border border-hairline bg-white p-4 lg:sticky lg:top-24">
            {categories.data && brands.data ? (
              <Filters
                key={`${filters.minPrice}-${filters.maxPrice}`}
                categories={categories.data}
                brands={brands.data}
                filters={filters}
                update={update}
                storeLabel={storeLabel}
              />
            ) : categories.error ? (
              <p className="text-sm text-ink-2">Filters are unavailable right now.</p>
            ) : (
              <p className="text-sm text-ink-3">Loading filters…</p>
            )}
            {hasFilters && (
              <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={() => setParams(new URLSearchParams())}>
                Clear all filters
              </Button>
            )}
          </div>
        </aside>

        <section aria-labelledby="results-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="results-title" className="text-xl font-semibold tracking-tight text-ink">
                {title}
              </h1>
              <p className="mt-0.5 text-sm text-ink-3">
                {products.data ? `${formatNumber(products.data.total)} products` : 'Loading products…'} · availability shown for {storeLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon={SlidersHorizontal} className="lg:hidden" onClick={() => setShowFilters((s) => !s)}>
                Filters
              </Button>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <span className="hidden whitespace-nowrap sm:inline">Sort by</span>
                <Select value={sort} onChange={(e) => update({ sort: e.target.value })} className="h-9 w-auto" aria-label="Sort products">
                  {SORTS.filter(([value]) => value !== 'relevance' || filters.q).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-medium text-brand-800 ring-1 ring-brand-200">
                  {chip.label}
                  <button type="button" onClick={() => removeChip(chip.key)} aria-label={`Remove filter ${chip.label}`} className="rounded-full p-0.5 hover:bg-brand-100">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {products.error ? (
            <ErrorState error={products.error} onRetry={products.reload} title="We couldn't load products" />
          ) : !products.data ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.data.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No products match these filters"
              description="Try a broader search, another category, or ask the assistant to suggest alternatives."
              action={
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
                    Clear filters
                  </Button>
                  <Button icon={Sparkles} onClick={() => openWith({ prompt: filters.q || 'Help me find a product' })}>
                    Ask the assistant
                  </Button>
                </div>
              }
            />
          ) : (
            <div className={`transition-opacity ${products.loading ? 'opacity-60' : ''}`}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {products.data.items.map((product) => (
                  <ProductCard key={product.productId} product={product} storeName={selectedStore?.name} />
                ))}
              </div>
              <Pagination
                className="mt-6"
                page={products.data.page}
                pageSize={products.data.pageSize}
                total={products.data.total}
                onPageChange={(p) => {
                  update({ page: p }, true)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </div>
          )}
        </section>
      </div>
    </>
  )
}
