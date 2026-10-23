import { ChevronDown, CircleCheck, CircleAlert, Play, Search, Ticket, UserCheck } from 'lucide-react'
import { Fragment, useState } from 'react'
import { ticketsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { PriorityBadge, SourceBadge, TicketStatusBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Input, Select } from '../../components/Form'
import { Card, PageHeader, table } from '../../components/Misc'
import { useToast } from '../../components/Overlay'
import { Pagination } from '../../components/Pagination'
import { EmptyState, ErrorState, Spinner } from '../../components/States'
import { prettyEnum, timeAgo } from '../../lib/format'
import { useApi, useDebouncedValue } from '../../lib/useApi'

const PAGE_SIZE = 15
const CLOSED = ['RESOLVED', 'CLOSED']

export function TicketsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [filters, setFilters] = useState({ status: '', priority: '', source: '' })
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search, 300)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [busy, setBusy] = useState(null)

  const { data, error, loading, reload } = useApi(
    () => ticketsApi.list({ ...filters, q, page, pageSize: PAGE_SIZE }),
    [filters.status, filters.priority, filters.source, q, page],
  )

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }

  const act = async (ticket, body, label) => {
    setBusy(`${ticket.ticketNumber}:${label}`)
    try {
      await ticketsApi.update(ticket.ticketNumber, body)
      toast(`${ticket.ticketNumber}: ${label.toLowerCase()}`)
      reload()
    } catch (err) {
      toast(err.message, 'critical')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Support tickets" description="The customer support queue. Tickets raised by the AI assistant were confirmed by the customer first." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
          <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="w-auto" aria-label="Status">
            <option value="">All statuses</option>
            {['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((s) => (
              <option key={s} value={s}>
                {prettyEnum(s)}
              </option>
            ))}
          </Select>
          <Select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)} className="w-auto" aria-label="Priority">
            <option value="">All priorities</option>
            {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <option key={p} value={p}>
                {prettyEnum(p)}
              </option>
            ))}
          </Select>
          <Select value={filters.source} onChange={(e) => setFilter('source', e.target.value)} className="w-auto" aria-label="Source">
            <option value="">All sources</option>
            <option value="AI_ASSISTANT">AI assistant</option>
            <option value="WEB">Web</option>
            <option value="STAFF">Staff</option>
          </Select>
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search tickets</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search subject or ticket number"
              className="pl-9"
            />
          </label>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={reload} title="We couldn't load tickets" />
        ) : !data ? (
          <Spinner label="Loading tickets…" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Ticket} title="No tickets match" description="Try clearing the filters." />
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className={table.wrapper}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Ticket</th>
                    <th className={table.th}>Customer</th>
                    <th className={table.th}>Priority</th>
                    <th className={table.th}>Status</th>
                    <th className={table.th}>Source</th>
                    <th className={table.th}>Assignee</th>
                    <th className={table.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((ticket) => {
                    const open = expanded === ticket.ticketNumber
                    const isBusy = (label) => busy === `${ticket.ticketNumber}:${label}`
                    const closed = CLOSED.includes(ticket.status)
                    return (
                      <Fragment key={ticket.ticketNumber}>
                        <tr className={`${table.row} ${ticket.source === 'AI_ASSISTANT' ? 'bg-brand-50/30' : ''}`}>
                          <td className={`${table.td} max-w-xs`}>
                            <button type="button" onClick={() => setExpanded(open ? null : ticket.ticketNumber)} className="group text-left" aria-expanded={open}>
                              <span className="flex items-center gap-1 font-medium text-ink group-hover:text-brand-700">
                                {ticket.subject}
                                <ChevronDown className={`size-3.5 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                              </span>
                              <span className="block text-[11px] text-ink-3">
                                <span className="font-mono">{ticket.ticketNumber}</span> · {prettyEnum(ticket.category)}
                                {ticket.orderNumber && (
                                  <>
                                    {' '}
                                    · <span className="font-mono">{ticket.orderNumber}</span>
                                  </>
                                )}{' '}
                                · {timeAgo(ticket.createdAt)}
                              </span>
                            </button>
                          </td>
                          <td className={table.td}>{ticket.customerName}</td>
                          <td className={table.td}>
                            <PriorityBadge priority={ticket.priority} />
                          </td>
                          <td className={table.td}>
                            <TicketStatusBadge status={ticket.status} />
                          </td>
                          <td className={table.td}>
                            <SourceBadge source={ticket.source} />
                          </td>
                          <td className={`${table.td} whitespace-nowrap`}>{ticket.assignedToName || <span className="text-ink-3">Unassigned</span>}</td>
                          <td className={table.td}>
                            <div className="flex flex-wrap gap-1">
                              {ticket.status === 'OPEN' && (
                                <Button size="xs" variant="secondary" icon={Play} loading={isBusy('Started')} disabled={Boolean(busy)} onClick={() => act(ticket, { status: 'IN_PROGRESS', assignToMe: true }, 'Started')}>
                                  Start
                                </Button>
                              )}
                              {!closed && ticket.status !== 'ESCALATED' && (
                                <Button size="xs" variant="secondary" icon={CircleAlert} loading={isBusy('Escalated')} disabled={Boolean(busy)} onClick={() => act(ticket, { status: 'ESCALATED' }, 'Escalated')}>
                                  Escalate
                                </Button>
                              )}
                              {!closed && (
                                <Button size="xs" variant="secondary" icon={CircleCheck} loading={isBusy('Resolved')} disabled={Boolean(busy)} onClick={() => act(ticket, { status: 'RESOLVED' }, 'Resolved')}>
                                  Resolve
                                </Button>
                              )}
                              {!closed && ticket.assignedToName !== user.fullName && (
                                <Button size="xs" variant="ghost" icon={UserCheck} loading={isBusy('Assigned to you')} disabled={Boolean(busy)} onClick={() => act(ticket, { assignToMe: true }, 'Assigned to you')}>
                                  Assign to me
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-hairline/70 bg-slate-50/60">
                            <td colSpan={7} className="px-4 py-3 text-sm text-ink-2">
                              <p className="whitespace-pre-wrap">{ticket.description}</p>
                              <p className="mt-2 text-xs text-ink-3">
                                Created by {ticket.createdByName} · last updated {timeAgo(ticket.updatedAt)}
                              </p>
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
