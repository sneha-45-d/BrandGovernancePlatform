import { useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { getApiErrorMessage } from '../lib/apiError'
import { getCurrentUserId } from '../lib/brandData'

export default function PostAuditPanel({
  posts,
  postsLoading,
  auditSummary,
  onRefresh,
  connections = [],
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPost, setNewPost] = useState({
    platform: 'x',
    caption: '',
    media_url: '',
    permalink: '',
    auto_audit: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [auditingId, setAuditingId] = useState(null)
  const [syncingPlatform, setSyncingPlatform] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!newPost.caption.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await axios.post('/api/social/posts', {
        ...newPost,
        user_id: getCurrentUserId(),
      })
      setSuccess('Post submitted and audited successfully!')
      setShowAddModal(false)
      setNewPost({ platform: 'x', caption: '', media_url: '', permalink: '', auto_audit: true })
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to submit post.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleAuditPost = async (postId) => {
    setAuditingId(postId)
    setError('')
    try {
      await axios.post(`/api/social/posts/${postId}/audit`, null, {
        params: { user_id: getCurrentUserId() },
      })
      setSuccess('Post audit completed!')
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to audit post.'))
    } finally {
      setAuditingId(null)
    }
  }

  const handleBulkAudit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { data } = await axios.post('/api/social/posts/bulk-audit', null, {
        params: { user_id: getCurrentUserId() },
      })
      setSuccess(data.message || 'Bulk audit complete!')
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Bulk audit failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSync = async (platform) => {
    setSyncingPlatform(platform)
    setError('')
    try {
      const { data } = await axios.post(`/api/social/integrations/${platform}/sync`, null, {
        params: { user_id: getCurrentUserId() },
      })
      setSuccess(`Synced ${data.synced_count} posts from ${platform.toUpperCase()}!`)
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, `Failed to sync posts from ${platform}. Make sure account is connected.`))
    } finally {
      setSyncingPlatform(null)
    }
  }

  const getRiskBadge = (level) => {
    switch (level) {
      case 'critical':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700"><AlertCircle className="h-3.5 w-3.5" /> Critical Risk</span>
      case 'high':
        return <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700"><AlertTriangle className="h-3.5 w-3.5" /> High Risk</span>
      case 'medium':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Medium Risk</span>
      case 'low':
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700"><ShieldCheck className="h-3.5 w-3.5" /> Low Risk</span>
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Safe</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200">
          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</div>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-200">
          <div className="flex items-center gap-2"><Check className="h-4 w-4" /> {success}</div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700">&times;</button>
        </div>
      )}

      {/* Metrics Header */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-panel rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500">Brand Safety Score</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${auditSummary?.average_safety_score >= 80 ? 'text-emerald-600' : auditSummary?.average_safety_score >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
              {auditSummary?.average_safety_score ?? 100}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Based on audited brand posts</p>
        </div>

        <div className="surface-panel rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500">Critical / Harmful Posts</p>
          <div className="mt-2 text-3xl font-extrabold text-rose-600">
            {auditSummary?.critical_count ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">High reputational or legal hazard</p>
        </div>

        <div className="surface-panel rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500">Safe / Compliant Posts</p>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600">
            {auditSummary?.safe_count ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Free of false marketing flags</p>
        </div>

        <div className="surface-panel rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500">Monitored Posts</p>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">
            {auditSummary?.total_posts ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{auditSummary?.unaudited_count ?? 0} pending audit</p>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Sync Posts:</span>
          {['x', 'instagram', 'facebook', 'youtube', 'linkedin'].map((platform) => {
            const isConnected = connections.some((c) => c.platform === platform && c.status === 'connected')
            return (
              <button
                key={platform}
                type="button"
                disabled={syncingPlatform !== null}
                onClick={() => handleSync(platform)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isConnected
                    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100 cursor-not-allowed opacity-75'
                }`}
                title={isConnected ? `Sync latest posts from ${platform}` : `${platform} is not connected yet`}
              >
                {syncingPlatform === platform ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {platform.toUpperCase()}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {auditSummary?.unaudited_count > 0 && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleBulkAudit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Audit All ({auditSummary.unaudited_count})
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition"
          >
            <Plus className="h-4 w-4" /> Check / Ingest Post
          </button>
        </div>
      </div>

      {/* Ingest / Check Post Modal */}
      {showAddModal && (
        <div className="surface-panel rounded-2xl p-6 shadow-md border border-emerald-100 bg-emerald-50/30">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Check Post for False Marketing & Brand Risk</h3>
              <p className="mt-1 text-xs text-slate-500">
                Paste draft text or existing social post to instantly audit against claims, deceptive guarantees, and reputation risk.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleCreatePost} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Platform</label>
                <select
                  value={newPost.platform}
                  onChange={(e) => setNewPost({ ...newPost, platform: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="x">X / Twitter</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="manual">Manual / Pre-publish</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Post Link (optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newPost.permalink}
                  onChange={(e) => setNewPost({ ...newPost, permalink: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Post Caption / Tweet Text</label>
              <textarea
                required
                rows={4}
                placeholder="Enter post caption or tweet text..."
                value={newPost.caption}
                onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={newPost.auto_audit}
                  onChange={(e) => setNewPost({ ...newPost, auto_audit: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600"
                />
                Run instant AI Brand Safety audit
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {submitting && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  Audit Post
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-4">
        {postsLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600 mr-2" />
            Loading monitored posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
            <h4 className="mt-3 text-sm font-semibold text-slate-700">No Brand Posts Ingested Yet</h4>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Sync posts from your connected accounts or paste a draft post to monitor false marketing and reputational risk.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" /> Check First Post
            </button>
          </div>
        ) : (
          posts.map((post) => {
            const audit = post.audit_result || {}
            const violations = audit.violations || []
            const isAudited = post.audit_status === 'audited'

            return (
              <div
                key={post.id}
                className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 transition hover:border-slate-200 space-y-4"
              >
                {/* Post Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                      {post.platform}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(post.published_at).toLocaleString()}
                    </span>
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isAudited ? (
                      <>
                        <span className="text-xs font-bold text-slate-700">Safety Score: {audit.safety_score}/100</span>
                        {getRiskBadge(audit.risk_level)}
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={auditingId === post.id}
                        onClick={() => handleAuditPost(post.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        {auditingId === post.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        Run AI Audit
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800 leading-relaxed font-sans">
                  {post.caption}
                </div>

                {/* Audit Breakdown if Audited */}
                {isAudited && (
                  <div className="space-y-3 pt-1">
                    {/* Summary text */}
                    {audit.summary && (
                      <p className="text-xs font-medium text-slate-600 italic">
                        &ldquo;{audit.summary}&rdquo;
                      </p>
                    )}

                    {/* Violations List */}
                    {violations.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" /> Flagged Violations ({violations.length})
                        </p>
                        {violations.map((v, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rose-800 uppercase tracking-wide text-[10px]">
                                {v.category.replace('_', ' ')} &bull; {v.severity}
                              </span>
                              {v.flagged_text && (
                                <span className="rounded bg-rose-200/60 px-1.5 py-0.5 font-mono text-[10px] text-rose-900">
                                  &ldquo;{v.flagged_text}&rdquo;
                                </span>
                              )}
                            </div>
                            <p className="text-slate-700">{v.description}</p>
                            <p className="font-semibold text-emerald-800 flex items-center gap-1">
                              <ArrowRight className="h-3 w-3 shrink-0" /> {v.fix_recommendation}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-xl p-2.5">
                        <CheckCircle2 className="h-4 w-4" /> No false marketing or brand violations detected. Safe to publish!
                      </div>
                    )}

                    {/* Suggested Safe Revision */}
                    {audit.suggested_revision && audit.suggested_revision !== post.caption && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" /> AI Suggested Safe Revision (Claim-Safe & Brand-Aligned)
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(post.id, audit.suggested_revision)}
                            className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-emerald-100"
                          >
                            {copiedId === post.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            {copiedId === post.id ? 'Copied' : 'Copy Revision'}
                          </button>
                        </div>
                        <p className="text-slate-800 leading-relaxed font-sans bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                          {audit.suggested_revision}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

