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
import { useAuth } from '../lib/AuthContext'

const emptyDashboard = {
  brand_name: 'BRANDITHM',
  consistency_score: null,
  total_analyzed: 0,
  approved: 0,
  flagged: 0,
}

function getLocalDashboard(analyses) {
  if (!analyses.length) return emptyDashboard
  const scored = analyses.filter((item) => (
    item.overall_score !== null
    && item.overall_score !== undefined
    && item.overall_score !== ''
    && Number.isFinite(Number(item.overall_score))
  ))
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

function matchesReviewTitlePrefix(review, term) {
  return String(review.title || review.content_title || '').toLowerCase().startsWith(term)
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(() => getLocalDashboard(getLocalAnalyses()))
  const [recentAnalyses, setRecentAnalyses] = useState(() => getLocalAnalyses().slice(0, 5))
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchSubmitted, setSearchSubmitted] = useState(false)
  const [searchSubmitCount, setSearchSubmitCount] = useState(0)
  const [searchWarning, setSearchWarning] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshWarning, setRefreshWarning] = useState('')

  useEffect(() => {
    let active = true
    const localAnalyses = getLocalAnalyses()
    const localDashboard = getLocalDashboard(localAnalyses)

    const loadDashboard = async () => {
      if (user?.localOnly) {
        setDashboard(localDashboard)
        setRecentAnalyses(localAnalyses.slice(0, 5))
        setRefreshWarning('')
        setLoading(false)
        return
      }

      setLoading(true)
      setRefreshWarning('')
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
        if (dashboardResult.status === 'rejected') {
          setRefreshWarning('Could not refresh reviews from the server. Showing saved reviews from this browser.')
        }

        setDashboard({
          ...emptyDashboard,
          ...remoteStats,
          total_analyzed: Math.max(Number(remoteStats.total_analyzed) || 0, combined.length),
        })
        setRecentAnalyses(combined.slice(0, 5))
      } catch (error) {
        if (!active) return
        console.error('Unable to load the overview dashboard:', error)
        setRefreshWarning('Could not refresh reviews from the server. Showing saved reviews from this browser.')
        setDashboard(localDashboard)
        setRecentAnalyses(localAnalyses.slice(0, 5))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [user?.id, user?.localOnly])

  useEffect(() => {
    const term = search.trim()
    if (!term || user?.localOnly) return undefined

    let active = true
    const delay = searchSubmitted ? 0 : 250
    const timeout = setTimeout(() => {
      axios.get('/api/content/history', {
        params: { user_id: getCurrentUserId(), search: term, search_title_prefix: true },
      })
        .then(({ data }) => {
          if (!active) return
          const localReviews = getLocalAnalyses()
          const localById = new Map(localReviews.map((item) => [item.id, item]))
          const serverReviews = data.history || []
          const serverIds = new Set(serverReviews.map((item) => String(item.id)))
          const combined = [
            ...serverReviews.map((item) => ({ ...localById.get(item.id), ...item })),
            ...localReviews.filter((item) => (
              !serverIds.has(String(item.id)) && matchesReviewTitlePrefix(item, term.toLowerCase())
            )),
          ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          setSearchResults(combined)
          setSearchWarning('')
        })
        .catch((error) => {
          if (!active) return
          console.warn('Unable to search saved reviews on the server:', error)
          setSearchResults(getLocalAnalyses()
            .filter((item) => matchesReviewTitlePrefix(item, term.toLowerCase()))
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)))
          setSearchWarning('Could not search server reviews. Showing reviews saved in this browser.')
        })
        .finally(() => {
          if (active) setSearchLoading(false)
        })
    }, delay)

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [search, searchSubmitCount, searchSubmitted, user?.id, user?.localOnly])

  const visibleAnalyses = useMemo(() => {
    const term = search.trim().toLowerCase()
    const source = term ? searchResults || [] : recentAnalyses
    if (!term) return source
    return source.filter((item) => matchesReviewTitlePrefix(item, term))
  }, [recentAnalyses, search, searchResults])

  const chartData = useMemo(() => {
    const sorted = [...recentAnalyses].reverse().filter((item) => (
      item.overall_score !== null
      && item.overall_score !== undefined
      && item.overall_score !== ''
      && Number.isFinite(Number(item.overall_score))
    ))
    return sorted.map((item, index) => ({
      name: item.title?.slice(0, 14) || `Review ${index + 1}`,
      score: Math.round(Number(item.overall_score)),
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{dashboard.brand_name}</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Overview dashboard</h1>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <form
              className="flex w-full items-center gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault()
                if (!search.trim()) return
                setSearchSubmitted(true)
                setSearchSubmitCount((count) => count + 1)
                if (user?.localOnly) {
                  setSearchResults(getLocalAnalyses()
                    .filter((item) => matchesReviewTitlePrefix(item, search.trim().toLowerCase()))
                    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)))
                  setSearchLoading(false)
                } else {
                  setSearchResults([])
                  setSearchLoading(true)
                }
              }}
            >
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600 shadow-sm sm:flex-none">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  aria-label="Search review titles by prefix"
                  value={search}
                  onChange={(event) => {
                    const value = event.target.value
                    const term = value.trim().toLowerCase()
                    setSearch(value)
                    setSearchSubmitted(false)
                    setSearchWarning('')
                    if (!term) {
                      setSearchResults(null)
                      setSearchLoading(false)
                    } else if (user?.localOnly) {
                      setSearchResults(getLocalAnalyses()
                        .filter((item) => matchesReviewTitlePrefix(item, term))
                        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)))
                      setSearchLoading(false)
                    } else {
                      setSearchResults([])
                      setSearchLoading(true)
                    }
                  }}
                  placeholder="Search review titles"
                  className="w-full bg-transparent outline-none placeholder:text-slate-400 sm:w-40"
                />
              </label>
              <button
                type="submit"
                aria-label="Search saved reviews"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
            <Link to="/content-analysis" className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-700 via-green-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:shadow-emerald-900/25">
              <Sparkles className="h-4 w-4" /> New review
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar score={dashboard.consistency_score} />

          <main className="min-w-0 flex-1 space-y-6">
            {refreshWarning && (
              <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {refreshWarning}
              </p>
            )}
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
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis dataKey="name" stroke="var(--chart-label)" />
                        <YAxis stroke="var(--chart-label)" domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="score" name="Brand score" radius={[10, 10, 0, 0]} fill="#059669" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                    <BarChart3 className="h-8 w-8 text-slate-400" />
                    <p className="mt-3 font-semibold text-slate-800">No review scores yet</p>
                    <p className="mt-1 text-sm text-slate-500">Analyze content to populate your brand score trend.</p>
                    <Link to="/brand-intelligence" className="mt-4 text-sm font-semibold text-emerald-700">Start a brand review</Link>
                  </div>
                )}
              </div>

              <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Workspace</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Brand setup</h2>
                  </div>
                  <BookOpenText className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">Manage the rules that guide every content review and AI correction.</p>
                <div className="mt-6 space-y-3">
                  <Link to="/brand-guidelines" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                    Edit brand guidelines <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/brand-intelligence" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                    Run brand intelligence <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>

            <section className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Recent activity</p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                    {search.trim() ? `Matching reviews${searchLoading ? '' : ` (${visibleAnalyses.length})`}` : 'Latest content reviews'}
                  </h2>
                </div>
                <Link to="/content-analysis" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700">
                  All reports <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {searchWarning && (
                <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {searchWarning}
                </p>
              )}
              {searchLoading ? (
                <div role="status" className="py-8 text-center text-sm text-slate-500">Searching saved reviews…</div>
              ) : visibleAnalyses.length ? (
                <div className="space-y-3">
                  {visibleAnalyses.map((item) => {
                    const issues = item.analysis?.violations || []
                    const flagged = item.has_critical_findings ?? issues.some(
                      (issue) => ['high', 'critical'].includes(String(issue.severity).toLowerCase())
                    )
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
                  <p className="mt-3 font-semibold text-slate-800">{search.trim() ? 'No matching reviews' : 'No content reviews yet'}</p>
                  <p className="mt-1 text-sm text-slate-500">{search.trim() ? 'Try another search.' : 'Run your first analysis to see real review activity here.'}</p>
                  {!search.trim() && (
                    <Link to="/brand-intelligence" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
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
