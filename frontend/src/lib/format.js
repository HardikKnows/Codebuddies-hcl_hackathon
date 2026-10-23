const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const number = new Intl.NumberFormat('en-IN')
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

const isMissing = (value) => value === null || value === undefined || Number.isNaN(Number(value))

export const formatINR = (value) => (isMissing(value) ? '—' : inr.format(Number(value)))
export const formatINRCompact = (value) => (isMissing(value) ? '—' : inrCompact.format(Number(value)))
export const formatNumber = (value) => (isMissing(value) ? '—' : number.format(Number(value)))

function toDate(value) {
  if (!value) return null
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value) {
  const date = toDate(value)
  return date ? dateFormat.format(date) : '—'
}

export function formatDateTime(value) {
  const date = toDate(value)
  return date ? dateTimeFormat.format(date) : '—'
}

export function timeAgo(value) {
  const date = toDate(value)
  if (!date) return '—'
  const seconds = (Date.now() - date.getTime()) / 1000
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`
  if (seconds < 86400 * 7) return `${Math.round(seconds / 86400)} d ago`
  return formatDate(date)
}

export function timeUntil(value) {
  const date = toDate(value)
  if (!date) return ''
  const minutes = Math.round((date.getTime() - Date.now()) / 60000)
  if (minutes <= 0) return 'expired'
  return minutes === 1 ? 'in 1 min' : `in ${minutes} min`
}

/** "READY_FOR_PICKUP" -> "Ready for pickup" */
export function prettyEnum(value) {
  if (!value) return ''
  const text = String(value).replace(/[_.]/g, ' ').toLowerCase().trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const ACTION_LABELS = {
  'order.place': 'Order placed',
  'order.view': 'Order viewed',
  'ticket.create': 'Ticket created',
  'ticket.update': 'Ticket updated',
  'auth.login': 'Sign-in',
  'access.denied': 'Access denied',
  'inventory.sync': 'Stock feed synced',
  'inventory.demand_spike': 'Demand spike simulated',
  'inventory.restock': 'Restock simulated',
  'inventory.adjust': 'Stock adjusted',
  'inventory.import': 'Stock imported (CSV)',
  'catalog.import': 'Products imported (CSV)',
  'export.catalog': 'Catalog exported (CSV)',
  'export.inventory': 'Inventory exported (CSV)',
  'tool.propose_stock_adjustment': 'Stock change proposed (AI)',
  'action.confirm': 'AI action confirmed',
  'action.cancel': 'AI action cancelled',
}

export function prettyAction(action) {
  if (!action) return ''
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  return prettyEnum(action)
}

const SPEC_LABELS = {
  cpu: 'Processor',
  cpu_cores: 'CPU cores',
  ram_gb: 'RAM (GB)',
  gpu: 'Graphics',
  os: 'Operating system',
  storage_type: 'Storage type',
  smart_os: 'Smart TV platform',
  hdr: 'HDR',
  anc: 'Active noise cancellation',
  gps: 'GPS',
  rpm: 'Spin speed (RPM)',
  energy_star: 'Energy rating (stars)',
  network: 'Network',
  chipset: 'Chipset',
  type: 'Type',
}

const UNIT_SUFFIXES = {
  gb: 'GB',
  mp: 'MP',
  mah: 'mAh',
  hrs: 'hours',
  in: 'inches',
  kg: 'kg',
  l: 'L',
  w: 'W',
  hz: 'Hz',
  bar: 'bar',
  days: 'days',
  years: 'years',
  cups: 'cups',
}

/** "battery_mah" -> "Battery (mAh)" */
export function prettySpecKey(key) {
  if (SPEC_LABELS[key]) return SPEC_LABELS[key]
  const parts = key.split('_')
  let unit = null
  if (parts.length > 1 && UNIT_SUFFIXES[parts[parts.length - 1]]) {
    unit = UNIT_SUFFIXES[parts.pop()]
  }
  const label = parts.join(' ')
  const capitalised = label.charAt(0).toUpperCase() + label.slice(1)
  return unit ? `${capitalised} (${unit})` : capitalised
}

export function formatSpecValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return number.format(value)
  return String(value)
}

/** Generic label for applied-filter chips coming back from the AI endpoints. */
export function formatFilterValue(key, value) {
  if (Array.isArray(value)) return value.map((v) => formatFilterValue(key, v)).join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && /price|budget|amount/i.test(key)) return formatINR(value)
  if (typeof value === 'number') return formatNumber(value)
  return String(value)
}

/** "maxPrice" / "max_price" -> "Max price" */
export function prettyKey(key) {
  const spaced = String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
