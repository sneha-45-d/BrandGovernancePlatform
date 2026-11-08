import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  CircleCheck,
  FileSearch,
  Fingerprint,
  Gauge,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'

const capabilities = [
  {
    icon: Fingerprint,
    title: 'Make your voice unmistakable',
    description: 'Bring tone, terminology, and messaging guidance into one shared source of truth.',
    accent: 'violet',
  },
  {
    icon: FileSearch,
    title: 'Catch issues before they ship',
    description: 'Review content for brand consistency and get clear, actionable findings.',
    accent: 'blue',
  },
  {
    icon: WandSparkles,
    title: 'Move from feedback to better copy',
    description: 'Use guided corrections to make content clearer while keeping its intent.',
    accent: 'teal',
  },
]

const workflow = [
  { number: '01', title: 'Set your guidelines', icon: ShieldCheck },
  { number: '02', title: 'Review your content', icon: FileSearch },
  { number: '03', title: 'Approve with confidence', icon: CheckCheck },
]

function BrandLogo() {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="Brandithm home">
      <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-[14px] text-lg font-black text-white">B</span>
      <span className="text-xl font-black tracking-[-0.06em] text-slate-950">BRANDITHM</span>
    </Link>
  )
}

function ReviewPreview() {
  return (
    <div className="landing-preview relative mx-auto w-full max-w-[610px]">
      <div className="landing-preview-glow" />
      <div className="landing-preview-window relative overflow-hidden rounded-[24px] border border-white/15 bg-slate-950 p-4 text-white shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Content review</p>
              <p className="mt-0.5 text-xs text-slate-400">Brand alignment overview</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
            Review complete
          </span>
        </div>

        <div className="grid gap-4 py-5 sm:grid-cols-[1fr_150px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FileSearch className="h-3.5 w-3.5 text-violet-300" />
              Brand voice check
            </div>
            <div className="space-y-2.5" aria-hidden="true">
              <div className="h-2 w-full rounded-full bg-white/10" />
              <div className="h-2 w-[92%] rounded-full bg-white/10" />
              <div className="h-2 w-[78%] rounded-full bg-violet-300/50" />
              <div className="h-2 w-[86%] rounded-full bg-white/10" />
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] p-3">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-xs leading-5 text-slate-300">
                Review findings and suggested improvements in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-col sm:justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-[82px] w-[82px] items-center justify-center rounded-full border-[6px] border-emerald-400/70 bg-emerald-400/[0.08]">
                <Gauge className="h-8 w-8 text-emerald-300" />
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-400">Alignment score</p>
            </div>
            <div className="mt-0 flex items-center gap-2 text-xs font-semibold text-emerald-300 sm:mt-4">
              <Check className="h-3.5 w-3.5" />
              Ready to review
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-sky-300" />
            Your team makes the final call.
          </div>
          <span className="text-[11px] font-semibold text-violet-300">Brandithm AI</span>
        </div>
      </div>
      <div className="landing-floating-note absolute -bottom-5 -left-2 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl backdrop-blur sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <CheckCheck className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-xs font-bold text-slate-900">Review, resolved</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">A clear next step for every issue</span>
        </span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { user } = useAuth()
  const primaryHref = user ? '/dashboard' : '/signup'
  const primaryLabel = user ? 'Open your workspace' : 'Get started'

  return (
    <main className="landing-shell min-h-screen">
      <div className="landing-content relative z-10 mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between py-5 pr-24 sm:py-7 sm:pr-36">
          <BrandLogo />
          <nav className="flex items-center gap-3 sm:gap-7" aria-label="Main navigation">
            <a className="hidden text-sm font-semibold text-slate-600 transition hover:text-violet-600 sm:inline" href="#platform">
              Platform
            </a>
            <a className="hidden text-sm font-semibold text-slate-600 transition hover:text-violet-600 sm:inline" href="#workflow">
              How it works
            </a>
            <Link to="/pricing" className="hidden text-sm font-semibold text-slate-600 transition hover:text-violet-600 sm:inline">
              Pricing
            </Link>
            <Link to={user ? '/dashboard' : '/signin'} className="text-sm font-bold text-slate-700 transition hover:text-violet-600">
              {user ? 'Workspace' : 'Sign in'}
            </Link>
          </nav>
        </header>

        <section className="grid items-center gap-12 pb-20 pt-9 sm:pt-14 lg:grid-cols-[0.94fr_1.06fr] lg:gap-10 lg:pb-28 lg:pt-16">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/70 px-3.5 py-2 text-xs font-bold text-violet-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              A clearer standard for every brand
            </div>
            <h1 className="text-[3.4rem] font-black leading-[0.98] tracking-[-0.075em] text-slate-950 sm:text-6xl lg:text-[4.5rem]">
              Keep every word
              <span className="landing-gradient-text block">true to your brand.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Bring your guidelines, content reviews, and approvals together. Help every team create consistent work with less back-and-forth.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={primaryHref} className="landing-primary-button inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25">
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#platform" className="inline-flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white/60 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-violet-300 hover:bg-white">
                Explore the platform
                <ArrowDown className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" />Brand guidelines in one place</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" />Human-led review decisions</span>
            </div>
          </div>
          <ReviewPreview />
        </section>

        <section id="platform" className="scroll-mt-8 rounded-[30px] border border-white/70 bg-white/55 px-5 py-10 shadow-[0_24px_70px_rgba(54,58,112,0.08)] backdrop-blur sm:px-9 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">One connected workflow</span>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.055em] text-slate-950 sm:text-4xl">Brand consistency, built into the process.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              Turn brand standards into practical guidance teams can use while creating and reviewing content.
            </p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description, accent }) => (
              <article key={title} className="landing-capability-card rounded-2xl border border-slate-200/70 bg-white/80 p-5 sm:p-6">
                <span className={`landing-icon landing-icon-${accent} flex h-11 w-11 items-center justify-center rounded-[14px]`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold tracking-tight text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="grid scroll-mt-8 items-center gap-8 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">Simple by design</span>
            <h2 className="mt-3 max-w-md text-3xl font-black leading-tight tracking-[-0.055em] text-slate-950 sm:text-4xl">From brand rules to confident approvals.</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
              Keep your standards visible, your feedback actionable, and your final decisions with your team.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {workflow.map(({ number, title, icon: Icon }) => (
              <div key={number} className="landing-step-card rounded-2xl border border-white/80 bg-white/65 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-widest text-violet-500">{number}</span>
                  <Icon className="h-5 w-5 text-violet-500" />
                </div>
                <p className="mt-8 text-base font-extrabold leading-snug text-slate-900">{title}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-cta flex flex-col items-start justify-between gap-6 rounded-[26px] px-6 py-8 text-white sm:flex-row sm:items-center sm:px-9 sm:py-9">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Make brand confidence part of every review.</h2>
            <p className="mt-2 text-sm text-violet-100">Start building a more consistent content workflow.</p>
          </div>
          <Link to={primaryHref} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-violet-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50">
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 py-8 text-xs text-slate-500 sm:flex-row">
          <BrandLogo />
          <p>Brandithm · A thoughtful way to govern your brand voice.</p>
          <Link to="/signin" className="font-semibold text-slate-600 transition hover:text-violet-600">Sign in</Link>
        </footer>
      </div>
    </main>
  )
}
