import axios from 'axios'
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Loader2,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { getCurrentUserId } from '../lib/brandData'

export default function CompetitorManagePage() {
  const [competitors, setCompetitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    slogans: '',
    keywords: '',
  })
  const [statusMsg, setStatusMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const [simText, setSimText] = useState('')
  const [simLoading, setSimLoading] = useState(false)
  const [simResult, setSimResult] = useState(null)

  const fetchCompetitors = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/competitors', {
        params: { user_id: getCurrentUserId() },
      })
      setCompetitors(res.data.competitors || [])
    } catch (err) {
      console.error('Failed to load competitors', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompetitors()
  }, [fetchCompetitors])

  const openAddModal = () => {
    setEditingId(null)
    setFormData({ name: '', slogans: '', keywords: '' })
    setShowModal(true)
  }

  const openEditModal = (comp) => {
    setEditingId(comp.id)
    setFormData({
      name: comp.name,
      slogans: (comp.slogans || []).join(', '),
      keywords: (comp.keywords || []).join(', '),
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    setStatusMsg('')

    const payload = {
      user_id: getCurrentUserId(),
      name: formData.name.trim(),
      slogans: formData.slogans
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      keywords: formData.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    }

    try {
      if (editingId) {
        await axios.put(`/api/competitors/${editingId}`, payload)
        setStatusMsg('Competitor profile updated successfully!')
      } else {
        await axios.post('/api/competitors', payload)
        setStatusMsg('New competitor registered successfully!')
      }
      setShowModal(false)
      fetchCompetitors()
    } catch (err) {
      setStatusMsg(err?.response?.data?.detail || 'Failed to save competitor profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this competitor registry entry?')) return
    try {
      await axios.delete(`/api/competitors/${id}`, {
        params: { user_id: getCurrentUserId() },
      })
      fetchCompetitors()
    } catch (err) {
      console.error('Failed to delete competitor', err)
    }
  }

  const runSimTest = async () => {
    if (!simText.trim()) return
    setSimLoading(true)
    setSimResult(null)
    try {
      const res = await axios.post('/api/competitors/check-clash', {
        user_id: getCurrentUserId(),
        text: simText,
        threshold: 0.6,
      })
      setSimResult(res.data)
    } catch (err) {
      console.error('Simulation check failed', err)
    } finally {
      setSimLoading(false)
    }
  }

  const filtered = competitors.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        {/* Header */}
        <div className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 shadow-inner">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">IP & Trademark Guard</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Competitor Registry & Clash Prevention</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-900"
          >
            <Plus className="h-4 w-4" /> Add Competitor
          </button>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="flex-1 space-y-6">
            {statusMsg && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                {statusMsg}
              </div>
            )}

            {/* Quick Simulation Banner */}
            <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldAlert className="h-4 w-4 text-emerald-600" />
                <span>Check copy against registered competitors</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Check a draft headline or tagline against competitor profiles you have registered.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="Paste a draft headline or tagline here (e.g. 'The future of cloud is here now')..."
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={runSimTest}
                  disabled={simLoading || !simText.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {simLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '                  Check for clashes'}
                </button>
              </div>

              {simResult && (
                <div className="mt-4 rounded-xl border p-4 text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    {simResult.has_clashes ? (
                      <span className="text-red-700 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" /> {simResult.summary}
                      </span>
                    ) : simResult.checked === false ? (
                      <span className="text-amber-800 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" /> {simResult.summary}
                      </span>
                    ) : (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> {simResult.summary}
                      </span>
                    )}
                  </div>
                  {simResult.clashes.map((c, i) => (
                    <div key={i} className="mt-2 rounded-lg bg-slate-100 p-2.5">
                      <strong>{c.competitor}</strong>: {c.context}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Competitor Registry List */}
            <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Registered Competitors</h2>
                  <p className="text-xs text-slate-500">
                    Content analysis automatically scans for slogans, proprietary keywords, and brand names of all listed entities.
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search competitors..."
                    className="rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs outline-none focus:border-emerald-300"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center p-8 text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading competitor registry...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    No competitors registered yet. Click &quot;Add Competitor&quot; above to register market rivals and avoid IP clashes.
                  </div>
                ) : (
                  filtered.map((comp) => (
                    <div
                      key={comp.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{comp.name}</h3>
                          <p className="text-[11px] text-slate-400">Added on {new Date(comp.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(comp)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(comp.id)}
                            className="rounded-xl border border-red-200 bg-white p-2 text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">Protected Slogans / Claims</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(comp.slogans || []).length > 0 ? (
                              comp.slogans.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
                                >
                                  &ldquo;{s}&rdquo;
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No slogans registered</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">Proprietary Keywords</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(comp.keywords || []).length > 0 ? (
                              comp.keywords.map((k, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                                >
                                  #{k}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No keywords registered</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Competitor Profile' : 'Register New Competitor'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">Competitor Brand Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Acme Cloud Corp"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">
                  Known Slogans & Taglines (Comma-separated)
                </label>
                <textarea
                  rows={3}
                  value={formData.slogans}
                  onChange={(e) => setFormData({ ...formData, slogans: e.target.value })}
                  placeholder="e.g. The Future is Here, Innovation Guaranteed, Faster Than Ever"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">
                  Proprietary Keywords & Features (Comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="e.g. HyperFlow, QuantumGrid, TurboSync"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Register Competitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
