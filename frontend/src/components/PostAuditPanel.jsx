import { useState, useRef } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  MessageCircle,
  Play,
  Plus,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { getApiErrorMessage } from '../lib/apiError'
import { getCurrentUserId } from '../lib/brandData'

export default function PostAuditPanel({
  posts,
  postsLoading,
  auditSummary,
  onRefresh,
  onDeletePost,
  connections = [],
}) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [importMode, setImportMode] = useState('single') // 'single' | 'bulk'
  const [bulkUrls, setBulkUrls] = useState('')
  const [bulkPlatform, setBulkPlatform] = useState('instagram')
  const [newPost, setNewPost] = useState({
    platform: 'instagram',
    media_type: 'image',
    caption: '',
    media_url: '',
    video_script: '',
    permalink: '',
    views: '',
    likes: '',
    comments: '',
    shares: '',
    auto_audit: true,
  })
  const [filePreview, setFilePreview] = useState(null)
  const fileInputRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [auditingId, setAuditingId] = useState(null)
  const [syncingPlatform, setSyncingPlatform] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to remove all monitored posts? This will delete any old or sample posts and give you a fresh dashboard.')) return
    setSubmitting(true)
    setError('')
    try {
      const { data } = await axios.delete('/api/social/posts/clear-all', {
        params: { user_id: getCurrentUserId() },
      })
      setSuccess(data.message || 'All posts removed.')
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to clear posts.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkImport = async (e) => {
    e.preventDefault()
    const urls = bulkUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 5)

    if (!urls.length) {
      setError('Please enter at least one valid post or reel URL.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const { data } = await axios.post('/api/social/posts/bulk-import', {
        platform: bulkPlatform,
        urls,
        auto_audit: true,
        user_id: getCurrentUserId(),
      })
      setSuccess(data.message || `Successfully imported and audited ${data.imported_count} posts!`)
      setShowAddModal(false)
      setBulkUrls('')
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to bulk import posts.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds 25MB limit.')
      return
    }
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) {
      setError('Please upload an image (PNG, JPG, WEBP) or video (MP4, WEBM).')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target.result
      setFilePreview({
        url: dataUrl,
        type: isVideo ? 'video' : 'image',
        name: file.name,
      })
      setNewPost((prev) => ({
        ...prev,
        media_url: dataUrl,
        media_type: isVideo ? 'video' : 'image',
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleClearFile = () => {
    setFilePreview(null)
    setNewPost((prev) => ({ ...prev, media_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImportPost = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await axios.post('/api/social/posts/import', {
        platform: newPost.platform,
        media_type: newPost.media_type,
        caption: newPost.caption,
        media_url: newPost.media_url,
        video_script: newPost.video_script,
        permalink: newPost.permalink,
        views: parseInt(newPost.views || '0', 10) || 0,
        likes: parseInt(newPost.likes || '0', 10) || 0,
        comments: parseInt(newPost.comments || '0', 10) || 0,
        shares: parseInt(newPost.shares || '0', 10) || 0,
        auto_audit: newPost.auto_audit,
        user_id: getCurrentUserId(),
      })
      setSuccess(`Post (${newPost.media_type.toUpperCase()}) imported and audited successfully!`)
      setShowAddModal(false)
      setNewPost({
        platform: 'instagram',
        media_type: 'image',
        caption: '',
        media_url: '',
        video_script: '',
        permalink: '',
        views: '',
        likes: '',
        comments: '',
        shares: '',
        auto_audit: true,
      })
      setFilePreview(null)
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to import post.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (postId) => {
    if (!postId) return
    if (!window.confirm('Are you sure you want to take down and delete this post?')) return
    setDeletingId(postId)
    try {
      if (onDeletePost) {
        await onDeletePost(postId)
      } else {
        await axios.delete(`/api/social/posts/${postId}`, {
          params: { user_id: getCurrentUserId() },
        })
      }
      setSuccess('Post removed successfully.')
      onRefresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to remove post.'))
    } finally {
      setDeletingId(null)
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

  const getMediaTypeBadge = (mediaType) => {
    const t = (mediaType || 'text').toLowerCase()
    if (t === 'video' || t === 'reel' || t === 'short') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 tracking-wider">
          <Video className="h-3 w-3" /> VIDEO / REEL
        </span>
      )
    }
    if (t === 'image' || t === 'picture' || t === 'photo') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 tracking-wider">
          <ImageIcon className="h-3 w-3" /> PICTURE / IMAGE
        </span>
      )
    }
    if (t === 'carousel') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 tracking-wider">
          <Layers className="h-3 w-3" /> CAROUSEL
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 tracking-wider">
        <FileText className="h-3 w-3" /> TEXT POST
      </span>
    )
  }

  const getActionBadge = (action) => {
    switch (action) {
      case 'remove_immediately':
        return <span className="rounded-full bg-rose-600 text-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">Remove Immediately</span>
      case 'revise':
        return <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">Revise Copy</span>
      case 'keep':
        return <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">Keep / Approved</span>
      default:
        return null
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
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">Sync Channel:</span>
          {['instagram', 'facebook', 'youtube', 'x', 'linkedin'].map((platform) => {
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
          {posts.length > 0 && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
              title="Clear all posts to start fresh"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              Clear All ({posts.length})
            </button>
          )}

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
            <Plus className="h-4 w-4" /> Import & Audit Post
          </button>
        </div>
      </div>

      {/* Import / Ingest Post Modal */}
      {showAddModal && (
        <div className="surface-panel rounded-2xl p-6 shadow-md border border-emerald-100 bg-emerald-50/30">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Audit Post Across All Formats (Videos, Pictures, Text)</h3>
              <p className="mt-1 text-xs text-slate-500">
                Analyze video transcripts, image visuals & on-screen OCR text, or text captions across any connected social channel with live engagement metrics.
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

          <div className="mt-4 flex gap-2 border-b border-emerald-200/60 pb-3">
            <button
              type="button"
              onClick={() => setImportMode('single')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                importMode === 'single'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Single Post / File Upload
            </button>
            <button
              type="button"
              onClick={() => setImportMode('bulk')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                importMode === 'bulk'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Bulk Import Multiple Links
            </button>
          </div>

          {importMode === 'bulk' ? (
            <form onSubmit={handleBulkImport} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Platform</label>
                <select
                  value={bulkPlatform}
                  onChange={(e) => setBulkPlatform(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="x">X / Twitter</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Paste Post Links (One URL per line)
                </label>
                <p className="text-[11px] text-slate-500 mb-1">
                  Paste links to your reels, pictures, and posts from your social handle. The system retrieves real OpenGraph metadata, media visuals, and runs AI audits on each.
                </p>
                <textarea
                  rows={5}
                  required
                  placeholder={`https://www.instagram.com/p/ABC123/\nhttps://www.instagram.com/reel/XYZ456/\nhttps://www.instagram.com/p/789DEF/`}
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  Import & Audit All Links
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleImportPost} className="mt-4 space-y-4">
            {/* Media Format Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">Select Post Media Format</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setNewPost({ ...newPost, media_type: 'text' })}
                  className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition border ${
                    newPost.media_type === 'text'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="h-4 w-4" /> Text Post
                </button>
                <button
                  type="button"
                  onClick={() => setNewPost({ ...newPost, media_type: 'image' })}
                  className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition border ${
                    newPost.media_type === 'image'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ImageIcon className="h-4 w-4" /> Picture / Image
                </button>
                <button
                  type="button"
                  onClick={() => setNewPost({ ...newPost, media_type: 'video' })}
                  className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition border ${
                    newPost.media_type === 'video'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Video className="h-4 w-4" /> Video / Reel / Short
                </button>
                <button
                  type="button"
                  onClick={() => setNewPost({ ...newPost, media_type: 'carousel' })}
                  className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition border ${
                    newPost.media_type === 'carousel'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="h-4 w-4" /> Carousel
                </button>
              </div>
            </div>

            {/* Media Upload or Direct URL if non-text */}
            {newPost.media_type !== 'text' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white/80 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    {newPost.media_type === 'video' ? 'Upload Video Clip or Provide URL' : 'Upload Image / Visual or Provide URL'}
                  </label>
                  <span className="text-[10px] text-slate-400">Supported: JPG, PNG, WEBP, MP4 (up to 25MB)</span>
                </div>

                {filePreview ? (
                  <div className="relative flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    {filePreview.type === 'video' ? (
                      <video src={filePreview.url} className="h-16 w-24 rounded-lg object-cover" controls={false} />
                    ) : (
                      <img src={filePreview.url} alt="Upload preview" className="h-16 w-16 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-slate-800 truncate">{filePreview.name}</p>
                      <p className="text-[11px] text-emerald-600 font-medium">Ready for AI multimodal visual & OCR claim audit</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      title="Remove media file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-3.5 text-center hover:border-emerald-500 hover:bg-emerald-50/20 transition">
                      <Upload className="h-5 w-5 text-slate-400" />
                      <span className="mt-1 text-xs font-medium text-slate-600">
                        Upload {newPost.media_type === 'video' ? 'Video File' : 'Image File'}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={newPost.media_type === 'video' ? 'video/mp4,video/webm' : 'image/png,image/jpeg,image/webp'}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    <div className="flex flex-col justify-center">
                      <span className="text-[11px] text-slate-500 mb-1 font-medium">Or Direct Media Image / Video URL:</span>
                      <input
                        type="url"
                        placeholder="https://cdn.example.com/media.jpg or .mp4"
                        value={newPost.media_url}
                        onChange={(e) => setNewPost({ ...newPost, media_url: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {newPost.media_type === 'video' && (
                  <div className="pt-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Spoken Video Dialogue / Script (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter spoken script or voiceover dialogue to audit spoken claims, hook ethics, and brand safety..."
                      value={newPost.video_script}
                      onChange={(e) => setNewPost({ ...newPost, video_script: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Platform</label>
                <select
                  value={newPost.platform}
                  onChange={(e) => setNewPost({ ...newPost, platform: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="youtube">YouTube</option>
                  <option value="x">X / Twitter</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Live Post Link / Permalink</label>
                <input
                  type="url"
                  placeholder="https://instagram.com/p/... or https://x.com/..."
                  value={newPost.permalink}
                  onChange={(e) => {
                    const url = e.target.value
                    let detectedPlat = newPost.platform
                    if (url.includes('instagram.com')) detectedPlat = 'instagram'
                    else if (url.includes('twitter.com') || url.includes('x.com')) detectedPlat = 'x'
                    else if (url.includes('youtube.com') || url.includes('youtu.be')) detectedPlat = 'youtube'
                    else if (url.includes('facebook.com')) detectedPlat = 'facebook'
                    else if (url.includes('linkedin.com')) detectedPlat = 'linkedin'
                    setNewPost({ ...newPost, permalink: url, platform: detectedPlat })
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>
            </div>

            {/* Engagement Metrics Inputs */}
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-slate-400" /> Views
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 15000"
                  value={newPost.views}
                  onChange={(e) => setNewPost({ ...newPost, views: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-rose-500" /> Likes
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 850"
                  value={newPost.likes}
                  onChange={(e) => setNewPost({ ...newPost, likes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5 text-blue-500" /> Comments
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 120"
                  value={newPost.comments}
                  onChange={(e) => setNewPost({ ...newPost, comments: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Share2 className="h-3.5 w-3.5 text-emerald-500" /> Shares / Reposts
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 45"
                  value={newPost.shares}
                  onChange={(e) => setNewPost({ ...newPost, shares: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Post Caption / Copy</label>
              <textarea
                required
                rows={3}
                placeholder="Enter post caption or description..."
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
                Run instant AI multimodal audit (Visual, OCR, Video Script, Claims)
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
                  Import & Audit Post
                </button>
              </div>
            </div>
          </form>
          )}
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
              Import and audit your videos, images, or text posts to evaluate visual compliance, on-screen text, false claims, and live metrics.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" /> Import First Post
            </button>
          </div>
        ) : (
          posts.map((post) => {
            const audit = post.audit_result || {}
            const violations = audit.violations || []
            const mediaAudit = audit.media_audit || {}
            const isAudited = post.audit_status === 'audited'
            const metrics = post.metrics || {}
            const pViews = metrics.views || 0
            const pLikes = metrics.likes || 0
            const pComments = metrics.comments || 0
            const pShares = metrics.shares || 0
            const pEngRate = metrics.engagement_rate != null ? metrics.engagement_rate : 0.0

            const isVideoPost =
              (post.media_type || '').toLowerCase() === 'video' ||
              (post.media_url || '').startsWith('data:video/') ||
              /\.(mp4|webm)($|\?)/i.test(post.media_url || '')

            return (
              <div
                key={post.id}
                className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 transition hover:border-slate-200 space-y-4"
              >
                {/* Post Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                      {post.platform}
                    </span>
                    {getMediaTypeBadge(post.media_type)}
                    <span className="text-xs text-slate-400">
                      {new Date(post.published_at).toLocaleString()}
                    </span>
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-slate-700"
                        title="Open live post"
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
                        {getActionBadge(audit.action_recommendation)}
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

                    <button
                      type="button"
                      disabled={deletingId === post.id}
                      onClick={() => handleDelete(post.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Take Down / Delete Post"
                    >
                      {deletingId === post.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Real Engagement Metrics Bar */}
                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50/80 px-3.5 py-2 text-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    <span>{pViews.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-normal">views</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-semibold text-rose-700">
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                    <span>{pLikes.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-normal">likes</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-semibold text-blue-700">
                    <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                    <span>{pComments.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-normal">comments</span>
                  </div>

                  {pShares > 0 && (
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                      <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{pShares.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 font-normal">shares</span>
                    </div>
                  )}

                  <div className="ml-auto flex items-center gap-1.5 font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{pEngRate}%</span>
                    <span className="text-[10px] text-slate-400 font-normal">engagement</span>
                  </div>
                </div>

                {/* Media Creative Preview (if image or video) */}
                {post.media_url && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 max-w-lg">
                    {isVideoPost ? (
                      <video
                        src={post.media_url}
                        controls
                        className="max-h-72 w-full rounded-xl object-contain bg-black"
                      />
                    ) : (
                      <img
                        src={post.media_url}
                        alt="Post media visual"
                        className="max-h-72 w-full rounded-xl object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Post Caption / Content */}
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {post.caption}
                </div>

                {/* Audit Breakdown if Audited */}
                {isAudited && (
                  <div className="space-y-3 pt-1">
                    {/* Action Recommendation Alert if flagged to remove */}
                    {audit.action_recommendation === 'remove_immediately' && (
                      <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-rose-800">
                          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          Recommended Action: Take Down / Remove Post Immediately
                        </p>
                        {audit.removal_reason && (
                          <p className="leading-relaxed pl-5 text-rose-800">{audit.removal_reason}</p>
                        )}
                      </div>
                    )}

                    {/* Media & Visual Compliance Audit Card */}
                    {mediaAudit && mediaAudit.media_type && mediaAudit.media_type !== 'text' && (
                      <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5 text-[11px]">
                              {mediaAudit.media_type === 'video' ? <Video className="h-3.5 w-3.5 text-purple-600" /> : <ImageIcon className="h-3.5 w-3.5 text-sky-600" />}
                              Media Visual & Creative Compliance
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                mediaAudit.visual_compliance === 'compliant'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : mediaAudit.visual_compliance === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {mediaAudit.visual_compliance?.toUpperCase()}
                            </span>
                          </div>
                          {mediaAudit.brand_visual_score != null && (
                            <span className="font-semibold text-purple-950">
                              Visual Brand Score: <strong>{mediaAudit.brand_visual_score}</strong>/100
                            </span>
                          )}
                        </div>

                        {mediaAudit.visual_findings && mediaAudit.visual_findings.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="font-semibold text-slate-700">Visual & Graphic Analysis:</span>
                            <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                              {mediaAudit.visual_findings.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {mediaAudit.ocr_text_detected && (
                          <div className="rounded-lg bg-white/80 p-2 border border-purple-100 text-slate-700">
                            <span className="font-bold text-slate-800">Detected On-Screen / OCR Text: </span>
                            <span className="font-mono text-[11px] text-slate-600">&ldquo;{mediaAudit.ocr_text_detected}&rdquo;</span>
                          </div>
                        )}

                        {mediaAudit.video_transcript_analysis && (
                          <div className="rounded-lg bg-white/80 p-2 border border-purple-100 text-slate-700">
                            <span className="font-bold text-purple-900">Video Narrative & Hook Analysis: </span>
                            <span className="text-slate-700">{mediaAudit.video_transcript_analysis}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Engagement Assessment */}
                    {audit.engagement_assessment && (
                      <p className="text-xs font-medium text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100">
                        📊 <strong>Engagement Assessment:</strong> {audit.engagement_assessment}
                      </p>
                    )}

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
                        <p className="text-slate-800 leading-relaxed font-sans bg-white/80 p-2.5 rounded-lg border border-emerald-100 whitespace-pre-wrap">
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
