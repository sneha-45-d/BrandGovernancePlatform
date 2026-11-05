import { ArrowRight, BarChart3, Bot, CheckCircle2, Gauge, ShieldCheck, Sparkles, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  {
    icon: Gauge,
    title: 'Brand Consistency Scoring',
    description: 'Monitor brand quality across campaigns, channels, and creative assets in real time.',
  },
  {
    icon: Bot,
    title: 'AI Content Review',
    description: 'Detect tone drift, visual inconsistencies, and compliance issues across all content.',
  },
  {
    icon: ShieldCheck,
    title: 'Governance Controls',
    description: 'Enforce approvals, naming rules, and legal safeguards before content goes live.',
  },
  {
    icon: Wand2,
    title: 'Creative Intelligence',
    description: 'Review asset messaging and ensure alignment with your approved brand system.',
  },
]

const workflowSteps = [
  'Upload brand guidelines and approved messaging libraries.',
  'Review content against tone, legal, and consistency rules.',
  'Track issues, fix suggestions, and generate explainable reports.',
]

const metrics = [
  { label: 'Campaigns tracked', value: '12.4k' },
  { label: 'Avg. consistency score', value: '94%' },
  { label: 'Review cycle time', value: '3.2x faster' },
  { label: 'AI risk alerts', value: '184' },
]

export default function LandingPage() {
  return (
    <div className="landing-shell min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-lg shadow-slate-200">
              B
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">Brandithm</p>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#platform" className="transition hover:text-slate-900">Platform</a>
            <a href="#solutions" className="transition hover:text-slate-900">Solutions</a>
            <a href="#insights" className="transition hover:text-slate-900">Insights</a>
            <a href="#pricing" className="transition hover:text-slate-900">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/signin"
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:translate-y-[-1px] hover:shadow-xl hover:shadow-indigo-200/80"
            >
              Book demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-28 lg:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.18fr_0.82fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                AI-powered brand governance
              </div>

              <h1 className="max-w-xl text-5xl font-black tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-[5.2rem] lg:leading-[0.96]">
                Every Brand.
                <span className="block">One Intelligent</span>
                <span className="block">Identity.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                BRANDITHM helps enterprise marketing teams review, govern, and optimize brand messaging with AI-powered intelligence, content scoring, and enterprise-ready approval workflows.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_24px_35px_rgba(99,102,241,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_28px_40px_rgba(99,102,241,0.35)]"
                >
                  Launch dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  Watch overview
                </button>
              </div>

              <div className="mt-10 flex flex-wrap gap-4 text-sm text-slate-700">
                {['AI review', 'Brand health', 'Compliance', 'Creative insights'].map((item) => (
                  <div
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-10 top-8 h-36 w-36 rounded-full bg-indigo-300/60 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-cyan-300/60 blur-3xl" />

              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur-sm">
                <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-inner">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Brand score</p>
                      <h2 className="mt-2 text-4xl font-bold">94.2%</h2>
                    </div>
                    <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      +8.4% this month
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      ['Messaging consistency', '96%'],
                      ['Visual alignment', '92%'],
                      ['Governance compliance', '98%'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                          <span>{label}</span>
                          <span>{value}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400"
                            style={{ width: value }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-indigo-50 p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-500">Content reviewed</p>
                    <p className="mt-3 text-2xl font-bold text-slate-900">18.7k</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-600">Alerts resolved</p>
                    <p className="mt-3 text-2xl font-bold text-slate-900">96%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-600">Platform overview</p>
            <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Designed for modern brand teams</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(79,70,229,0.12)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="solutions" className="bg-slate-950 py-20 text-white lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">Workflow</p>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Built to govern the full brand lifecycle.</h2>
              <p className="mt-5 max-w-lg text-base leading-8 text-slate-300">
                From uploaded brand assets to final approvals, BRANDITHM gives marketing teams a single control layer for consistency, guidance, and review.
              </p>
              <div className="mt-8 space-y-4">
                {workflowSteps.map((step, index) => (
                  <div key={step} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-semibold text-violet-200">
                      {index + 1}
                    </div>
                    <p className="text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-200">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-white">Compliance pulse</p>
                </div>
                <div className="space-y-5">
                  {[88, 91, 94, 96].map((value, index) => (
                    <div key={value + index}>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                        <span>Channel {index + 1}</span>
                        <span>{value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-500/10 p-6 shadow-[0_20px_50px_rgba(99,102,241,0.16)]">
                <p className="text-sm uppercase tracking-[0.25em] text-cyan-200">AI findings</p>
                <h3 className="mt-5 text-4xl font-bold text-white">84</h3>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  Recommended fixes identified across tone, claims, and visual alignment checks.
                </p>
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
                  “Suggested claim update: replace promotional language with approved product claims.”
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="insights" className="bg-slate-50 py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-600">Insights</p>
              <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Operational visibility at a glance</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
                  <p className="text-sm text-slate-500">{metric.label}</p>
                  <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer id="pricing" className="bg-slate-950 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950">B</div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Brandithm</p>
                </div>
              </div>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
                Every Brand. One Intelligent Identity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <a href="#platform" className="text-sm text-slate-300 transition hover:text-white">Platform</a>
              <a href="#solutions" className="text-sm text-slate-300 transition hover:text-white">Solutions</a>
              <a href="#insights" className="text-sm text-slate-300 transition hover:text-white">Insights</a>
            </div>

            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
