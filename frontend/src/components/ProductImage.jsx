import { useState } from 'react'
import { ProductVisual, VISUAL_SIZES } from './ProductVisual'

/**
 * A product photo with a loading shimmer. Falls back to the category visual when there is no image URL
 * or the image fails to load (offline, blocked or broken link). Same sizes as ProductVisual.
 */
export function ProductImage({ src, alt = '', categorySlug, brand, size = 'md', className = '' }) {
  // Tracking the src that loaded or failed (rather than a status flag) resets correctly when src changes.
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [failedSrc, setFailedSrc] = useState(null)

  if (!src || failedSrc === src) {
    return <ProductVisual categorySlug={categorySlug} brand={brand} size={size} className={className} />
  }
  const loaded = loadedSrc === src
  return (
    <div className={`relative shrink-0 overflow-hidden bg-slate-100 ${VISUAL_SIZES[size].box} ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
        className={`size-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
