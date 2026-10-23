import {
  Boxes,
  FileText,
  LifeBuoy,
  LogIn,
  MapPin,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { STAFF_ROLES, useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/Button'
import { AiNotConfiguredNotice } from '../../components/States'
import { useStores } from '../StoreContext'
import { useAssistant } from './AssistantContext'
import { ActionProposalCard, PolicyAnswerCard, RecommendationResult, RichText, ToolTrace } from './AssistantResults'

const SUGGESTIONS = [
  'Laptop for Java development under ₹80,000',
  'Can I return an opened mobile phone purchased online?',
  'Do Gold members get free express delivery?',
  'My order NM-100042 arrived with a cracked screen',
]

const MANAGER_SUGGESTIONS = [
  'Increase the stock of product P101 by 20 units',
  'Remove 2 units of P301 from stock, damaged in storage',
  'What is the status of order NM-100042?',
  'Can a discounted product be returned to a physical store?',
]

const STAFF_SUGGESTIONS = [
  'What is the status of order NM-100042?',
  'Can a discounted product be returned to a physical store?',
  'How do I process an opened device return at the returns desk?',
]

const AGENTS = {
  shopping: { label: 'Shopping agent', icon: ShoppingBag },
  policy: { label: 'Policy agent', icon: FileText },
  support: { label: 'Support agent', icon: LifeBuoy },
  inventory: { label: 'Inventory agent', icon: Boxes },
  general: { label: 'Assistant', icon: Sparkles },
}

/**
 * A slim tab docked to the right edge. It stays inside the page gutter (narrower than the page padding plus card padding),
 * so it never covers product cards' prices or buttons, whatever the scroll position or screen size.
 */
export function AssistantLauncher({ className = '' }) {
  const { open, setOpen } = useAssistant()
  if (open) return null
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Ask AI assistant"
      title="Ask RetailPulse AI"
      className={`fixed right-0 top-1/2 z-40 flex w-6 -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl bg-linear-to-b from-brand-500 to-brand-800 py-3 text-white shadow-lg shadow-brand-900/30 transition-colors hover:from-brand-600 hover:to-brand-900 ${className}`}
    >
      <Sparkles className="size-3.5" aria-hidden="true" />
      <span className="rotate-180 text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">Ask AI</span>
    </button>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-ink-3" role="status">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rp-typing-dot size-1.5 rounded-full bg-brand-500" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      Checking the catalog, policies and your orders…
    </div>
  )
}

function ErrorBubble({ message, onRetry, onClose }) {
  const { error } = message
  if (error.code === 'AI_NOT_CONFIGURED') return <AiNotConfiguredNotice compact />
  return (
    <div className="rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
      <p>{error.message}</p>
      <div className="mt-2 flex gap-2">
        {error.status === 401 ? (
          <Button as={Link} to="/login" size="xs" variant="secondary" icon={LogIn} onClick={onClose}>
            Sign in
          </Button>
        ) : (
          <Button size="xs" variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

function AssistantMessage({ message, onRetry, onNavigate }) {
  if (message.error) return <ErrorBubble message={message} onRetry={onRetry} onClose={onNavigate} />
  const { response } = message
  const agent = AGENTS[response?.agent] || AGENTS.general
  const AgentIcon = agent.icon
  const policy = response?.policyAnswer
  return (
    <div className="space-y-2">
      <p className="flex w-fit items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-100">
        <AgentIcon className="size-3.5 text-brand-600" aria-hidden="true" />
        {agent.label}
      </p>
      {/* A policy answer is shown inside its citation card, so it reads as one grounded unit. */}
      {message.content && !policy && (
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 text-sm leading-relaxed text-ink shadow-xs ring-1 ring-hairline">
          <RichText text={message.content} />
        </div>
      )}
      {response?.recommendations && <RecommendationResult data={response.recommendations} onNavigate={onNavigate} />}
      {policy && <PolicyAnswerCard data={policy} answer={message.content} />}
      {response?.action && <ActionProposalCard proposal={response.action} />}
      <ToolTrace steps={response?.toolTrace} />
    </div>
  )
}

function Welcome({ onPick, suggestions }) {
  const capabilities = [
    { icon: ShoppingBag, text: 'Recommends real products with live prices and stock' },
    { icon: FileText, text: 'Answers policy questions with cited sources' },
    { icon: ShieldCheck, text: 'Raises support tickets only after you confirm' },
  ]
  return (
    <div className="space-y-5 py-2">
      <div>
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-violet-600 text-white shadow">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-ink">Hi! How can I help today?</h3>
        <ul className="mt-3 space-y-2">
          {capabilities.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-sm text-ink-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Try asking</p>
        <div className="flex flex-col gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPick(suggestion)}
              className="rounded-xl border border-hairline bg-white px-3 py-2 text-left text-sm text-ink-2 shadow-xs transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AssistantPanel() {
  const { open, setOpen, messages, pending, draft, setDraft, send, retry, reset, productContext, setProductContext } = useAssistant()
  const { selectedStore } = useStores()
  const { user } = useAuth()
  // Stock changes are only offered to store managers; the server enforces this regardless.
  const suggestions =
    user?.role === 'STORE_MANAGER' ? MANAGER_SUGGESTIONS : STAFF_ROLES.includes(user?.role) ? STAFF_SUGGESTIONS : SUGGESTIONS
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  const close = () => setOpen(false)
  // On small screens, navigating from a result closes the panel so the page is visible.
  const onNavigate = () => window.innerWidth < 640 && close()

  const submit = (event) => {
    event.preventDefault()
    send(draft)
  }

  return (
    <aside
      role="dialog"
      aria-label="RetailPulse AI assistant"
      className="rp-slide-in fixed inset-0 z-50 flex flex-col bg-plane shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-107.5 sm:border-l sm:border-hairline"
    >
      <header className="flex items-center gap-3 border-b border-hairline bg-white px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-violet-600 text-white">
          <Sparkles className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">RetailPulse Assistant</h2>
          <p className="truncate text-xs text-ink-3">Grounded in NovaMart's live catalog and approved policies</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={reset} title="New conversation" aria-label="New conversation" className="rounded-lg p-1.5 text-ink-3 hover:bg-slate-100 hover:text-ink">
            <RotateCcw className="size-4" />
          </button>
        )}
        <button type="button" onClick={close} aria-label="Close assistant" className="rounded-lg p-1.5 text-ink-3 hover:bg-slate-100 hover:text-ink">
          <X className="size-5" />
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline bg-white/60 px-4 py-2 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
          <MapPin className="size-3" aria-hidden="true" />
          {selectedStore ? selectedStore.name.replace('NovaMart ', '') : 'No store selected'}
        </span>
        {productContext && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">
            Asking about {productContext.name}
            <button type="button" onClick={() => setProductContext(null)} aria-label="Clear product context" className="rounded-full hover:text-brand-950">
              <X className="size-3" />
            </button>
          </span>
        )}
        {!user && <span className="ml-auto text-ink-3">Sign in for order help</span>}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <Welcome onPick={(text) => send(text)} suggestions={suggestions} />}
        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-sm text-white shadow-sm">
                {message.content}
              </p>
            </div>
          ) : (
            <AssistantMessage key={message.id} message={message} onRetry={() => retry(message.id)} onNavigate={onNavigate} />
          ),
        )}
        {pending && <TypingIndicator />}
      </div>

      <form onSubmit={submit} className="border-t border-hairline bg-white px-3 pb-3 pt-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-hairline bg-white px-3 py-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e)
            }}
            rows={Math.min(4, Math.max(1, draft.split('\n').length))}
            maxLength={1000}
            placeholder="Ask about products, policies or an order…"
            aria-label="Message"
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label="Send"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-ink-3"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-ink-3">
          Prices, stock and order details are verified against NovaMart's database.
        </p>
      </form>
    </aside>
  )
}
