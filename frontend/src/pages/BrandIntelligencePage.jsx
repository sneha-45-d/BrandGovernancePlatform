import axios from 'axios'
import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { defaultGuidelines, loadBrandGuidelines, normalizeGuidelines, saveLocalAnalysis } from '../lib/brandData'

export default function BrandIntelligencePage() {
  const [guidelines, setGuidelines] = useState(defaultGuidelines)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadBrandGuidelines().then(({ guidelines: saved }) => {
      if (!active) return
      setGuidelines(saved)
    })
    return () => { active = false }
  }, [])

  const handleAnalyze = async (event) => {
    event.preventDefault()
    if (!content.trim()) {
      setError('Enter content to analyze.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    const payload = normalizeGuidelines(guidelines)
    const formData = new FormData()
    formData.append('user_id', payload.user_id)
    formData.append('brand_name', payload.brand_name)
    formData.append('content_title', title.trim() || 'Brand intelligence review')
    formData.append('content', content)
    formData.append('guidelines', JSON.stringify(payload))

    try {
      const response = await axios.post('/api/content/analyze', formData)
      setResult(response.data)
      saveLocalAnalysis({
        reportId: response.data.report_id,
        title: title.trim() || 'Brand intelligence review',
        brandName: payload.brand_name,
        content,
        analysis: response.data.analysis,
      })
    } catch (requestError) {
      setError(
        requestError?.response?.data?.detail ||
          'Unable to analyze this content. Check that the backend is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  const analysis = result?.analysis

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <header className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Brand Intelligence</p>
              <h1 className="text-2xl font-bold text-slate-950">Understand every message</h1>
            </div>
          </div>
          <Link to="/brand-guidelines" className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
            Edit brand guidelines <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 space-y-6">
            <form onSubmit={handleAnalyze} className="surface-panel rounded-[2rem] p-6">
              <div className="mb-5">
                <p className="text-sm text-slate-500">Current brand</p>
                <h2 className="text-xl font-bold text-slate-950">{guidelines.brand_name}</h2>
                <p className="mt-1 text-sm text-slate-600">{guidelines.preferred_tone}</p>
              </div>
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Review name
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Spring launch landing page" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Content to review
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={10} required placeholder="Paste campaign copy, a product description, an email, or other brand messaging…" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal leading-6 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" />
                </label>
                {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <button disabled={loading} type="submit" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? 'Reviewing content…' : 'Run brand intelligence review'}
                </button>
              </div>
            </form>

            {analysis && (
              <section className="surface-panel space-y-5 rounded-[2rem] p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Review result</p>
                    <h2 className="text-xl font-bold text-slate-950">{result.message}</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-4 py-2 text-lg font-bold text-emerald-800">
                    {Math.round(Number(analysis.overall_score) || 0)}%
                  </span>
                </div>
                {analysis.warning && <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{analysis.warning}</p>}
                <p className="text-sm leading-6 text-slate-600">{analysis.summary}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Brand compliance', analysis.brand_compliance_score],
                    ['Tone consistency', analysis.tone_consistency],
                    ['Grammar', analysis.grammar_score],
                    ['Readability', analysis.readability_score],
                  ].map(([label, score]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{Math.round(Number(score) || 0)}%</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><AlertTriangle className="h-4 w-4 text-amber-600" />Findings</h3>
                  {(analysis.violations || []).length ? (
                    <ul className="space-y-2">
                      {analysis.violations.map((item, index) => (
                        <li key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex justify-between gap-3">
                            <span className="font-medium text-slate-800">{item.title}</span>
                            <span className="text-xs font-semibold uppercase text-amber-700">{item.severity}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">No brand violations were identified.</p>}
                </div>
                <Link to="/content-analysis" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                  Open full analysis studio <ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
