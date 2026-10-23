import { BookOpen, FileText } from 'lucide-react'
import { opsApi } from '../../api'
import { Badge } from '../../components/Badge'
import { Card, PageHeader, table } from '../../components/Misc'
import { AiNotConfiguredNotice, EmptyState, ErrorState, Spinner } from '../../components/States'
import { formatDate, formatNumber, prettyEnum } from '../../lib/format'
import { useApi } from '../../lib/useApi'

const INGEST_COMMAND = 'cd backend && .venv/bin/python -m scripts.ingest_knowledge'

function Scope({ doc }) {
  const scopes = [
    doc.countryCode && `Country ${doc.countryCode}`,
    doc.category && doc.category,
    doc.productId && `Product ${doc.productId}`,
    doc.membershipTiers?.length && `Tiers ${doc.membershipTiers.map((t) => prettyEnum(t)).join(', ')}`,
  ].filter(Boolean)
  if (!scopes.length) return <span className="text-xs text-ink-3">All customers</span>
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.map((scope) => (
        <span key={scope} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-ink-2">
          {scope}
        </span>
      ))}
    </div>
  )
}

function NotIngested() {
  return (
    <EmptyState
      icon={BookOpen}
      title="No policy documents ingested yet"
      description="Once OpenAI embeddings are configured, ingest the sample policies (Markdown, text, CSV, JSON and PDF) with:"
      action={<code className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">{INGEST_COMMAND}</code>}
    />
  )
}

export function KnowledgePage() {
  const { data, error, reload } = useApi(() => opsApi.documents(), [])
  const documents = Array.isArray(data) ? data : data?.items || []

  let body
  if (error?.code === 'AI_NOT_CONFIGURED') {
    body = (
      <div className="p-5">
        <AiNotConfiguredNotice error={error} />
      </div>
    )
  } else if (error?.status === 404) {
    body = <NotIngested />
  } else if (error) {
    body = <ErrorState error={error} onRetry={reload} title="We couldn't load the knowledge base" />
  } else if (!data) {
    body = <Spinner label="Loading documents…" />
  } else if (documents.length === 0) {
    body = <NotIngested />
  } else {
    body = (
      <div className={table.wrapper}>
        <table className={table.table}>
          <thead className={table.head}>
            <tr>
              <th className={table.th}>Document</th>
              <th className={table.th}>Type</th>
              <th className={table.th}>Version</th>
              <th className={table.th}>Effective</th>
              <th className={table.th}>Applies to</th>
              <th className={`${table.th} text-right`}>Chunks</th>
              <th className={table.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className={table.row}>
                <td className={table.td}>
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <FileText className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {doc.title}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    <span className="font-mono">{doc.sourceFilename}</span> · {doc.sourceFormat}
                  </p>
                </td>
                <td className={table.td}>{prettyEnum(doc.docType)}</td>
                <td className={`${table.td} font-mono text-xs`}>v{doc.version}</td>
                <td className={`${table.td} whitespace-nowrap text-xs`}>
                  {formatDate(doc.effectiveDate)}
                  {doc.expiryDate && <span className="block text-ink-3">until {formatDate(doc.expiryDate)}</span>}
                </td>
                <td className={table.td}>
                  <Scope doc={doc} />
                </td>
                <td className={table.num}>{formatNumber(doc.chunkCount)}</td>
                <td className={table.td}>
                  {doc.inEffect ? <Badge tone="good">In effect</Badge> : <Badge tone="neutral">{doc.status === 'ARCHIVED' ? 'Archived' : 'Not in effect'}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const inEffect = documents.filter((d) => d.inEffect).length
  const chunks = documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0)
  const model = documents.find((d) => d.embeddingModel)?.embeddingModel

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Approved policy documents the assistant retrieves from. Answers cite the document, section and version shown here."
      />
      {documents.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ['Documents', formatNumber(documents.length)],
            ['In effect today', formatNumber(inEffect)],
            ['Indexed chunks', formatNumber(chunks)],
            ['Embedding model', model || '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-hairline bg-white p-4 shadow-xs">
              <p className="text-sm text-ink-2">{label}</p>
              <p className="mt-1 truncate text-xl font-semibold text-ink" title={value}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
      <Card>{body}</Card>
    </>
  )
}
