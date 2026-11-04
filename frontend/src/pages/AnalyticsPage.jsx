import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  Download,
  Filter,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import InfoCard from '../components/InfoCard'
import Sidebar from '../components/Sidebar'

const chartPalette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const analyticsData = {
  '7': {
    overview: {
      totalAnalyzed: 1384,
      approved: 1046,
      rejected: 182,
      requiringRevision: 156,
      consistencyScore: 94.2,
      violations: 284,
    },
    scoreSeries: [
      { label: 'Mon', score: 90 },
      { label: 'Tue', score: 92 },
      { label: 'Wed', score: 91 },
      { label: 'Thu', score: 94 },
      { label: 'Fri', score: 95 },
      { label: 'Sat', score: 96 },
      { label: 'Sun', score: 94.2 },
    ],
    approvalSeries: [
      { name: 'Approved', value: 260 },
      { name: 'Rejected', value: 48 },
      { name: 'Revision', value: 58 },
    ],
    violationData: [
      { name: 'Tone inconsistency', value: 44 },
      { name: 'Incorrect terminology', value: 38 },
      { name: 'Unsupported claims', value: 31 },
      { name: 'Visual inconsistencies', value: 23 },
      { name: 'Accessibility issues', value: 17 },
      { name: 'Outdated information', value: 14 },
    ],
    trendSeries: [
      { label: 'W1', weekly: 410, monthly: 520 },
      { label: 'W2', weekly: 450, monthly: 540 },
      { label: 'W3', weekly: 470, monthly: 560 },
      { label: 'W4', weekly: 520, monthly: 610 },
      { label: 'W5', weekly: 510, monthly: 590 },
      { label: 'W6', weekly: 560, monthly: 640 },
      { label: 'W7', weekly: 580, monthly: 660 },
    ],
    recentActivity: [
      { title: 'Spring 2026 campaign review', type: 'Approval', status: 'Approved', time: '2h ago' },
      { title: 'Product launch messaging refresh', type: 'AI Recommendation', status: 'Suggested', time: '5h ago' },
      { title: 'Retargeting ad variant check', type: 'Violation', status: 'Flagged', time: '8h ago' },
      { title: 'SEO landing page QA', type: 'Revision', status: 'Needs review', time: '1d ago' },
    ],
  },
  '30': {
    overview: {
      totalAnalyzed: 5248,
      approved: 3861,
      rejected: 642,
      requiringRevision: 745,
      consistencyScore: 93.9,
      violations: 1168,
    },
    scoreSeries: [
      { label: 'W1', score: 88 },
      { label: 'W2', score: 89 },
      { label: 'W3', score: 91 },
      { label: 'W4', score: 92 },
      { label: 'W5', score: 94 },
      { label: 'W6', score: 93.8 },
    ],
    approvalSeries: [
      { name: 'Approved', value: 930 },
      { name: 'Rejected', value: 210 },
      { name: 'Revision', value: 260 },
    ],
    violationData: [
      { name: 'Tone inconsistency', value: 184 },
      { name: 'Incorrect terminology', value: 162 },
      { name: 'Unsupported claims', value: 143 },
      { name: 'Visual inconsistencies', value: 124 },
      { name: 'Accessibility issues', value: 89 },
      { name: 'Outdated information', value: 76 },
    ],
    trendSeries: [
      { label: 'Week 1', weekly: 740, monthly: 820 },
      { label: 'Week 2', weekly: 760, monthly: 860 },
      { label: 'Week 3', weekly: 820, monthly: 910 },
      { label: 'Week 4', weekly: 860, monthly: 980 },
      { label: 'Week 5', weekly: 900, monthly: 1000 },
      { label: 'Week 6', weekly: 930, monthly: 1020 },
    ],
    recentActivity: [
      { title: 'Regional ABM landing page review', type: 'Approval', status: 'Approved', time: '3h ago' },
      { title: 'Executive summary rewrite', type: 'AI Recommendation', status: 'Suggested', time: '7h ago' },
      { title: 'Pricing page compliance check', type: 'Violation', status: 'Flagged', time: '9h ago' },
      { title: 'Brand voice alignment QA', type: 'Revision', status: 'Needs review', time: '1d ago' },
    ],
  },
  '90': {
    overview: {
      totalAnalyzed: 16870,
      approved: 12654,
      rejected: 2110,
      requiringRevision: 2106,
      consistencyScore: 92.8,
      violations: 3745,
    },
    scoreSeries: [
      { label: 'Jan', score: 84 },
      { label: 'Feb', score: 87 },
      { label: 'Mar', score: 89 },
      { label: 'Apr', score: 91 },
      { label: 'May', score: 92 },
      { label: 'Jun', score: 92.8 },
    ],
    approvalSeries: [
      { name: 'Approved', value: 3120 },
      { name: 'Rejected', value: 620 },
      { name: 'Revision', value: 760 },
    ],
    violationData: [
      { name: 'Tone inconsistency', value: 645 },
      { name: 'Incorrect terminology', value: 598 },
      { name: 'Unsupported claims', value: 514 },
      { name: 'Visual inconsistencies', value: 470 },
      { name: 'Accessibility issues', value: 319 },
      { name: 'Outdated information', value: 267 },
    ],
    trendSeries: [
      { label: 'Jan', weekly: 1840, monthly: 2190 },
      { label: 'Feb', weekly: 1960, monthly: 2360 },
      { label: 'Mar', weekly: 2100, monthly: 2470 },
      { label: 'Apr', weekly: 2240, monthly: 2580 },
      { label: 'May', weekly: 2380, monthly: 2700 },
      { label: 'Jun', weekly: 2500, monthly: 2840 },
    ],
    recentActivity: [
      { title: 'Brand refresh compliance review', type: 'Approval', status: 'Approved', time: '1d ago' },
      { title: 'AI summary validation', type: 'AI Recommendation', status: 'Suggested', time: '2d ago' },
      { title: 'Healthcare campaign audit', type: 'Violation', status: 'Flagged', time: '3d ago' },
      { title: 'Accessibility pass on product pages', type: 'Revision', status: 'Needs review', time: '5d ago' },
    ],
  },
}

const filterOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
]

function AnalyticsPage() {
  const [filter, setFilter] = useState('30')
  const [customStart, setCustomStart] = useState('2025-05-01')
  const [customEnd, setCustomEnd] = useState('2025-05-31')

  const selectedData = useMemo(() => {
    if (filter === 'custom') {
      return {
        overview: {
          totalAnalyzed: 6118,
          approved: 4493,
          rejected: 724,
          requiringRevision: 901,
          consistencyScore: 94.6,
          violations: 1347,
        },
        scoreSeries: [
          { label: 'May 1', score: 91 },
          { label: 'May 6', score: 92 },
          { label: 'May 12', score: 93 },
          { label: 'May 18', score: 94 },
          { label: 'May 24', score: 96 },
          { label: 'May 31', score: 94.6 },
        ],
        approvalSeries: [
          { name: 'Approved', value: 1080 },
          { name: 'Rejected', value: 220 },
          { name: 'Revision', value: 290 },
        ],
        violationData: [
          { name: 'Tone inconsistency', value: 190 },
          { name: 'Incorrect terminology', value: 170 },
          { name: 'Unsupported claims', value: 160 },
          { name: 'Visual inconsistencies', value: 140 },
          { name: 'Accessibility issues', value: 102 },
          { name: 'Outdated information', value: 88 },
        ],
        trendSeries: [
          { label: 'W1', weekly: 810, monthly: 880 },
          { label: 'W2', weekly: 850, monthly: 930 },
          { label: 'W3', weekly: 890, monthly: 980 },
          { label: 'W4', weekly: 930, monthly: 1040 },
        ],
        recentActivity: [
          { title: 'Regional email campaign refresh', type: 'Approval', status: 'Approved', time: '1h ago' },
          { title: 'Homepage brand language check', type: 'AI Recommendation', status: 'Suggested', time: '3h ago' },
          { title: 'Product launch claim validation', type: 'Violation', status: 'Flagged', time: '6h ago' },
          { title: 'Accessibility update review', type: 'Revision', status: 'Needs review', time: '8h ago' },
        ],
      }
    }

    return analyticsData[filter] || analyticsData['30']
  }, [filter])

  const overviewCards = [
    { icon: Sparkles, title: 'Total content analyzed', value: selectedData.overview.totalAnalyzed.toLocaleString(), description: 'Across digital, email, and social campaigns' },
    { icon: CheckCircle2, title: 'Approved content', value: selectedData.overview.approved.toLocaleString(), description: 'Content cleared by brand governance' },
    { icon: ShieldAlert, title: 'Rejected content', value: selectedData.overview.rejected.toLocaleString(), description: 'Failed policy or compliance checkpoints' },
    { icon: AlertTriangle, title: 'Requires revision', value: selectedData.overview.requiringRevision.toLocaleString(), description: 'Needs tone and messaging updates' },
    { icon: TrendingUp, title: 'Brand consistency score', value: `${selectedData.overview.consistencyScore}%`, description: 'Weighted score across channels' },
    { icon: Filter, title: 'Violations detected', value: selectedData.overview.violations.toLocaleString(), description: 'Issues automatically flagged by AI checks' },
  ]

  return (
    <div className="analytics-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="surface-panel mb-6 flex flex-col gap-5 rounded-[2rem] p-4 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Analytics</p>
              <h1 className="text-2xl font-bold text-slate-900">Performance dashboard</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  filter === option.value
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button type="button" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {filter === 'custom' && (
          <div className="surface-panel mb-6 flex flex-col gap-3 rounded-2xl p-4 shadow-sm sm:flex-row sm:items-center sm:justify-end">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarRange className="h-4 w-4 text-slate-400" />
              Start
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarRange className="h-4 w-4 text-slate-400" />
              End
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="flex-1 space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overviewCards.map(({ icon: Icon, title, value, description }) => (
                <InfoCard key={title} icon={Icon} title={title} value={value} description={description} />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Performance</p>
                    <h2 className="text-2xl font-bold text-slate-900">Brand compliance score over time</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                    <ArrowUpRight className="h-4 w-4" />
                    +{selectedData.overview.consistencyScore - 88.5 >= 0 ? (selectedData.overview.consistencyScore - 88.5).toFixed(1) : '0.0'}%
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedData.scoreSeries}>
                      <defs>
                        <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" stroke="#64748b" />
                      <YAxis stroke="#64748b" domain={[80, 100]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="score" stroke="#4f46e5" fill="url(#scoreFill)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                <div className="mb-5">
                  <p className="text-sm text-slate-500">Distribution</p>
                  <h2 className="text-2xl font-bold text-slate-900">Approved vs rejected content</h2>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedData.approvalSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <p className="text-sm text-slate-500">Violation analysis</p>
                  <h2 className="text-2xl font-bold text-slate-900">Content violations by category</h2>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={selectedData.violationData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                        {selectedData.violationData.map((entry, index) => (
                          <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <p className="text-sm text-slate-500">Trend</p>
                  <h2 className="text-2xl font-bold text-slate-900">Weekly and monthly analysis trends</h2>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedData.trendSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="weekly" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="monthly" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Activity stream</p>
                    <h2 className="text-2xl font-bold text-slate-900">Recent activity</h2>
                  </div>
                  <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300">
                    View all
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedData.recentActivity.map((item) => (
                    <div key={`${item.title}-${item.time}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="font-semibold text-slate-800">{item.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                          <span>{item.type}</span>
                          <span>•</span>
                          <span>{item.time}</span>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'Flagged'
                            ? 'bg-red-100 text-red-700'
                            : item.status === 'Suggested'
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5">
                  <p className="text-sm text-slate-500">Violation categories</p>
                  <h2 className="text-2xl font-bold text-slate-900">Top flagged issues</h2>
                </div>

                <div className="space-y-4">
                  {selectedData.violationData.map((item, index) => (
                    <div key={item.name}>
                      <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                        <span>{item.name}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(item.value / selectedData.violationData[0].value) * 100}%`,
                            background: chartPalette[index % chartPalette.length],
                          }}
                        />
                      </div>
                    </div>
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

export default AnalyticsPage
