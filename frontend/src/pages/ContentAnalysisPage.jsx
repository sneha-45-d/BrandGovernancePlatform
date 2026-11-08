import axios from 'axios'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Gauge,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { getApiErrorMessage } from '../lib/apiError'
import {
  defaultGuidelines,
  getCurrentUserId,
  getLocalAnalyses,
  getUserStorageKey,
  loadBrandGuidelines,
  normalizeGuidelines,
  saveBrandGuidelines,
  saveLocalAnalysis,
} from '../lib/brandData'

const scoreCards = [
  { key: 'overall_score', label: 'Overall Score', icon: Gauge },
  { key: 'brand_compliance_score', label: 'Brand Compliance', icon: CheckCircle2 },
  { key: 'tone_consistency', label: 'Tone Consistency', icon: Sparkles },
  { key: 'grammar_score', label: 'Grammar', icon: FileText },
  { key: 'readability_score', label: 'Readability', icon: Wand2 },
]

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0%'
  return `${Math.round(Number(value))}%`
}

function getLocalHistory() {
  return getLocalAnalyses().map((item) => ({
    id: item.id,
    title: item.title,
    brand_name: item.brand_name,
    summary: item.summary,
    overall_score: item.overall_score,
    compliance_score: item.compliance_score,
    status: item.status,
    review_status: item.review_status,
    created_at: item.created_at,
  }))
}

