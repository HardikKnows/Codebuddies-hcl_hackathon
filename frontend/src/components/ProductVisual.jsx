import {
  CookingPot,
  Headphones,
  Laptop,
  Package,
  Refrigerator,
  Smartphone,
  Tv,
  WashingMachine,
  Watch,
} from 'lucide-react'

const VISUALS = {
  laptops: { Icon: Laptop, background: 'bg-linear-to-br from-indigo-500 to-violet-600' },
  mobiles: { Icon: Smartphone, background: 'bg-linear-to-br from-sky-500 to-indigo-600' },
  audio: { Icon: Headphones, background: 'bg-linear-to-br from-fuchsia-500 to-purple-700' },
  wearables: { Icon: Watch, background: 'bg-linear-to-br from-rose-500 to-orange-500' },
  televisions: { Icon: Tv, background: 'bg-linear-to-br from-slate-700 to-slate-950' },
  refrigerators: { Icon: Refrigerator, background: 'bg-linear-to-br from-cyan-500 to-sky-700' },
  'washing-machines': { Icon: WashingMachine, background: 'bg-linear-to-br from-teal-500 to-cyan-700' },
  'kitchen-appliances': { Icon: CookingPot, background: 'bg-linear-to-br from-amber-500 to-orange-600' },
}

const FALLBACK = { Icon: Package, background: 'bg-linear-to-br from-slate-500 to-slate-700' }

export const VISUAL_SIZES = {
  thumb: { box: 'size-10 rounded-lg', icon: 'size-5', label: false },
  xs: { box: 'size-12 rounded-lg', icon: 'size-6', label: false },
  sm: { box: 'size-16 rounded-xl', icon: 'size-7', label: false },
  md: { box: 'aspect-[4/3] w-full rounded-xl', icon: 'size-14', label: true },
  lg: { box: 'aspect-square w-full rounded-2xl', icon: 'size-28', label: true },
}

/** A category-themed placeholder, shown when a product has no photo or its photo fails to load. */
export function ProductVisual({ categorySlug, brand, size = 'md', className = '' }) {
  const { Icon, background } = VISUALS[categorySlug] || FALLBACK
  const s = VISUAL_SIZES[size]
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden ${background} ${s.box} ${className}`} aria-hidden="true">
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 -left-6 size-36 rounded-full bg-black/10" />
      <Icon className={`relative text-white drop-shadow ${s.icon}`} strokeWidth={1.4} />
      {s.label && brand && (
        <span className="absolute bottom-2.5 left-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">{brand}</span>
      )}
    </div>
  )
}
