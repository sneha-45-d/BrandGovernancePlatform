import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCheck,
  FileText,
  FolderSync,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import InfoCard from '../components/InfoCard'
import Sidebar from '../components/Sidebar'

const metrics = [
  {
    icon: Activity,
    title: 'Brand health',
    value: '94.2%',
    description: 'Positive momentum vs. last cycle',
  },
  {
    icon: FileText,
    title: 'Content reviews',
    value: '1,284',
    description: 'Across campaigns and assets',
  },
  {
    icon: CheckCheck,
    title: 'Approved assets',
    value: '87%',
    description: 'Average approval rate',
  },
  {
    icon: FolderSync,
    title: 'Flagged items',
    value: '42',
    description: 'Issues needing action',
  },
]

const chartData = [
  { name: 'Jan', score: 82 },
  { name: 'Feb', score: 86 },
  { name: 'Mar', score: 88 },
  { name: 'Apr', score: 91 },
  { name: 'May', score: 94 },
  { name: 'Jun', score: 96 },
]

const workflowItems = [
  { title: 'Homepage refresh review', status: 'Approved', accent: 'bg-emerald-500/15 text-emerald-600' },
  { title: 'Campaign naming audit', status: 'In review', accent: 'bg-amber-500/15 text-amber-600' },
  { title: 'Product launch deck', status: 'Pending', accent: 'bg-sky-500/15 text-sky-600' },
]

const recentContent = [
  { title: 'Website homepage copy', status: 'Approved', owner: 'Marketing Ops', time: '12 min ago' },
  { title: 'Product launch email', status: 'Needs update', owner: 'Lifecycle Team', time: '1 hr ago' },
  { title: 'Campaign landing page', status: 'Flagged', owner: 'Brand QA', time: '3 hrs ago' },
]

export default function DashboardPage() {
  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Brand intelligence</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Overview dashboard</h1>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              Search brand assets
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800"
            >
              <Bell className="h-4 w-4" />
              Alerts
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="flex-1 space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <InfoCard
                  key={metric.title}
                  icon={metric.icon}
                  title={metric.title}
                  value={metric.value}
                  description={metric.description}
                />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Consistency trend</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-950">Brand score over time</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                    <ArrowUpRight className="h-4 w-4" />
                    12.4% increase
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" domain={[70, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" radius={[10, 10, 0, 0]} fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Workflow status</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Live reviews</h2>
                  </div>
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {workflowItems.map(({ title, status, accent }) => (
                    <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-700">{title}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${accent}`}>{status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Recent activity</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-950">Latest content review</h3>
                  </div>
                  <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Export
                  </button>
                </div>

                <div className="space-y-3">
                  {recentContent.map(({ title, status, owner, time }) => (
                    <div key={title} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      <div>
                        <p className="font-medium text-slate-800">{title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {owner} • {time}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          status === 'Approved'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : status === 'Needs update'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-rose-500/15 text-rose-600'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <p className="text-sm text-slate-500">Quick actions</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Start a new analysis</h3>

                <div className="mt-6 space-y-3">
                  {[
                    'Upload brand guidelines',
                    'Create brand profile',
                    'Review compliance insights',
                  ].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      {item}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
