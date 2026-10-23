import {
  Ban,
  Bot,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Globe,
  Server,
  TriangleAlert,
  UserRound,
} from 'lucide-react'

// Green / amber / red tints make status scannable; the icon and label still carry the meaning without color.
const TONES = {
  good: { icon: CircleCheck, color: 'text-good', pill: 'border-green-200 bg-green-50 text-green-800' },
  warning: { icon: TriangleAlert, color: 'text-warning', pill: 'border-amber-200 bg-amber-50 text-amber-800' },
  serious: { icon: CircleAlert, color: 'text-serious', pill: 'border-orange-200 bg-orange-50 text-orange-800' },
  critical: { icon: CircleX, color: 'text-critical', pill: 'border-red-200 bg-red-50 text-red-800' },
  brand: { icon: CircleDot, color: 'text-brand-600', pill: 'border-brand-200 bg-brand-50 text-brand-800' },
  neutral: { icon: CircleDot, color: 'text-ink-3', pill: 'border-hairline bg-white text-ink-2' },
}

export function Badge({ tone = 'neutral', icon, children, title, className = '' }) {
  const config = TONES[tone] || TONES.neutral
  const Icon = icon === null ? null : icon || config.icon
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${config.pill} ${className}`}
    >
      {Icon && <Icon className={`size-3.5 shrink-0 ${config.color}`} aria-hidden="true" />}
      {children}
    </span>
  )
}

function lookup(map, value) {
  return map[value] || ['neutral', value ? String(value).replace(/_/g, ' ').toLowerCase() : 'unknown']
}

const AVAILABILITY = {
  IN_STOCK: ['good', 'In stock'],
  LOW_STOCK: ['warning', 'Low stock'],
  OUT_OF_STOCK: ['critical', 'Out of stock'],
}

export function AvailabilityBadge({ status, quantity, showQuantity = false }) {
  const [tone, label] = lookup(AVAILABILITY, status)
  const suffix = showQuantity && status !== 'OUT_OF_STOCK' && quantity != null ? ` · ${quantity}` : ''
  return <Badge tone={tone}>{label + suffix}</Badge>
}

const TICKET_STATUS = {
  OPEN: ['warning', 'Open'],
  IN_PROGRESS: ['brand', 'In progress'],
  ESCALATED: ['serious', 'Escalated'],
  RESOLVED: ['good', 'Resolved'],
  CLOSED: ['neutral', 'Closed'],
}

export function TicketStatusBadge({ status }) {
  const [tone, label] = lookup(TICKET_STATUS, status)
  return <Badge tone={tone}>{label}</Badge>
}

const PRIORITY = {
  LOW: ['neutral', 'Low'],
  MEDIUM: ['brand', 'Medium'],
  HIGH: ['serious', 'High'],
  URGENT: ['critical', 'Urgent'],
}

export function PriorityBadge({ priority }) {
  const [tone, label] = lookup(PRIORITY, priority)
  return <Badge tone={tone}>{label}</Badge>
}

const OUTCOME = {
  SUCCESS: ['good', 'Success'],
  DENIED: ['critical', 'Denied'],
  FAILED: ['serious', 'Failed'],
  PROPOSED: ['brand', 'Proposed'],
  CANCELLED: ['neutral', 'Cancelled', Ban],
  EXPIRED: ['neutral', 'Expired', Clock],
}

export function OutcomeBadge({ outcome }) {
  const [tone, label, icon] = lookup(OUTCOME, outcome)
  return <Badge tone={tone} icon={icon}>{label}</Badge>
}

const ORDER_STATUS = {
  PLACED: ['brand', 'Placed'],
  PACKED: ['brand', 'Packed'],
  READY_FOR_PICKUP: ['good', 'Ready for pickup'],
  SHIPPED: ['brand', 'Shipped'],
  OUT_FOR_DELIVERY: ['brand', 'Out for delivery'],
  DELIVERED: ['good', 'Delivered'],
  PICKED_UP: ['good', 'Picked up'],
  CANCELLED: ['neutral', 'Cancelled', Ban],
}

export function OrderStatusBadge({ status }) {
  const [tone, label, icon] = lookup(ORDER_STATUS, status)
  return <Badge tone={tone} icon={icon}>{label}</Badge>
}

const SOURCE = {
  WEB: ['neutral', 'Web', Globe],
  AI_ASSISTANT: ['brand', 'AI assistant', Bot],
  STAFF: ['neutral', 'Staff', UserRound],
  UI: ['neutral', 'App', Globe],
  SYSTEM: ['neutral', 'System', Server],
}

export function SourceBadge({ source }) {
  const [tone, label, icon] = lookup(SOURCE, source)
  return <Badge tone={tone} icon={icon}>{label}</Badge>
}

const CONFIDENCE = {
  HIGH: ['good', 'High confidence'],
  MEDIUM: ['warning', 'Medium confidence'],
  LOW: ['critical', 'Could not verify'],
}

export function ConfidenceBadge({ confidence }) {
  const [tone, label] = lookup(CONFIDENCE, confidence)
  return <Badge tone={tone}>{label}</Badge>
}

const ROLE_LABELS = {
  CUSTOMER: 'Customer',
  STORE_STAFF: 'Store staff',
  STORE_MANAGER: 'Store manager',
  ADMIN: 'Admin',
}

export const roleLabel = (role) => ROLE_LABELS[role] || role

export function TierBadge({ tier }) {
  if (!tier) return null
  const styles = {
    STANDARD: 'bg-slate-100 text-ink-2 ring-slate-200',
    SILVER: 'bg-slate-100 text-slate-700 ring-slate-300',
    GOLD: 'bg-amber-50 text-amber-800 ring-amber-300',
    PLATINUM: 'bg-violet-50 text-violet-800 ring-violet-300',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${styles[tier] || styles.STANDARD}`}>
      {tier.charAt(0) + tier.slice(1).toLowerCase()}
    </span>
  )
}
