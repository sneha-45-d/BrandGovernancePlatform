import { ArrowRight, Check, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

const plans = [
  {
    name: 'Starter',
    price: '$29',
    description: 'For lean brand teams building their governance baseline.',
    featured: false,
    features: ['Up to 5 active brand profiles', 'AI content review for 2k monthly assets', 'Basic compliance dashboard', 'Email support'],
  },
  {
    name: 'Professional',
    price: '$99',
    description: 'For scaling marketing orgs that manage multi-channel brand reviews.',
    featured: true,
    features: ['Unlimited brand profiles', 'Advanced AI checks and scoring', 'Custom review workflows', 'Priority email and chat support'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For global teams needing security, governance, and custom integrations.',
    featured: false,
    features: ['SSO and advanced role controls', 'Custom integrations and data retention', 'Dedicated onboarding and SLA', 'Executive reporting'],
  },
]

const compareRows = [
  ['Brand profiles', '5', 'Unlimited', 'Unlimited'],
  ['AI content review', '2k/mo', 'Unlimited', 'Unlimited'],
  ['Custom review workflows', '—', 'Included', 'Included'],
  ['SSO / security controls', '—', 'Basic', 'Advanced'],
  ['Priority support', 'Email', 'Priority', 'Dedicated'],
]

export default function PricingPage() {
  return (
    <div className="dashboard-shell min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-950 text-sm font-bold text-white shadow-lg shadow-slate-200">
              B
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">Brandithm</p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <Link to="/" className="transition hover:text-slate-900">Platform</Link>
            <Link to="/" className="transition hover:text-slate-900">Solutions</Link>
            <Link to="/" className="transition hover:text-slate-900">Insights</Link>
            <Link to="/pricing" className="transition hover:text-slate-900">Pricing</Link>
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
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:translate-y-[-1px] hover:shadow-xl hover:shadow-emerald-200/80"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <section className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </div>
          <h1 className="text-4xl font-black tracking-[-0.06em] text-slate-950 sm:text-5xl">
            Flexible plans for every stage of brand governance.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Scale from a focused brand team to a global organization with AI-powered content review, governance workflows, and enterprise-grade reporting.
          </p>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[2rem] border p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] ${
                plan.featured
                  ? 'border-emerald-200 bg-emerald-950 text-white shadow-[0_22px_60px_rgba(16,120,78,0.18)]'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${plan.featured ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h2>
                {plan.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                    <Star className="h-3.5 w-3.5" />
                    Popular
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl font-black tracking-[-0.06em]">{plan.price}</span>
                {plan.price !== 'Custom' && <span className={`mb-1 text-sm ${plan.featured ? 'text-slate-300' : 'text-slate-500'}`}>/ month</span>}
              </div>

              <p className={`mt-4 text-sm ${plan.featured ? 'text-slate-300' : 'text-slate-600'}`}>{plan.description}</p>

              <button
                type="button"
                className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${
                  plan.featured
                    ? 'bg-white text-slate-950 shadow-lg'
                    : 'bg-emerald-950 text-white hover:bg-green-900'
                }`}
              >
                {plan.name === 'Enterprise' ? 'Talk to sales' : 'Start free trial'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${plan.featured ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-600'}`}>
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span className={plan.featured ? 'text-slate-200' : 'text-slate-700'}>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Feature comparison</p>
              <h2 className="text-2xl font-bold text-slate-900">Everything included across plans</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3 text-left">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Features</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Starter</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Professional</th>
                  <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map(([feature, starter, pro, enterprise]) => (
                  <tr key={feature} className="rounded-2xl bg-slate-50">
                    <td className="rounded-l-2xl px-4 py-4 font-medium text-slate-800">{feature}</td>
                    <td className="px-4 py-4 text-slate-600">{starter}</td>
                    <td className="px-4 py-4 text-slate-600">{pro}</td>
                    <td className="rounded-r-2xl px-4 py-4 text-slate-600">{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
