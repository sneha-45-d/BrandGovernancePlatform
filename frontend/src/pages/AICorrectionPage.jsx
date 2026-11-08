import axios from 'axios'
import {
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { getApiErrorMessage } from '../lib/apiError'
import { defaultGuidelines, getUserStorageKey, loadBrandGuidelines, normalizeGuidelines } from '../lib/brandData'

export default function AICorrectionPage() {
  const [guidelines, setGuidelines] = useState(defaultGuidelines)
  const [content, setContent] = useState(() => localStorage.getItem(getUserStorageKey('brandithm-correction-content')) || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [guidelinesLoading, setGuidelinesLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    const fetchGuidelines = async () => {
      try {
        const { guidelines: savedGuidelines } = await loadBrandGuidelines()
        if (active) setGuidelines(savedGuidelines)
      } catch (requestError) {
        if (active) setError(getApiErrorMessage(requestError, 'Unable to load saved brand rules.'))
      } finally {
        if (active) setGuidelinesLoading(false)
      }
    }

    fetchGuidelines()
    return () => { active = false }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!content.trim()) {
      setError('Please enter the original content you want improved.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const payload = normalizeGuidelines(guidelines)

      const formData = new FormData()
      formData.append('user_id', payload.user_id)
      formData.append('brand_name', guidelines.brand_name)
      formData.append('content', content)
      formData.append('guidelines', JSON.stringify(payload))

      const response = await axios.post('/api/content/correct', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setResult(response.data)
      localStorage.setItem(getUserStorageKey('brandithm-correction-content'), content)
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'Unable to generate corrected content. Check the backend configuration or Gemini quota.'
      ))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result?.corrected_content) return

    try {
      await navigator.clipboard.writeText(result.corrected_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch (error) {
      setError('The browser blocked clipboard access. Please copy the text manually.')
    }
  }

  const handleDownload = () => {
    if (!result?.corrected_content) return

    const blob = new Blob([result.corrected_content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'brandithm-corrected-content.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 shadow-inner">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">AI correction</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Rewrite to brand standards</h1>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="flex-1 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <form onSubmit={handleSubmit} className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Original content</p>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-950">Improve the copy</h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Brand name</label>
                    <input
                      type="text"
                      value={guidelines.brand_name}
                      disabled={guidelinesLoading}
                      onChange={(event) => setGuidelines((current) => ({ ...current, brand_name: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Original marketing copy</label>
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      rows={12}
                      placeholder="Paste the original ad, caption, email headline, or product description here..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
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
                        Correcting content...
                      </>
                    ) : guidelinesLoading ? (
                      'Loading brand rules...'
                    ) : (
                      <>
                        Correct Content
                        <RefreshCcw className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <p className="text-sm text-slate-500">Brand guidance</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Rewrite context</h3>

                  <div className="mt-5 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <span className="font-semibold text-slate-800">Tone:</span> {guidelines.preferred_tone}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <span className="font-semibold text-slate-800">Keywords:</span> {Array.isArray(guidelines.preferred_keywords) ? guidelines.preferred_keywords.join(', ') : guidelines.preferred_keywords}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <span className="font-semibold text-slate-800">Rules:</span> {guidelines.brand_communication_rules}
                    </div>
                  </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <p className="text-sm text-slate-500">AI output</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Results</h3>

                  {!result ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      Corrected content will appear here after the AI rewrite runs.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        <p className="font-semibold">
                          {result.engine === 'gemini' ? `${guidelines.brand_name} AI result` : 'Local rules fallback'}
                        </p>
                        <p className="mt-1">{result.summary}</p>
                      </div>
                      {result.warning && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          {result.warning}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {result && (
              <section className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm text-slate-500">Original</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-950">Before</h3>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{content}</p>
                  </div>

                  <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm text-slate-500">Corrected version</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-950">After</h3>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{result.corrected_content}</p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
                      >
                        <Copy className="h-4 w-4" />
                        {copied ? 'Copied' : 'Copy corrected content'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm text-slate-500">Changes made</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-950">What improved</h3>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(result.changes_made || []).length ? (
                        result.changes_made.map((item, index) => (
                          <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="font-semibold text-slate-800">{item.title}</p>
                            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          No explicit changes were provided by the AI engine, but the corrected text reflects the requested brand improvements.
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
                        <p className="text-sm text-slate-500">AI explanation</p>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-950">Improvements</h3>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(result.improvements || []).length ? (
                        result.improvements.map((item, index) => (
                          <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="font-semibold text-slate-800">{item.title}</p>
                            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          The rewrite improves clarity and tone in line with your saved brand guidelines.
                        </div>
                      )}
                    </div>
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
