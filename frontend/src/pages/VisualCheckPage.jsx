import axios from 'axios'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileImage,
  ImageIcon,
  Loader2,
  Maximize2,
  Palette,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { getCurrentUserId } from '../lib/brandData'

export default function VisualCheckPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [guidelines, setGuidelines] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [approvedColorsInput, setApprovedColorsInput] = useState('')
  const [savingGuidelines, setSavingGuidelines] = useState(false)

  const fetchGuidelines = useCallback(async () => {
    try {
      const res = await axios.get('/api/visual/guidelines', {
        params: { user_id: getCurrentUserId() },
      })
      setGuidelines(res.data)
      setApprovedColorsInput((res.data.approved_colors || []).join(', '))
    } catch (err) {
      console.error('Failed to load visual guidelines', err)
    }
  }, [])

  useEffect(() => {
    fetchGuidelines()
  }, [fetchGuidelines])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setReport(null)
    setError('')
  }

  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please select an image file to check.')
      return
    }

    setLoading(true)
    setError('')
    setReport(null)

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('user_id', getCurrentUserId())

    try {
      const res = await axios.post('/api/visual/check', formData)
      setReport(res.data)
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Visual analysis failed.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveGuidelines = async (e) => {
    e.preventDefault()
    setSavingGuidelines(true)
    try {
      const colors = approvedColorsInput
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

      const res = await axios.post('/api/visual/guidelines', {
        user_id: getCurrentUserId(),
        approved_colors: colors,
        color_tolerance: guidelines?.color_tolerance || 35,
        aspect_ratios: guidelines?.aspect_ratios || ['16:9', '1:1', '4:3', '9:16'],
        min_width_px: guidelines?.min_width_px || 400,
        max_width_px: guidelines?.max_width_px || 4000,
      })
      setGuidelines(res.data.guidelines)
      setShowSettings(false)
    } catch (err) {
      console.error('Failed to save visual guidelines', err)
    } finally {
      setSavingGuidelines(false)
    }
  }

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        {/* Header */}
        <div className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-700 shadow-inner">
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Visual Governance</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Visual Brand Consistency Studio</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-full bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-900"
          >
            {showSettings ? 'Close Rules Editor' : 'Configure Visual Rules'}
          </button>
        </div>

        {/* Visual Guidelines Editor Accordion */}
        {showSettings && (
          <form
            onSubmit={handleSaveGuidelines}
            className="surface-panel mb-6 space-y-4 rounded-[2rem] p-6 shadow-md"
          >
            <h3 className="text-lg font-bold text-slate-900">Approved Brand Visual Palette & Constraints</h3>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">
                Approved Hex Colors (Comma-separated)
              </label>
              <input
                type="text"
                value={approvedColorsInput}
                onChange={(e) => setApprovedColorsInput(e.target.value)}
                placeholder="e.g. #059669, #0F172A, #10B981, #FFFFFF"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {(guidelines?.approved_colors || []).map((hex, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1.5 pr-3 text-xs font-semibold shadow-xs"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: hex }}
                    />
                    <span>{hex}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingGuidelines}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingGuidelines ? 'Saving...' : 'Save Visual Rules'}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="flex-1 space-y-6">
            {/* Upload Area */}
            <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 mb-4">
                <FileImage className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-950">Upload Creative Asset</h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Audit banners, logos, social media posts, and marketing creatives against color palette rules, aspect ratios, and clear-space boundaries.
              </p>

              <form onSubmit={handleAnalyze} className="space-y-4">
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 text-center transition hover:border-emerald-400">
                  {previewUrl ? (
                    <div className="space-y-3">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="mx-auto max-h-56 rounded-2xl object-contain shadow-md"
                      />
                      <p className="text-xs font-semibold text-slate-700">{selectedFile?.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <Upload className="h-7 w-7" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Click or drag &amp; drop an image here
                      </p>
                      <p className="text-xs text-slate-400">PNG, JPG, WEBP, or SVG up to 10MB</p>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="mt-4 cursor-pointer text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white file:hover:bg-emerald-700"
                  />
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running Visual Brand Audit...
                    </>
                  ) : (
                    <>
                      Check Visual Brand Consistency <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Audit Results */}
            {report && (
              <div className="space-y-6">
                {/* Score Summary */}
                <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {report.overall_compliant ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Asset Approved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                            <XCircle className="h-4 w-4 text-red-600" /> Guidelines Violation
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-slate-950">Visual Brand Audit Report</h3>
                      <p className="text-xs text-slate-500">Asset: {report.filename} ({report.format})</p>
                    </div>

                    <div className="flex items-center gap-4 rounded-2xl bg-emerald-50/80 p-4 ring-1 ring-emerald-200">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-800">Visual Score</span>
                        <div className="text-4xl font-black text-emerald-700">
                          {report.visual_compliance_score}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Palette Compliance</span>
                        <Palette className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {report.color_analysis.color_compliance_score}%
                      </p>
                      <p className="text-[11px] text-slate-500">Within {report.color_analysis.tolerance_used} delta tolerance</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Aspect Ratio</span>
                        <Maximize2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {report.dimensions.aspect_ratio_detected}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {report.dimensions.ratio_compliant ? '✓ Standard Format' : '⚠ Non-standard format'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Clear Space</span>
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {report.clear_space.clear_space_ok ? 'Compliant' : 'Margin Hazard'}
                      </p>
                      <p className="text-[11px] text-slate-500">{report.clear_space.description}</p>
                    </div>
                  </div>
                </div>

                {/* Color Palette Comparison */}
                <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <h4 className="text-lg font-bold text-slate-950 mb-4">Extracted Dominant Palette vs Approved Brand Swatches</h4>

                  <div className="space-y-3">
                    {report.color_analysis.dominant_colors.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-10 w-10 shrink-0 rounded-xl border border-black/15 shadow-sm"
                            style={{ backgroundColor: item.extracted_hex }}
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              Extracted: <code className="text-emerald-800">{item.extracted_hex}</code>
                            </p>
                            <p className="text-[11px] text-slate-500">{item.percentage}% canvas area</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <ArrowRight className="h-4 w-4 text-slate-400 hidden sm:block" />
                          <div className="flex items-center gap-2">
                            <span
                              className="h-8 w-8 shrink-0 rounded-lg border border-black/15 shadow-xs"
                              style={{ backgroundColor: item.closest_approved_hex }}
                            />
                            <div className="text-left text-xs">
                              <p className="font-semibold text-slate-700">
                                Approved: {item.closest_approved_hex}
                              </p>
                              <p className="text-[10px] text-slate-400">Delta distance: {item.distance}</p>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              item.compliant
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.compliant ? 'Compliant' : 'Off-Brand'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Issues & Recommendations */}
                {(report.issues.length > 0 || report.recommendations.length > 0) && (
                  <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                    <h4 className="text-lg font-bold text-slate-950 mb-4">Actionable Visual Guidance</h4>

                    {report.issues.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-700">
                          Identified Violations ({report.issues.length})
                        </p>
                        {report.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-900 border border-red-200"
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {report.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                          Recommendations
                        </p>
                        {report.recommendations.map((rec, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

