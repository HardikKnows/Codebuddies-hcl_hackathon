import { CircleCheck, Download, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import { dataApi } from '../api'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Modal } from '../components/Overlay'
import { InlineError } from '../components/States'
import { formatNumber, prettyKey } from '../lib/format'

const MAX_BYTES = 1_000_000

const KINDS = {
  products: {
    label: 'Products',
    title: 'Import products',
    intro: 'Add products to the catalog from a CSV file. Rows whose SKU already exists are skipped unless you choose to update them. No stock is created.',
    required: ['sku', 'name', 'brand', 'category', 'price'],
    optional: ['description', 'image_url', 'specifications'],
    template: [
      ['sku', 'name', 'brand', 'category', 'description', 'price', 'image_url', 'specifications'],
      ['T100', 'Nimbus Tab 11', 'Nimbus', 'Mobiles', '11-inch tablet with a 120 Hz display', '29999', 'https://example.com/nimbus-tab-11.jpg', 'ram_gb=8;storage_gb=128'],
    ],
  },
  inventory: {
    label: 'Stock levels',
    title: 'Import stock levels',
    intro: 'Set stock quantities per product and store. You can edit an inventory export and import it back. Store managers can only import their own store.',
    required: ['sku', 'store_code', 'quantity'],
    optional: ['reorder_level'],
    template: [
      ['sku', 'store_code', 'quantity', 'reorder_level'],
      ['P101', 'BLR-KOR', '25', '5'],
    ],
  },
}

const ACTIONS = {
  insert: { tone: 'good', label: 'Add' },
  update: { tone: 'brand', label: 'Update' },
  skip: { tone: 'neutral', label: 'Skip' },
  reject: { tone: 'critical', label: 'Error' },
}

function downloadTemplate(kind) {
  const quote = (cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)
  const csv = KINDS[kind].template.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `retailpulse-${kind}-template.csv` })
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const shown = (value) => (value === null || value === undefined || value === '' ? '—' : typeof value === 'number' ? formatNumber(value) : String(value))

function RowDetails({ row }) {
  return (
    <div className="space-y-0.5">
      {row.errors.map((message) => (
        <p key={message} className="text-red-700">
          {message}
        </p>
      ))}
      {Object.entries(row.changes || {}).map(([field, [from, to]]) =>
        typeof to === 'object' && to !== null ? (
          <p key={field} className="text-ink-2">
            {prettyKey(field)} will be replaced
          </p>
        ) : (
          <p key={field} className="text-ink-2">
            <span className="text-ink-3">{prettyKey(field)}:</span> {shown(from)} → <span className="font-medium text-ink">{shown(to)}</span>
          </p>
        ),
      )}
      {row.notes.map((note) => (
        <p key={note} className="text-ink-3">
          {note}
        </p>
      ))}
    </div>
  )
}

function Footer({ children }) {
  return <footer className="flex flex-wrap justify-end gap-2 border-t border-hairline bg-slate-50/60 px-5 py-3">{children}</footer>
}