function mergeLocalHistory(serverHistory) {
  const serverIds = new Set(serverHistory.map((item) => item.id))
  const localHistory = getLocalHistory().filter((item) => !serverIds.has(item.id))
  return [...serverHistory, ...localHistory]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

export default function ContentAnalysisPage() {
  const navigate = useNavigate()
  const [guidelines, setGuidelines] = useState(defaultGuidelines)
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [guidelinesLoading, setGuidelinesLoading] = useState(true)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(getLocalHistory)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeReportId, setActiveReportId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)

    try {
      const response = await axios.get('/api/content/history', {
        params: { user_id: getCurrentUserId() },
      })
      setHistory(mergeLocalHistory(response.data.history || []))
    } catch {
      setHistory(getLocalHistory())
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchGuidelines = async () => {
      try {
        const { guidelines: savedGuidelines } = await loadBrandGuidelines()
        if (!cancelled) setGuidelines(savedGuidelines)
      } catch (requestError) {
        if (!cancelled) setError(getApiErrorMessage(requestError, 'Unable to load saved brand rules.'))
      } finally {
        if (!cancelled) setGuidelinesLoading(false)
      }
    }

    const fetchInitialHistory = async () => {
      try {
        const response = await axios.get('/api/content/history', {
          params: { user_id: getCurrentUserId() },
        })
        if (!cancelled) {
          setHistory(mergeLocalHistory(response.data.history || []))
        }
      } catch {
        if (!cancelled) {
          setHistory(getLocalHistory())
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      }
    }

    fetchGuidelines()
    fetchInitialHistory()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch = !searchTerm || `${item.title || ''} ${item.summary || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const matchesDate = !dateFilter || (item.created_at || '').slice(0, 10) === dateFilter
      return matchesSearch && matchesStatus && matchesDate
    })
  }, [dateFilter, history, searchTerm, statusFilter])

  const handleTextChange = (event) => {
    setContent(event.target.value)
  }

  const handleGuidelineChange = (event) => {
    const { name, value } = event.target
    setGuidelines((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSaveGuidelines = async () => {
    await saveBrandGuidelines(guidelines)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!content.trim() && !selectedFile) {
      setError('Please add content or upload a file to analyze.')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis(null)
    setActiveReportId(null)

    try {
      const payload = normalizeGuidelines(guidelines)

      const formData = new FormData()
      formData.append('user_id', payload.user_id)
      formData.append('brand_name', guidelines.brand_name)
      formData.append('content_title', selectedFile ? selectedFile.name : 'Marketing copy review')
      formData.append('content', content)
      formData.append('guidelines', JSON.stringify(payload))

      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      const response = await axios.post('/api/content/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setAnalysis(response.data.analysis)
      setActiveReportId(response.data.report_id || null)
      const localEntry = saveLocalAnalysis({
        reportId: response.data.report_id,
        title: selectedFile ? selectedFile.name : 'Marketing copy review',
        brandName: guidelines.brand_name,
        content,
        analysis: response.data.analysis,
      })
      setHistory((current) => [
        {
          ...localEntry,
          title: localEntry.title,
          review_status: localEntry.review_status,
        },
        ...current.filter((item) => item.id !== localEntry.id),
      ])
      if (response.data.report_id) {
        void fetchHistory()
      }
      localStorage.setItem(getUserStorageKey('brandithm-analysis-content'), content)
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'Unable to connect to the AI content analysis service. Check the backend and API key configuration.'
      ))
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = async (reportId) => {
    try {
      const response = await axios.get(`/api/content/${reportId}`, {
        params: { user_id: getCurrentUserId() },
      })
      setAnalysis(response.data.analysis)
      setContent(response.data.content || '')
      setActiveReportId(reportId)
      setError('')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load the selected analysis report.'))
    }
  }

  const handleDeleteReport = async (reportId) => {
    try {
      await axios.delete(`/api/content/${reportId}`, {
        params: { user_id: getCurrentUserId() },
      })
      setHistory((current) => current.filter((item) => item.id !== reportId))
      if (reportId === activeReportId) {
        setAnalysis(null)
        setActiveReportId(null)
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to delete the selected analysis report.'))
    }
  }

  const handleSendToCorrection = () => {
    if (!content.trim()) {
      setError('Add content to the analyzer before sending it to AI Correction.')
      return
    }

    localStorage.setItem(getUserStorageKey('brandithm-correction-content'), content)
    navigate('/ai-correction')
  }

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">AI Content Engine</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Content Analysis Studio</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveGuidelines}
            disabled={guidelinesLoading}
            className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Save Brand Rules
          </button>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="flex-1 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <form onSubmit={handleSubmit} className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Marketing content</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-950">Analyze brand-safe copy</h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Brand name</label>
                    <input
                      type="text"
                      name="brand_name"
                      value={guidelines.brand_name}
                      disabled={guidelinesLoading}
                      onChange={handleGuidelineChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Brand description</label>
                    <textarea
                      name="brand_description"
                      value={guidelines.brand_description}
                      disabled={guidelinesLoading}
                      onChange={handleGuidelineChange}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Preferred tone</label>
                    <input
                      type="text"
                      name="preferred_tone"
                      value={guidelines.preferred_tone}
                      disabled={guidelinesLoading}
                      onChange={handleGuidelineChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Target audience</label>
                    <input
                      type="text"
                      name="target_audience"
                      value={guidelines.target_audience}
                      disabled={guidelinesLoading}
                      onChange={handleGuidelineChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Preferred keywords</label>
                    <input
                      type="text"
                      name="preferred_keywords"
                      value={Array.isArray(guidelines.preferred_keywords) ? guidelines.preferred_keywords.join(', ') : guidelines.preferred_keywords}
                      disabled={guidelinesLoading}
                      onChange={handleGuidelineChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Restricted words</label>
                    <input
                      type="text"
                      name="restricted_words"
                      value={Array.isArray(guidelines.restricted_words) ? guidelines.restricted_words.join(', ') : guidelines.restricted_words}
                      disabled={guidelinesLoading}
                      onChange={handleGuidelineChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Content to review</label>
                    <textarea
                      value={content}
                      onChange={handleTextChange}
                      rows={9}
                      placeholder="Paste an ad, product description, campaign caption, or marketing message to review..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700">
                      <Upload className="h-4 w-4" />
                      <span>{selectedFile ? selectedFile.name : 'Upload PDF or DOCX'}</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.md"
                        className="hidden"
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || guidelinesLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-blue-500 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_22px_35px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing content...
                      </>
                    ) : guidelinesLoading ? (
                      'Loading brand rules...'
                    ) : (
                      <>
                        Analyze Content
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <p className="text-sm text-slate-500">Brand rules</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Governance settings</h3>

                  <div className="mt-5 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <span className="font-semibold text-slate-800">Writing style:</span> {guidelines.writing_style}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <span className="font-semibold text-slate-800">Communication rules:</span> {guidelines.brand_communication_rules}
                    </div>
                  </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <p className="text-sm text-slate-500">Recent scans</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Analysis history</h3>

                  <div className="mt-5 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search report"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-300"
                      />
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-300"
                      >
                        <option value="all">All status</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(event) => setDateFilter(event.target.value)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-300"
                      />
                    </div>

                    {historyLoading ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                        Loading analysis history...
                      </div>
                    ) : filteredHistory.length ? (
                      filteredHistory.slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-800">{item.title || item.brand_name}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{item.brand_name} • {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}</p>
                            </div>
                            <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                              {formatScore(item.overall_score)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">{item.summary || 'Report available for review.'}</p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewReport(item.id)}
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
                            >
                              View report
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReport(item.id)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                        No matching analysis history yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {analysis && (
              <section className="space-y-6">
                {analysis.warning && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-semibold">
                      {analysis.engine === 'gemini' ? 'BRANDITHM AI analysis' : 'Local rules fallback'}
                    </p>
                    <p className="mt-1">{analysis.warning}</p>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {scoreCards.map(({ key, label, icon: Icon }) => (
                    <div key={key} className="surface-panel rounded-[2rem] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-slate-500">{label}</p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="text-3xl font-black tracking-tight text-slate-950">{formatScore(analysis[key])}</div>
                      <div className="mt-4 h-2.5 rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500"
                          style={{ width: `${Math.min(100, Number(analysis[key]) || 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm text-slate-500">Detected issues</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-950">Brand violations</h3>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {(analysis.violations || []).length ? (
                        analysis.violations.map((item, index) => (
                          <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-800">{item.title}</p>
                              <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                                {item.severity}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                          No major violations detected. Content is aligned with brand guidance.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm text-slate-500">AI guidance</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-950">Recommendations</h3>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {(analysis.recommendations || []).length ? (
                        analysis.recommendations.map((item, index) => (
                          <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="font-semibold text-slate-800">{item.title}</p>
                            <p className="mt-2 text-sm text-slate-600">{item.explanation}</p>
                            <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                              <span className="font-semibold">Suggested copy:</span> {item.suggested_copy}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          No specific content recommendations identified.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <p className="text-sm text-slate-500">AI summary</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Review outcome</h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">{analysis.summary}</p>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 font-semibold text-slate-800">Improved content suggestion</p>
                    <p className="text-sm leading-7 text-slate-600">{analysis.improved_content || 'No revised copy was produced.'}</p>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendToCorrection}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(79,70,229,0.25)] transition hover:-translate-y-0.5"
                    >
                      Send to AI Correction
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
