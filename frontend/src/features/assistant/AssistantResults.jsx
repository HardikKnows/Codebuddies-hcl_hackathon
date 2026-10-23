import {
  Ban,
  BookCheck,
  Boxes,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  Info,
  ListChecks,
  SearchX,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { assistantApi } from '../../api'
import { AvailabilityBadge, ConfidenceBadge, OutcomeBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Overlay'
import { ProductImage } from '../../components/ProductImage'
import { Rating } from '../../components/Misc'
import { InlineError } from '../../components/States'
import {
  formatDate,
  formatFilterValue,
  formatINR,
  prettyEnum,
  prettyKey,
  timeUntil,
} from '../../lib/format'
import { useCart } from '../CartContext'

const slugify = (name) => String(name || '').toLowerCase().trim().replace(/\s+/g, '-')

export function RecommendationResult({ data, onNavigate }) {
  const { addItem } = useCart()
  const toast = useToast()
  const filters = Object.entries(data.appliedFilters || {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0),
  )

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-hairline bg-slate-50/80 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Interpreted as</p>
        <p className="mt-0.5 text-sm text-ink">{data.interpretedRequirement}</p>
        {(filters.length > 0 || data.storeName) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.map(([key, value]) => (
              <span key={key} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-2 ring-1 ring-hairline">
                {prettyKey(key)}: <span className="font-medium text-ink">{formatFilterValue(key, value)}</span>
              </span>
            ))}
            {data.storeName && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-2 ring-1 ring-hairline">
                Stock checked at <span className="font-medium text-ink">{data.storeName}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {data.recommendations?.map((item) => (
        <article key={item.productId} className="rounded-xl border border-hairline bg-white p-3 shadow-xs">
          <div className="flex gap-3">
            <ProductImage src={item.imageUrl} categorySlug={item.categorySlug || slugify(item.category)} size="sm" />
            <div className="min-w-0 flex-1">
              <Link
                to={`/products/${item.productId}`}
                onClick={onNavigate}
                className="line-clamp-2 text-sm font-semibold text-ink hover:text-brand-700"
              >
                {item.name}
              </Link>
              <p className="text-xs text-ink-3">
                {item.brand} · {item.category} · <span className="font-mono">{item.productId}</span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{formatINR(item.price)}</span>
                <AvailabilityBadge status={item.availability} quantity={item.availableQuantity} showQuantity />
                <Rating value={item.rating} />
              </div>
            </div>
          </div>
          <p className="mt-2 flex gap-1.5 rounded-lg bg-brand-50/70 px-2.5 py-2 text-xs text-ink-2">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink">Why it matches: </span>
              {item.reason}
            </span>
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="xs"
              icon={ShoppingCart}
              onClick={() => {
                addItem(item.productId, 1)
                toast(`${item.name} added to cart`)
              }}
            >
              Add to cart
            </Button>
            <Button as={Link} to={`/products/${item.productId}`} onClick={onNavigate} size="xs" variant="secondary" iconRight={ChevronRight}>
              Details
            </Button>
          </div>
        </article>
      ))}

      {data.clarifyingQuestion && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-ink">
          <CircleHelp className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>{data.clarifyingQuestion}</p>
        </div>
      )}

      {!data.recommendations?.length && !data.clarifyingQuestion && (
        <p className="rounded-xl border border-hairline bg-white p-3 text-sm text-ink-2">
          No products in the catalog match all of those requirements. Try widening the budget or category.
        </p>
      )}
    </div>
  )
}

/** Renders **bold** spans from model text; everything else stays plain text (React escapes it). */
export function RichText({ text }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold">{part}</strong> : part))
}

/** A grounded policy answer: the answer, its confidence, and numbered citations to the approved documents. */
export function PolicyAnswerCard({ data, answer }) {
  const verified = data.sources?.length > 0
  return (
    <div className={`overflow-hidden rounded-2xl rounded-tl-sm border bg-white shadow-xs ${verified ? 'border-brand-200' : 'border-amber-200'}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 ${verified ? 'border-brand-100 bg-brand-50/70' : 'border-amber-100 bg-amber-50/70'}`}>
        <p className={`flex items-center gap-1.5 text-xs font-semibold ${verified ? 'text-brand-800' : 'text-amber-800'}`}>
          {verified ? <BookCheck className="size-4" aria-hidden="true" /> : <SearchX className="size-4" aria-hidden="true" />}
          {verified ? 'Answer from NovaMart policies' : 'Not found in approved policies'}
        </p>
        <ConfidenceBadge confidence={data.confidence} />
      </div>

      {answer && (
        <p className="whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed text-ink">
          <RichText text={answer} />
        </p>
      )}

      {verified && (
        <div className="border-t border-hairline bg-slate-50/70 px-3 pb-2.5 pt-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Sources</p>
          <ol className="space-y-1.5">
            {data.sources.map((source, index) => (
              <li key={`${source.documentId}-${source.section}-${index}`} className="rounded-lg border border-hairline bg-white">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-2 rounded-lg px-2.5 py-2 marker:hidden">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-600 text-[11px] font-semibold text-white" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-ink">
                        {source.document} <span className="font-normal text-ink-3">›</span> {source.section}
                      </span>
                      <span className="block text-[11px] text-ink-3">
                        v{source.version} · Effective {formatDate(source.effectiveDate)} · {prettyEnum(source.docType)}
                      </span>
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  {source.excerpt && (
                    <blockquote className="mx-2.5 mb-2.5 border-l-2 border-brand-300 pl-2.5 text-xs leading-relaxed text-ink-2">{source.excerpt}</blockquote>
                  )}
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.followUpRequired && (
        <div className="flex gap-2 border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-ink-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            A specialist should confirm this one. Ask me to <span className="font-semibold text-ink">raise a support ticket</span> and I'll prepare it for
            your approval.
          </span>
        </div>
      )}
    </div>
  )
}

const ARGUMENT_ORDER = ['orderNumber', 'order_number', 'product_id', 'delta', 'category', 'priority', 'subject', 'description', 'reason']
const argumentRank = (key) => {
  const index = ARGUMENT_ORDER.indexOf(key)
  return index === -1 ? ARGUMENT_ORDER.length : index
}
const HIDDEN_ARGUMENTS = new Set(['store_id']) // the store is named in the summary
const formatArgument = (key, value) =>
  key === 'delta' && value > 0 ? `+${value}` : typeof value === 'string' && /^[A-Z_]+$/.test(value) ? prettyEnum(value) : String(value)

export const INVENTORY_CHANGED_EVENT = 'rp:inventory-changed'

const ACTION_COPY = {
  create_support_ticket: {
    icon: Ticket,
    confirm: 'Confirm and create ticket',
    note: 'Nothing is created until you confirm. Both choices are recorded in the audit log.',
    done: 'Ticket created',
    cancelled: 'No ticket was created.',
  },
  adjust_inventory: {
    icon: Boxes,
    confirm: 'Confirm stock update',
    note: 'Stock does not change until you confirm. Both choices are recorded in the audit log.',
    done: 'Stock updated',
    cancelled: 'No stock was changed.',
  },
}

// The header states where the action stands, so a pending approval never looks like a finished one.
const STATUS_HEADER = {
  PENDING: { icon: ShieldCheck, label: 'Action needs your approval', bar: 'bg-brand-600 text-white', frame: 'border-brand-300 shadow-md shadow-brand-900/5' },
  EXECUTED: { icon: CircleCheck, bar: 'border-b border-green-200 bg-green-50 text-green-800', frame: 'border-green-200' },
  CANCELLED: { icon: Ban, label: 'Cancelled', bar: 'border-b border-hairline bg-slate-50 text-ink-2', frame: 'border-hairline' },
  EXPIRED: { icon: Clock, label: 'Expired', bar: 'border-b border-hairline bg-slate-50 text-ink-2', frame: 'border-hairline' },
  FAILED: { icon: CircleAlert, label: 'Not completed', bar: 'border-b border-red-200 bg-red-50 text-red-800', frame: 'border-red-200' },
}

export function ActionProposalCard({ proposal }) {
  const toast = useToast()
  const [state, setState] = useState({ status: proposal.status, result: null, message: null, error: null, busy: null })
  const copy = ACTION_COPY[proposal.tool] || ACTION_COPY.create_support_ticket

  const decide = async (kind) => {
    setState((s) => ({ ...s, busy: kind, error: null }))
    try {
      const outcome = kind === 'confirm' ? await assistantApi.confirmAction(proposal.id) : await assistantApi.cancelAction(proposal.id)
      setState({ status: outcome.status, result: outcome.result, message: outcome.message, error: null, busy: null })
      if (kind === 'confirm' && outcome.result?.ticketNumber) toast(`Ticket ${outcome.result.ticketNumber} created`)
      if (kind === 'confirm' && outcome.result?.newQuantity !== undefined) {
        toast(`Stock updated: ${outcome.result.productId} → ${outcome.result.newQuantity} units`)
        window.dispatchEvent(new CustomEvent(INVENTORY_CHANGED_EVENT, { detail: outcome.result })) // refreshes open inventory views
      }
    } catch (error) {
      const status = error.status === 410 ? 'EXPIRED' : state.status
      setState((s) => ({ ...s, status, error, busy: null }))
    }
  }

  const args = Object.entries(proposal.arguments || {})
    .filter(([key, value]) => value !== null && value !== '' && !HIDDEN_ARGUMENTS.has(key))
    .sort(([a], [b]) => argumentRank(a) - argumentRank(b))
  const isPending = state.status === 'PENDING'
  const header = STATUS_HEADER[state.status] || STATUS_HEADER.FAILED
  const HeaderIcon = header.icon

  return (
    <div className={`overflow-hidden rounded-xl border bg-white ${header.frame}`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${header.bar}`}>
        <HeaderIcon className="size-4" aria-hidden="true" />
        <p className="text-xs font-semibold">{header.label || copy.done}</p>
        {isPending && <span className="ml-auto text-[11px] text-brand-100">Expires {timeUntil(proposal.expiresAt)}</span>}
      </div>
      <div className="space-y-2 p-3">
        <p className="text-sm font-medium text-ink">{proposal.summary}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {args.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-ink-3">{prettyKey(key)}</dt>
              <dd className="text-ink-2">{formatArgument(key, value)}</dd>
            </div>
          ))}
        </dl>

        {isPending && (
          <>
            <p className="text-[11px] text-ink-3">{copy.note}</p>
            <div className="flex gap-2">
              <Button size="sm" icon={copy.icon} loading={state.busy === 'confirm'} disabled={Boolean(state.busy)} onClick={() => decide('confirm')}>
                {copy.confirm}
              </Button>
              <Button size="sm" variant="secondary" loading={state.busy === 'cancel'} disabled={Boolean(state.busy)} onClick={() => decide('cancel')}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {state.status === 'EXECUTED' && (
          <p className="text-xs text-ink-2">
            {state.result?.ticketNumber ? (
              <>
                Ticket <span className="font-mono font-semibold text-ink">{state.result.ticketNumber}</span> is in the support queue.
              </>
            ) : state.result?.newQuantity !== undefined ? (
              <>
                {state.result.productName} at {state.result.storeName.replace('NovaMart ', '')}: {state.result.previousQuantity} →{' '}
                <span className="font-semibold text-ink">{state.result.newQuantity}</span> units.
              </>
            ) : (
              state.message || 'The action was completed.'
            )}
          </p>
        )}
        {state.status === 'CANCELLED' && <p className="text-xs text-ink-2">{copy.cancelled}</p>}
        {state.status === 'EXPIRED' && <p className="text-xs text-ink-2">This proposal expired. Ask again to get a fresh one.</p>}
        {state.status === 'FAILED' && <p className="text-xs text-ink-2">{state.message || 'The action could not be completed.'}</p>}
        <InlineError error={state.error} />
      </div>
    </div>
  )
}

export function ToolTrace({ steps }) {
  if (!steps?.length) return null
  return (
    <details className="group rounded-lg border border-hairline bg-white/70 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-ink-3 marker:hidden hover:text-ink-2">
        <ListChecks className="size-3.5" aria-hidden="true" />
        What the assistant did ({steps.length} step{steps.length > 1 ? 's' : ''})
        <ChevronRight className="ml-auto size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <ol className="space-y-1.5 border-t border-hairline px-2.5 py-2">
        {steps.map((step, index) => (
          <li key={index} className="flex flex-wrap items-center gap-1.5">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-ink">{step.tool}</code>
            <OutcomeBadge outcome={step.outcome} />
            <span className="text-ink-2">{step.summary}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}
