import axios from 'axios'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { getApiErrorMessage } from '../lib/apiError'
import {
  getCurrentUserId,
  getLocalAnalyses,
  getUserStorageKey,
  updateLocalAnalysisReviewStatus,
} from '../lib/brandData'

const statusLabels = {
  needs_review: 'Needs review',
  approved: 'Approved',
  revision_requested: 'Revision requested',
}

function getStatusClass(status) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800'
  if (status === 'revision_requested') return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

export default function ReviewQueuePage() {
  const navigate = useNavigate()
  const [reviews, setReviews] = useState(getLocalAnalyses)
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('needs_review')
  const [activeAction, setActiveAction] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [details, setDetails] = useState({})

  useEffect(() => {
    let active = true
    const localReviews = getLocalAnalyses()

    axios.get('/api/content/history', { params: { user_id: getCurrentUserId() } })
      .then((response) => {
        if (!active) return
        const localById = new Map(localReviews.map((item) => [item.id, item]))
        const serverReviews = response.data?.history || []
        const combined = [
          ...serverReviews.map((item) => ({
            ...localById.get(item.id),
            ...item,
            review_status: item.review_status || localById.get(item.id)?.review_status || 'needs_review',
          })),
          ...localReviews.filter((item) => !serverReviews.some((report) => report.id === item.id)),
        ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        setReviews(combined)
      })
      .catch(() => {
        if (!active) return
        setReviews(localReviews)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  const filteredReviews = useMemo(() => {
    const term = search.trim().toLowerCase()
    return reviews.filter((review) => {
      const matchesStatus = statusFilter === 'all' || (review.review_status || 'needs_review') === statusFilter
      const matchesSearch = !term || `${review.title || ''} ${review.brand_name || ''} ${review.summary || ''}`.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [reviews, search, statusFilter])

  const counts = useMemo(() => reviews.reduce((result, review) => {
    const status = review.review_status || 'needs_review'
    result[status] = (result[status] || 0) + 1
    return result
  }, { needs_review: 0, approved: 0, revision_requested: 0 }), [reviews])

  const handleStatusChange = async (review, reviewStatus) => {
    const actionId = `${review.id}:${reviewStatus}`
    setActiveAction(actionId)
    setActionError('')

    const hasLocalCopy = updateLocalAnalysisReviewStatus(review.id, reviewStatus)
    if (!review.id.startsWith('local-')) {
      try {
        await axios.patch(`/api/content/${review.id}/review-status`, { status: reviewStatus }, {
          params: { user_id: getCurrentUserId() },
        })
      } catch (error) {
        if (!hasLocalCopy) {
          setActionError(
            getApiErrorMessage(error, 'Could not save this review decision. Please try again.')
          )
          setActiveAction('')
          return
        }
      }
    }

    setReviews((current) => current.map((item) => (
      item.id === review.id ? { ...item, review_status: reviewStatus } : item
    )))
    setActiveAction('')
  }

  const handleViewDetails = async (review) => {
    if (expandedId === review.id) {
      setExpandedId('')
      return
    }
    setExpandedId(review.id)
    if (details[review.id]) return

    const localReview = getLocalAnalyses().find((item) => item.id === review.id)
    if (localReview?.analysis || review.analysis) {
      setDetails((current) => ({ ...current, [review.id]: localReview || review }))
      return
    }

    try {
      const response = await axios.get(`/api/content/${review.id}`, {
        params: { user_id: getCurrentUserId() },
      })
      setDetails((current) => ({ ...current, [review.id]: response.data }))
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, 'Could not load this review. Check the backend and database connection.')
      )
      setExpandedId('')
    }
  }

  const handleSendToCorrection = async (review) => {
    let reviewDetails = details[review.id] || getLocalAnalyses().find((item) => item.id === review.id)
    if (!reviewDetails?.content) {
      try {
        const response = await axios.get(`/api/content/${review.id}`, {
          params: { user_id: getCurrentUserId() },
        })
        reviewDetails = response.data
      } catch (error) {
        setActionError(
          getApiErrorMessage(error, 'Could not load this review for correction. Check the backend and database connection.')
        )
        return
      }
    }

    localStorage.setItem(getUserStorageKey('brandithm-correction-content'), reviewDetails.content)
    navigate('/ai-correction')
  }

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <header className="surface-panel mb-6 rounded-[2rem] p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Content governance</p>
              <h1 className="text-2xl font-bold text-slate-950">Review Queue</h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            Review analyzed content, inspect findings, approve compliant copy, or send content for revision.
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 space-y-6">
            {actionError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {actionError}
              </div>
            )}

            <section className="grid gap-4 sm:grid-cols-3">
              {[
                ['Needs review', counts.needs_review, AlertTriangle],
                ['Approved', counts.approved, CheckCircle2],
                ['Revision requested', counts.revision_requested, RefreshCcw],
              ].map(([label, count, Icon]) => (
                <div key={label} className="surface-panel rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{label}</p>
                    <Icon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{count}</p>
                </div>
              ))}
            </section>

            <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    aria-label="Search review queue"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search reviews"
                    className="min-w-0 bg-transparent outline-none placeholder:text-slate-400"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['needs_review', 'Needs review'],
                    ['revision_requested', 'Revision requested'],
                    ['approved', 'Approved'],
                    ['all', 'All reviews'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        statusFilter === value
                          ? 'bg-emerald-950 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
                </div>
              ) : filteredReviews.length ? (
                <div className="space-y-4">
                  {filteredReviews.map((review) => {
                    const reviewStatus = review.review_status || 'needs_review'
                    const reviewDetails = details[review.id]
                    const analysis = reviewDetails?.analysis
                    const violations = analysis?.violations || []
                    return (
                      <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-semibold text-slate-900">{review.title || 'Content review'}</h2>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStatusClass(reviewStatus)}`}>
                                {statusLabels[reviewStatus] || statusLabels.needs_review}
                              </span>
                              {Number.isFinite(Number(review.overall_score)) && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {Math.round(Number(review.overall_score))}% score
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {review.brand_name || 'BRANDITHM'} · {review.created_at ? new Date(review.created_at).toLocaleString() : 'Recently'}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{review.summary || 'Analysis report is ready for review.'}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 xl:max-w-[350px] xl:justify-end">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(review)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
                            >
                              {expandedId === review.id ? 'Hide details' : 'View details'}
                              <ChevronDown className={`h-3.5 w-3.5 transition ${expandedId === review.id ? 'rotate-180' : ''}`} />
                            </button>
                            {reviewStatus !== 'approved' && (
                              <button
                                type="button"
                                disabled={activeAction === `${review.id}:approved`}
                                onClick={() => handleStatusChange(review, 'approved')}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {activeAction === `${review.id}:approved` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Approve
                              </button>
                            )}
                            {reviewStatus !== 'revision_requested' && (
                              <button
                                type="button"
                                disabled={activeAction === `${review.id}:revision_requested`}
                                onClick={() => handleStatusChange(review, 'revision_requested')}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-60"
                              >
                                {activeAction === `${review.id}:revision_requested` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                                Request revision
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSendToCorrection(review)}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Correct copy <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {expandedId === review.id && (
                          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                            {reviewDetails ? (
                              <>
                                {reviewDetails.content && (
                                  <div>
                                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted content</h3>
                                    <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{reviewDetails.content}</p>
                                  </div>
                                )}
                                <div>
                                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Analysis findings</h3>
                                  {violations.length ? (
                                    <ul className="space-y-2">
                                      {violations.map((violation, index) => (
                                        <li key={`${violation.title}-${index}`} className="rounded-xl border border-slate-200 p-3">
                                          <div className="flex flex-wrap justify-between gap-2">
                                            <span className="text-sm font-semibold text-slate-800">{violation.title}</span>
                                            <span className="text-[10px] font-semibold uppercase text-amber-700">{violation.severity}</span>
                                          </div>
                                          <p className="mt-1 text-sm text-slate-600">{violation.description}</p>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : <p className="text-sm text-slate-600">No findings were included in this report.</p>}
                                </div>
                              </>
                            ) : (
                              <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading report details…</p>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <ClipboardCheck className="mx-auto h-8 w-8 text-slate-400" />
                  <h2 className="mt-3 font-semibold text-slate-800">
                    {reviews.length ? 'No reviews match these filters' : 'Your review queue is clear'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {reviews.length ? 'Try another status or search term.' : 'New content analyses will appear here for review.'}
                  </p>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
