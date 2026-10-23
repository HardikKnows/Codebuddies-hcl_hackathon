import { ArrowRight, FileText, Info, LogIn, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { STAFF_ROLES, useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { Input, Label } from '../components/Form'
import { Logo } from '../components/Logo'
import { InlineError } from '../components/States'

const DEMO_PASSWORD = 'demo123'

const DEMO_ACCOUNTS = [
  { email: 'aarav@novamart.demo', name: 'Aarav Sharma', role: 'Customer · Gold', detail: 'Bengaluru · has a delivered phone order' },
  { email: 'meera@novamart.demo', name: 'Meera Iyer', role: 'Customer · Standard', detail: 'Mumbai' },
  { email: 'omar@novamart.demo', name: 'Omar Haddad', role: 'Customer · Platinum', detail: 'UAE · country-specific policies' },
  { email: 'priya@novamart.demo', name: 'Priya Nair', role: 'Store manager', detail: 'Koramangala · inventory, tickets, audit' },
  { email: 'rohan@novamart.demo', name: 'Rohan Das', role: 'Store staff', detail: 'Andheri · tickets and order lookup' },
  { email: 'admin@novamart.demo', name: 'Kavya Menon', role: 'Admin', detail: 'All stores · audit and knowledge base' },
]

const HIGHLIGHTS = [
  { icon: Sparkles, title: 'AI shopping assistant', text: 'Recommends only real products, with prices and stock verified server-side.' },
  { icon: FileText, title: 'Policy answers with sources', text: 'Returns, warranty and delivery answers cite the exact document and version.' },
  { icon: ShieldCheck, title: 'Controlled AI actions', text: 'Support tickets are created only after you confirm, and every step is audited.' },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const signIn = async (emailValue, passwordValue) => {
    setBusy(emailValue)
    setError(null)
    try {
      const user = await login(emailValue, passwordValue)
      const from = location.state?.from
      const home = STAFF_ROLES.includes(user.role) ? '/ops' : '/'
      navigate(from && from !== '/login' ? from : home, { replace: true })
    } catch (err) {
      setError(err)
      setBusy(null)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-linear-to-br from-brand-800 via-brand-700 to-violet-700 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-violet-400/20" aria-hidden="true" />
        <div className="relative">
          <Logo inverted />
        </div>
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Autonomous customer experience and store operations.</h1>
          <p className="mt-4 text-brand-100">One platform for NovaMart shoppers and store teams, with AI that stays grounded in real data and asks before it acts.</p>
          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-brand-100">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-2">Use a demo account below, or enter the email and password.</p>

          {location.state?.message && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900 ring-1 ring-brand-200">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {location.state.message}
            </p>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              signIn(email.trim(), password)
            }}
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <InlineError error={error} />
            <Button type="submit" className="w-full" size="lg" icon={LogIn} loading={busy === email.trim()} disabled={Boolean(busy)}>
              Sign in
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">One-click demo accounts</p>
              <p className="text-xs text-ink-3">
                Password <code className="font-mono text-ink-2">{DEMO_PASSWORD}</code>
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => signIn(account.email, DEMO_PASSWORD)}
                    disabled={Boolean(busy)}
                    className="group flex w-full items-start gap-2 rounded-xl border border-hairline bg-white p-3 text-left shadow-xs transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{account.name}</span>
                      <span className="block text-xs font-medium text-brand-700">{account.role}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-3">{account.detail}</span>
                    </span>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