export function CsvImportModal({ kinds, onClose, onImported }) {
  const [kind, setKind] = useState(kinds[0])
  const [file, setFile] = useState(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(null) // 'preview' | 'apply'
  const [error, setError] = useState(null)
  const config = KINDS[kind]

  const clearPreview = () => {
    setPreview(null)
    setConfirmed(false)
    setError(null)
  }

  const chooseFile = (event) => {
    const next = event.target.files?.[0] || null
    event.target.value = '' // allow choosing the same file again after editing it
    clearPreview()
    if (next && next.size > MAX_BYTES) {
      setFile(null)
      setError({ message: 'The file is larger than 1 MB. Split it into smaller files.' })
      return
    }
    setFile(next)
  }

  const run = async (step) => {
    setBusy(step)
    setError(null)
    try {
      if (step === 'preview') {
        setPreview(await dataApi.previewImport(kind, file, updateExisting))
        setConfirmed(false)
      } else {
        const outcome = await dataApi.applyImport(kind, file, updateExisting)
        setResult(outcome)
        onImported(outcome)
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  const actionable = preview ? preview.inserted + preview.updated : 0
  const needsConfirmation = Boolean(preview?.updated) // overwriting existing products or stock levels
  const plural = (count, word) => `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`

  return (
    <Modal open title={config.title} subtitle={file?.name} onClose={busy ? undefined : onClose} widthClass="max-w-3xl">
      {result ? (
        <>
          <div className="space-y-2 px-5 py-8 text-center">
            <CircleCheck className="mx-auto size-10 text-good" aria-hidden="true" />
            <p className="text-base font-semibold text-ink">Import complete</p>
            <p className="text-sm text-ink-2">
              {formatNumber(result.inserted)} added · {formatNumber(result.updated)} updated · {formatNumber(result.skipped)} skipped ·{' '}
              {formatNumber(result.rejected)} rejected
            </p>
            <p className="text-xs text-ink-3">The import is recorded in the audit log.</p>
          </div>
          <Footer>
            <Button onClick={onClose}>Done</Button>
          </Footer>
        </>
      ) : preview ? (
        <>
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm text-ink-2">
              {plural(preview.totalRows, 'row')} checked · {formatNumber(preview.totalRows - preview.rejected)} valid · {formatNumber(preview.rejected)} with errors.
              Nothing has been changed yet.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['insert', preview.inserted, kind === 'products' ? 'New products' : 'New stock rows'],
                ['update', preview.updated, 'Updates'],
                ['skip', preview.skipped, 'Skipped'],
                ['reject', preview.rejected, 'Errors'],
              ].map(([action, count, label]) => (
                <div key={action} className="rounded-xl border border-hairline px-3 py-2">
                  <p className="text-xs text-ink-3">{label}</p>
                  <p className="text-xl font-semibold tabular-nums text-ink">{formatNumber(count)}</p>
                </div>
              ))}
            </div>
            <div className="max-h-72 overflow-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    {kind === 'inventory' && <th className="px-3 py-2 font-medium">Store</th>}
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row} className="border-t border-hairline/70 align-top">
                      <td className="px-3 py-2 tabular-nums text-ink-3">{row.row}</td>
                      <td className="px-3 py-2 font-mono text-ink">{row.sku || '—'}</td>
                      {kind === 'inventory' && <td className="px-3 py-2 font-mono text-ink">{row.storeCode || '—'}</td>}
                      <td className="px-3 py-2 text-ink">{row.name || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge tone={ACTIONS[row.action].tone}>{ACTIONS[row.action].label}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <RowDetails row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rejected > 0 && <p className="text-xs text-ink-3">Rows with errors won't be imported. Fix them in the file and import it again.</p>}
            {needsConfirmation && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-sm ring-1 ring-amber-200">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-amber-600" />
                <span className="text-ink-2">
                  <TriangleAlert className="mr-1 inline size-4 -translate-y-px text-warning" aria-hidden="true" />
                  I understand this will change {plural(preview.updated, kind === 'products' ? 'existing product' : 'existing stock level')}. The change is
                  recorded in the audit log.
                </span>
              </label>
            )}
            <InlineError error={error} />
          </div>
          <Footer>
            <Button variant="secondary" onClick={clearPreview} disabled={Boolean(busy)}>
              Back
            </Button>
            <Button
              icon={Upload}
              loading={busy === 'apply'}
              disabled={actionable === 0 || (needsConfirmation && !confirmed)}
              onClick={() => run('apply')}
            >
              {actionable === 0 ? 'Nothing to import' : `Import ${plural(actionable, 'row')}`}
            </Button>
          </Footer>
        </>
      ) : (
        <>
          <div className="space-y-4 px-5 py-4">
            {kinds.length > 1 && (
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="What to import">
                {kinds.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={kind === option}
                    onClick={() => {
                      setKind(option)
                      clearPreview()
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      kind === option ? 'bg-white text-ink shadow-xs ring-1 ring-hairline' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {KINDS[option].label}
                  </button>
                ))}
              </div>
            )}
            <p className="text-sm text-ink-2">{config.intro}</p>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-ink-2 ring-1 ring-hairline">
              <p>
                <span className="font-medium text-ink">Required columns:</span> <code className="font-mono">{config.required.join(', ')}</code>
              </p>
              <p className="mt-0.5">
                <span className="font-medium text-ink">Optional:</span> <code className="font-mono">{config.optional.join(', ')}</code>
              </p>
              <button type="button" onClick={() => downloadTemplate(kind)} className="mt-1.5 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                <Download className="size-3.5" aria-hidden="true" /> Download a template
              </button>
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-hairline px-4 py-6 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              <FileSpreadsheet className="size-7 text-brand-600" aria-hidden="true" />
              <span className="text-sm font-medium text-ink">{file ? file.name : 'Choose a CSV file'}</span>
              <span className="text-xs text-ink-3">{file ? `${formatNumber(Math.max(1, Math.round(file.size / 1024)))} KB` : 'UTF-8 CSV, up to 1 MB and 500 rows'}</span>
              <input type="file" accept=".csv,text/csv" onChange={chooseFile} className="sr-only" />
            </label>
            {kind === 'products' && (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => {
                    setUpdateExisting(e.target.checked)
                    clearPreview()
                  }}
                  className="mt-0.5 size-4 accent-brand-600"
                />
                <span>
                  <span className="font-medium text-ink">Update existing products with matching SKUs</span>
                  <span className="block text-xs text-ink-3">Off by default. Blank image, description or specification cells keep the current values.</span>
                </span>
              </label>
            )}
            <InlineError error={error} />
          </div>
          <Footer>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={FileSpreadsheet} loading={busy === 'preview'} disabled={!file} onClick={() => run('preview')}>
              Preview import
            </Button>
          </Footer>
        </>
      )}
    </Modal>
  )
}
