import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Edit2,
  Flame,
  Lightbulb,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'

export default function CompetitorComparisonDashboard({
  comparisonData,
  loading,
  competitors,
  competitorsLoading,
  onRefresh,
  onAddCompetitor,
  onEditCompetitor,
  onDeleteCompetitor,
  working,
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState({ name: '', keywords: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (editingItem) {
      onEditCompetitor(editingItem.id, form)
      setEditingItem(null)
    } else {
      onAddCompetitor(form)
      setShowAddForm(false)
    }
    setForm({ name: '', keywords: '' })
  }

  const brandOverview = comparisonData?.brand_overview
  const competitorList = comparisonData?.competitors || []
  const opportunities = comparisonData?.opportunities || []
  const marketThreats = comparisonData?.market_threats || []

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">
            <Building2 className="h-4 w-4" /> Market Intelligence
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Brand vs Competitor Comparison
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Side-by-side performance comparison, competitor weakness detection, and AI campaigns to win market share.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            Refresh Intelligence
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingItem(null)
              setForm({ name: '', keywords: '' })
              setShowAddForm((prev) => !prev)
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition"
          >
            <Plus className="h-4 w-4" /> Add Competitor
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {(showAddForm || editingItem) && (
        <div className="surface-panel rounded-2xl p-5 shadow-sm border border-emerald-100 bg-emerald-50/20">
          <h3 className="font-bold text-slate-900 text-sm">
            {editingItem ? 'Edit Competitor Profile' : 'Register a Competitor to Monitor'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Enter brand name and product keywords. Our AI will benchmark your claims, sentiment, and opportunities.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Competitor Brand Name</label>
              <input
                required
                maxLength={120}
                placeholder="e.g. RivalCorp"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Keywords / Products (comma separated)</label>
              <input
                placeholder="e.g. serum, anti-aging, discounts"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingItem(null)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={working}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                {working ? 'Saving…' : editingItem ? 'Update Profile' : 'Save & Benchmark'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-500">
          <LoaderCircle className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
          <p className="font-semibold text-slate-700">Computing Competitive Landscape...</p>
        </div>
      ) : (
        <>
          {/* Side-by-Side Brand Benchmark Cards */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* Primary Brand Card */}
            {brandOverview && (
              <div className="surface-panel rounded-3xl p-5 shadow-sm border-2 border-emerald-500 bg-gradient-to-b from-emerald-50/40 to-white space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Your Brand (Primary)
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    {brandOverview.share_of_voice}% SOV
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{brandOverview.name}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-emerald-600">{brandOverview.sentiment_score}</span>
                    <span className="text-xs text-slate-400">/ 100 Sentiment Score</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Positive Sentiment:</span>
                    <span className="font-bold text-emerald-600">{brandOverview.positive_pct}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Negative Sentiment:</span>
                    <span className="font-bold text-rose-600">{brandOverview.negative_pct}%</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-bold text-slate-800">Core Strengths:</p>
                  <ul className="space-y-1 text-slate-600">
                    {(brandOverview.top_strengths || []).map((s, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Competitor Cards */}
            {competitorList.map((comp, idx) => (
              <div
                key={idx}
                className="surface-panel rounded-3xl p-5 shadow-sm border border-slate-200 bg-white space-y-4 hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Competitor
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {comp.share_of_voice}% SOV
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{comp.name}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-800">{comp.sentiment_score}</span>
                    <span className="text-xs text-slate-400">/ 100 Sentiment Score</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Positive Sentiment:</span>
                    <span className="font-bold text-emerald-600">{comp.positive_pct}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Negative Sentiment:</span>
                    <span className="font-bold text-rose-600">{comp.negative_pct}%</span>
                  </div>
                </div>

                {/* Critical Weakness / False Marketing Angle */}
                <div className="space-y-1.5 text-xs bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                  <p className="font-bold text-rose-800 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-rose-600" /> Exploitable Flaws:
                  </p>
                  <ul className="space-y-1 text-slate-700">
                    {(comp.critical_weaknesses || []).map((w, i) => (
                      <li key={i} className="flex items-start gap-1">
                        &bull; {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Strategic Opportunities to Outmaneuver Competitors */}
          <div className="surface-panel rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-600" /> Strategic Opportunities & Counter-Campaigns
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Target competitor vulnerabilities (unsubstantiated claims, customer dissatisfaction) to capture market share.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                {opportunities.length} Battlegrounds
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {opportunities.map((opp, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{opp.title}</span>
                    <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-900">
                      {opp.impact}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">
                      Target: <span className="text-emerald-700 font-bold">{opp.target_competitor}</span>
                    </p>
                    <p className="leading-relaxed">{opp.gap_analysis}</p>
                  </div>

                  <div className="rounded-xl bg-white p-3 text-xs border border-emerald-100 space-y-1">
                    <p className="font-bold text-emerald-900 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Recommended Campaign:
                    </p>
                    <p className="text-slate-700 leading-relaxed font-sans">{opp.recommended_campaign}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market Threats & Action Summary */}
          {comparisonData?.action_plan_summary && (
            <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-slate-600" /> Strategic Action Plan Summary
              </h4>
              <p className="text-xs leading-relaxed text-slate-700 font-sans">
                {comparisonData.action_plan_summary}
              </p>
              {marketThreats.length > 0 && (
                <div className="pt-2 border-t border-slate-200/70">
                  <p className="text-[11px] font-bold text-rose-700 mb-1">Watch Out For:</p>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                    {marketThreats.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Registered Profiles Manager */}
          <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Managed Competitor Profiles</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {competitors.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                      <p className="text-[10px] text-slate-400">Added {new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item)
                          setForm({ name: item.name, keywords: (item.keywords || []).join(', ') })
                          setShowAddForm(false)
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit profile"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCompetitor(item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete competitor"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {item.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.keywords.map((kw, i) => (
                        <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

