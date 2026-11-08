import axios from 'axios'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenText,
  CheckCheck,
  FileText,
  FolderSync,
  Search,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { getCurrentUserId, getLocalAnalyses } from '../lib/brandData'

const emptyDashboard = {
  brand_name: 'BRANDITHM',
  consistency_score: null,
  total_analyzed: 0,
  approved: 0,
  flagged: 0,
}

function getLocalDashboard(analyses) {
  if (!analyses.length) return emptyDashboard
  const scored = analyses.filter((item) => Number.isFinite(Number(item.overall_score)))
  const average = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + Number(item.overall_score), 0) / scored.length)
    : null
  const flagged = analyses.filter((item) => (item.analysis?.violations || []).some(
    (violation) => ['high', 'critical'].includes(String(violation.severity).toLowerCase())
  )).length

  return {
    ...emptyDashboard,
    brand_name: analyses[0].brand_name || emptyDashboard.brand_name,
    consistency_score: average,
    total_analyzed: analyses.length,
    approved: analyses.length - flagged,
    flagged,
  }
}

function formatTime(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleString()
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(() => getLocalDashboard(getLocalAnalyses()))
  const [recentAnalyses, setRecentAnalyses] = useState(() => getLocalAnalyses().slice(0, 5))
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const localAnalyses = getLocalAnalyses()

    const loadDashboard = async () => {
      try {
        const [dashboardResult] = await Promise.allSettled([
          axios.get('/api/brand/dashboard', { params: { user_id: getCurrentUserId() } }),
        ])
        if (!active) return

        const serverReports = dashboardResult.status === 'fulfilled'
          ? dashboardResult.value.data?.recent_analyses || []
          : []
        const localById = new Map(localAnalyses.map((item) => [item.id, item]))
        const combined = [
          ...serverReports.map((item) => ({ ...localById.get(item.id), ...item })),
          ...localAnalyses.filter((item) => !serverReports.some((report) => report.id === item.id)),
        ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        const remoteStats = dashboardResult.status === 'fulfilled'
          ? dashboardResult.value.data || emptyDashboard
          : getLocalDashboard(combined)

        setDashboard({
          ...emptyDashboard,
          ...remoteStats,
          total_analyzed: Math.max(Number(remoteStats.total_analyzed) || 0, combined.length),
        })
        setRecentAnalyses(combined.slice(0, 5))
      } catch (error) {
        if (!active) return
        setDashboard(getLocalDashboard(localAnalyses))
        setRecentAnalyses(localAnalyses.slice(0, 5))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [])

  const visibleAnalyses = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return recentAnalyses
    return recentAnalyses.filter((item) => (
      `${item.title || ''} ${item.brand_name || ''} ${item.summary || ''}`.toLowerCase().includes(term)
    ))
  }, [recentAnalyses, search])

  const chartData = useMemo(() => {
    const sorted = [...recentAnalyses].reverse()
    return sorted.map((item, index) => ({
      name: item.title?.slice(0, 14) || `Review ${index + 1}`,
      score: Math.round(Number(item.overall_score) || 0),
    }))
  }, [recentAnalyses])

  const metrics = [
    {
      icon: Activity,
      title: 'Brand health',
      value: dashboard.consistency_score === null ? '—' : `${Math.round(Number(dashboard.consistency_score))}%`,
      description: recentAnalyses.length ? 'Average score from your content reviews' : 'Run a review to establish your score',
    },
    {
      icon: FileText,
      title: 'Content reviews',
      value: Number(dashboard.total_analyzed || 0).toLocaleString(),
      description: 'Saved brand content reviews',
    },
    {
      icon: CheckCheck,
      title: 'Clear reviews',
      value: Number(dashboard.approved || 0).toLocaleString(),
      description: 'Reviews without high or critical findings',
    },
    {
      icon: FolderSync,
      title: 'Flagged reviews',
      value: Number(dashboard.flagged || 0).toLocaleString(),
      description: 'Reviews with high or critical findings',
    },
  ]

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{dashboard.brand_name}</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Overview dashboard</h1>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                aria-label="Search analysis history"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reviews"
                className="w-full bg-transparent outline-none placeholder:text-slate-400 sm:w-40"
              />
            </label>
            <Link to="/content-analysis" className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800">
              <Sparkles className="h-4 w-4" /> New review
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar score={dashboard.consistency_score} />

          <main className="min-w-0 flex-1 space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <InfoCard key={metric.title} icon={metric.icon} title={metric.title} value={loading ? '…' : metric.value} description={metric.description} />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-5">
                  <p className="text-sm text-slate-500">Consistency trend</p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">Scores from recent reviews</h2>
                </div>
                {chartData.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="score" name="Brand score" radius={[10, 10, 0, 0]} fill="#4f46e5" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                    <BarChart3 className="h-8 w-8 text-slate-400" />
                    <p className="mt-3 font-semibold text-slate-800">No review scores yet</p>
                    <p className="mt-1 text-sm text-slate-500">Analyze content to populate your brand score trend.</p>
                    <Link to="/brand-intelligence" className="mt-4 text-sm font-semibold text-indigo-700">Start a brand review</Link>
                  </div>
                )}
              </div>

              <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Workspace</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Brand setup</h2>
                  </div>
                  <BookOpenText className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">Manage the rules that guide every content review and AI correction.</p>
                <div className="mt-6 space-y-3">
                  <Link to="/brand-guidelines" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                    Edit brand guidelines <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/brand-intelligence" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                    Run brand intelligence <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>

            <section className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Recent activity</p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">Latest content reviews</h2>
                </div>
                <Link to="/content-analysis" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:text-indigo-700">
                  All reports <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {visibleAnalyses.length ? (
                <div className="space-y-3">
                  {visibleAnalyses.map((item) => {
                    const issues = item.analysis?.violations || []
                    const flagged = issues.some((issue) => ['high', 'critical'].includes(String(issue.severity).toLowerCase()))
                    return (
                      <div key={item.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{item.title || item.brand_name || 'Content review'}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.brand_name || dashboard.brand_name} · {formatTime(item.created_at)}</p>
                          {item.summary && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.summary}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {Number.isFinite(Number(item.overall_score)) && <span className="font-semibold text-slate-800">{Math.round(Number(item.overall_score))}%</span>}
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${flagged ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {flagged ? <><AlertTriangle className="mr-1 inline h-3 w-3" />Review findings</> : 'No critical findings'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 font-semibold text-slate-800">{search ? 'No matching reviews' : 'No content reviews yet'}</p>
                  <p className="mt-1 text-sm text-slate-500">{search ? 'Try another search.' : 'Run your first analysis to see real review activity here.'}</p>
                  {!search && (
                    <Link to="/brand-intelligence" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                      Start a review <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
