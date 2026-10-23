import { ChevronDown, ScrollText, ShieldCheck } from 'lucide-react'
import { Fragment, useState } from 'react'
import { opsApi } from '../../api'
import { OutcomeBadge, roleLabel, SourceBadge } from '../../components/Badge'
import { Input, Select } from '../../components/Form'
import { Card, PageHeader, table } from '../../components/Misc'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, Spinner } from '../../components/States'
import { formatDateTime, prettyAction, timeAgo } from '../../lib/format'
import { useApi, useDebouncedValue } from '../../lib/useApi'

const PAGE_SIZE = 25
const ACTION_PRESETS = [
  ['', 'All actions'],
  ['tool.', 'AI tool calls'],
  ['ai.', 'AI answers'],
  ['action.', 'AI action confirmations'],
  ['ticket.', 'Tickets'],
  ['order.', 'Orders'],
  ['inventory.', 'Inventory'],
  ['access.', 'Access denials'],
  ['auth.', 'Sign-ins'],
]

export function AuditPage() {
  const [outcome, setOutcome] = useState('')
  const [source, setSource] = useState('')
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const entityId = useDebouncedValue(entity.trim().toUpperCase(), 300)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)

  const { data, error, loading, reload } = useApi(
    () => opsApi.audit({ outcome, source, action, entityId, page, pageSize: PAGE_SIZE }),
    [outcome, source, action, entityId, page],
  )

  const reset = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only history of operational actions. Every AI tool call, confirmation, denial and failure is recorded here."
      />
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-hairline bg-white px-4 py-3 text-sm text-ink-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden="true" />
        The database rejects edits and deletes on this table, so entries can't be altered after the fact.
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
          <Select value={action} onChange={reset(setAction)} className="w-auto" aria-label="Action type">
            {ACTION_PRESETS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={outcome} onChange={reset(setOutcome)} className="w-auto" aria-label="Outcome">
            <option value="">All outcomes</option>
            {['SUCCESS', 'PROPOSED', 'DENIED', 'FAILED', 'CANCELLED', 'EXPIRED'].map((o) => (
              <option key={o} value={o}>
                {o.charAt(0) + o.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          <Select value={source} onChange={reset(setSource)} className="w-auto" aria-label="Source">
            <option value="">All sources</option>
            <option value="AI_ASSISTANT">AI assistant</option>
            <option value="UI">App</option>
            <option value="SYSTEM">System</option>
          </Select>
          <Input value={entity} onChange={reset(setEntity)} placeholder="Entity id, e.g. NM-100042" className="w-60 font-mono" aria-label="Entity id" />
        </div>

        {error ? (
          <ErrorState error={error} onRetry={reload} title="We couldn't load the audit log" />
        ) : !data ? (
          <Spinner label="Loading audit events…" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No events match these filters" />
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className={table.wrapper}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>When</th>
                    <th className={table.th}>Action</th>
                    <th className={table.th}>Outcome</th>
                    <th className={table.th}>Source</th>
                    <th className={table.th}>Actor</th>
                    <th className={table.th}>Entity</th>
                    <th className={table.th}>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((event) => {
                    const open = expanded === event.id
                    return (
                      <Fragment key={event.id}>
                        <tr className={`${table.row} ${event.outcome === 'DENIED' ? 'bg-red-50/40' : ''}`}>
                          <td className={`${table.td} whitespace-nowrap`}>
                            <p className="text-ink">{timeAgo(event.occurredAt)}</p>
                            <p className="text-[11px] text-ink-3">{formatDateTime(event.occurredAt)}</p>
                          </td>
                          <td className={table.td}>
                            <p className="font-medium text-ink">{prettyAction(event.action)}</p>
                            <p className="font-mono text-[11px] text-ink-3">{event.action}</p>
                          </td>
                          <td className={table.td}>
                            <OutcomeBadge outcome={event.outcome} />
                          </td>
                          <td className={table.td}>
                            <SourceBadge source={event.source} />
                          </td>
                          <td className={table.td}>
                            <p className="text-ink">{event.actorName || 'System'}</p>
                            {event.actorRole && <p className="text-[11px] text-ink-3">{roleLabel(event.actorRole)}</p>}
                          </td>
                          <td className={table.td}>
                            {event.entityId ? (
                              <>
                                <p className="font-mono text-xs text-ink">{event.entityId}</p>
                                <p className="text-[11px] text-ink-3">{event.entityType}</p>
                              </>
                            ) : (
                              <span className="text-ink-3">—</span>
                            )}
                          </td>
                          <td className={table.td}>
                            <button
                              type="button"
                              onClick={() => setExpanded(open ? null : event.id)}
                              aria-expanded={open}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-slate-100 hover:text-ink"
                            >
                              Details
                              <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-hairline/70 bg-slate-50/70">
                            <td colSpan={7} className="px-4 py-3">
                              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                              {event.requestId && <p className="mt-2 font-mono text-[11px] text-ink-3">Request {event.requestId}</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-hairline px-4 py-3">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
