import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { getApiErrorMessage } from '../lib/apiError'
import { getCurrentUserId } from '../lib/brandData'

const chartPalette = ['#08734f', '#10b981', '#f59e0b', '#ef4444', '#34d399', '#0ea5e9']
const filterOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
]

function toDateInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function formatTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}

function escapeCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function downloadAnalytics(data) {
  const rows = [
    ['Brandithm analytics', data.start_date, data.end_date],
    ['Metric', 'Value'],
    ['Total analyses', data.overview.total_analyzed],
    ['Approved', data.overview.approved],
    ['Needs review', data.overview.needs_review],
    ['Revision requested', data.overview.revision_requested],
    ['Average brand compliance score', data.overview.consistency_score ?? ''],
    ['Findings', data.overview.violations],
    [],
    ['Finding', 'Count'],
    ...data.violation_data.map(({ name, value }) => [name, value]),
  ]
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `brandithm-analytics-${data.start_date}-to-${data.end_date}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function AnalyticsPage() {
  const [filter, setFilter] = useState('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const dateRange = useMemo(() => {
    if (filter === 'custom') return { startDate: customStart, endDate: customEnd }
    const days = Number(filter)
    const end = new Date()
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(end) }
  }, [customEnd, customStart, filter])
  const rangeError = !dateRange.startDate || !dateRange.endDate
    ? 'Select both dates for the custom range.'
    : dateRange.endDate < dateRange.startDate
      ? 'End date must be on or after the start date.'
      : ''

  useEffect(() => {
    if (rangeError) return

    let active = true
    axios.get('/api/analytics', {
      params: {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        user_id: getCurrentUserId(),
      },
    })
      .then(({ data: result }) => {
        if (active) setData(result)
      })
      .catch((requestError) => {
        if (active) {
          setData(null)
          setError(getApiErrorMessage(requestError, 'Unable to load analytics. Please try again.'))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [dateRange, rangeError])

  const handleFilterChange = (nextFilter) => {
    if (nextFilter === 'custom') {
      const end = new Date()
      setCustomEnd(toDateInputValue(end))
      setCustomStart(toDateInputValue(new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000)))
    }
    setData(null)
    setError('')
    setLoading(true)
    setFilter(nextFilter)
  }

  const handleCustomDateChange = (setter, value) => {
    setter(value)
    setData(null)
    setError('')
    setLoading(Boolean(value))
  }

  const visibleData = rangeError ? null : data
  const visibleOverview = visibleData?.overview
  const overviewCards = [
    { icon: Sparkles, title: 'Total content analyzed', value: visibleOverview?.total_analyzed ?? '—', description: 'Saved analyses in this date range' },
    { icon: CheckCircle2, title: 'Approved content', value: visibleOverview?.approved ?? '—', description: 'Reviews marked approved' },
    { icon: ShieldAlert, title: 'Needs review', value: visibleOverview?.needs_review ?? '—', description: 'Reviews awaiting a decision' },
    { icon: AlertTriangle, title: 'Requires revision', value: visibleOverview?.revision_requested ?? '—', description: 'Reviews sent back for revision' },
    { icon: TrendingUp, title: 'Brand consistency score', value: visibleOverview?.consistency_score == null ? '—' : `${visibleOverview.consistency_score}%`, description: 'Average saved brand compliance score' },
    { icon: Filter, title: 'Findings detected', value: visibleOverview?.violations ?? '—', description: 'Recorded analysis findings, excluding no-issue notices' },
  ]
  const hasAnalyses = (visibleOverview?.total_analyzed ?? 0) > 0
  const hasScores = (visibleData?.score_series.length ?? 0) > 0
  const hasReviews = (visibleData?.review_series.some((item) => item.value > 0) ?? false)
  const hasViolations = (visibleData?.violation_data.length ?? 0) > 0

  return (
    <div className="analytics-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="surface-panel mb-6 flex flex-col gap-5 rounded-[2rem] p-4 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Analytics</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Performance dashboard</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleFilterChange(option.value)}
                aria-pressed={filter === option.value}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  filter === option.value
                    ? 'bg-gradient-to-r from-slate-900 to-slate-700 text-white shadow-lg shadow-slate-200/80'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-950'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => data && downloadAnalytics(data)}
              disabled={!data || loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
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
                onChange={(event) => handleCustomDateChange(setCustomStart, event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarRange className="h-4 w-4 text-slate-400" />
              End
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(event) => handleCustomDateChange(setCustomEnd, event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="min-w-0 flex-1 space-y-6">
            {(rangeError || error) && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {rangeError || error}
              </div>
            )}
            {data?.warning && (
              <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {data.warning}
              </div>
            )}
            {loading && <p role="status" className="text-sm text-slate-500">Loading analytics…</p>}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overviewCards.map(({ icon: Icon, title, value, description }) => (
                <InfoCard key={title} icon={Icon} title={title} value={loading ? '…' : value} description={description} />
              ))}
            </section>

            {!loading && !error && !hasAnalyses && (
              <div className="surface-panel rounded-[2rem] p-8 text-center">
                <p className="text-lg font-semibold text-slate-900">No saved analyses in this date range</p>
                <p className="mt-2 text-sm text-slate-600">Run a content analysis to start building your brand analytics.</p>
                <Link to="/content-analysis" className="mt-4 inline-flex rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                  Analyze content
                </Link>
              </div>
            )}

            {hasAnalyses && (
              <>
                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-500">Performance</p>
                        <h2 className="text-2xl font-bold text-slate-900">Brand compliance by analysis</h2>
                      </div>
                      {visibleOverview?.consistency_score != null && (
                        <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                          <ArrowUpRight className="h-4 w-4" />
                          {visibleOverview.consistency_score}%
                        </div>
                      )}
                    </div>
                    {hasScores ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={visibleData.score_series}>
                            <defs>
                              <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="5%" stopColor="#08734f" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#08734f" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis dataKey="label" stroke="var(--chart-label)" />
                            <YAxis stroke="var(--chart-label)" domain={[0, 100]} />
                            <Tooltip />
                            <Area type="monotone" dataKey="score" name="Compliance score" stroke="#08734f" fill="url(#scoreFill)" strokeWidth={3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="py-16 text-center text-sm text-slate-500">No compliance scores are available for this period.</p>}
                  </div>

                  <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                    <div className="mb-5">
                      <p className="text-sm text-slate-500">Review workflow</p>
                      <h2 className="text-2xl font-bold text-slate-900">Review decisions</h2>
                    </div>
                    {hasReviews ? (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={visibleData.review_series}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis dataKey="name" stroke="var(--chart-label)" />
                            <YAxis stroke="var(--chart-label)" allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" name="Reviews" radius={[10, 10, 0, 0]}>
                              {visibleData.review_series.map((entry, index) => (
                                <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="py-16 text-center text-sm text-slate-500">No review decisions are available for this period.</p>}
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                    <div className="mb-5">
                      <p className="text-sm text-slate-500">Findings</p>
                      <h2 className="text-2xl font-bold text-slate-900">Recorded findings by title</h2>
                    </div>
                    {hasViolations ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={visibleData.violation_data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                              {visibleData.violation_data.map((entry, index) => (
                                <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="py-16 text-center text-sm text-slate-500">No findings were recorded in this period.</p>}
                  </div>

                  <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                    <div className="mb-5">
                      <p className="text-sm text-slate-500">Volume</p>
                      <h2 className="text-2xl font-bold text-slate-900">Daily analyses and cumulative total</h2>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={visibleData.trend_series}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                          <XAxis dataKey="label" stroke="var(--chart-label)" minTickGap={20} />
                          <YAxis stroke="var(--chart-label)" allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="analyses" name="Analyses per day" stroke="#08734f" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="cumulative" name="Cumulative analyses" stroke="#10b981" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Activity stream</p>
                        <h2 className="text-2xl font-bold text-slate-900">Recent activity</h2>
                      </div>
                      <Link to="/content-analysis" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300">
                        View analyses
                      </Link>
                    </div>
                    {visibleData.recent_activity.length ? (
                      <div className="space-y-4">
                        {visibleData.recent_activity.map((item) => (
                          <div key={item.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                            <div>
                              <p className="font-semibold text-slate-800">{item.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                <span>{item.engine === 'unknown' ? 'Analysis' : `${item.engine} analysis`}</span>
                                <span aria-hidden="true">·</span>
                                <span>{formatTime(item.created_at)}</span>
                              </div>
                            </div>
                            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.review_status === 'approved'
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.review_status === 'revision_requested'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-200 text-slate-700'
                            }`}>
                              {item.review_status === 'approved' ? 'Approved' : item.review_status === 'revision_requested' ? 'Revision requested' : 'Needs review'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">No recent activity in this period.</p>}
                  </div>

                  <div className="surface-panel rounded-[2rem] p-6 shadow-sm">
                    <div className="mb-5">
                      <p className="text-sm text-slate-500">Finding categories</p>
                      <h2 className="text-2xl font-bold text-slate-900">Top recorded findings</h2>
                    </div>
                    {hasViolations ? (
                      <div className="space-y-4">
                        {visibleData.violation_data.map((item, index) => (
                          <div key={item.name}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm text-slate-600">
                              <span className="break-words">{item.name}</span>
                              <span>{item.value}</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(item.value / visibleData.violation_data[0].value) * 100}%`,
                                  background: chartPalette[index % chartPalette.length],
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">No findings were recorded in this period.</p>}
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
