import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react'

export default function StrategyRecommendationsPanel({
  strategy,
  loading,
  onRefresh,
  onDeletePost,
}) {
  const [copiedDraftIdx, setCopiedDraftIdx] = useState(null)
  const [copiedHookIdx, setCopiedHookIdx] = useState(null)
  const [copiedReplacementIdx, setCopiedReplacementIdx] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const handleCopyDraft = (idx, text) => {
    navigator.clipboard.writeText(text)
    setCopiedDraftIdx(idx)
    setTimeout(() => setCopiedDraftIdx(null), 2500)
  }

  const handleCopyHook = (idx, text) => {
    navigator.clipboard.writeText(text)
    setCopiedHookIdx(idx)
    setTimeout(() => setCopiedHookIdx(null), 2500)
  }

  const handleCopyReplacement = (idx, text) => {
    navigator.clipboard.writeText(text)
    setCopiedReplacementIdx(idx)
    setTimeout(() => setCopiedReplacementIdx(null), 2500)
  }

  const handleDelete = async (postId) => {
    if (!postId || !onDeletePost) return
    if (!window.confirm('Are you sure you want to take down and delete this post?')) return
    setDeletingId(postId)
    try {
      await onDeletePost(postId)
      onRefresh()
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-500">
        <LoaderCircle className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="font-semibold text-slate-700">Synthesizing Cross-Platform Marketing Strategy & Audit...</p>
        <p className="text-xs text-slate-400 mt-1">
          Analyzing real post engagement (views, likes, comments), identifying winning strategies, and detecting bad marketing to remove
        </p>
      </div>
    )
  }

  if (!strategy) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 text-sm font-semibold text-slate-700">No Strategy Data Available</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Connect your social accounts or import posts to generate a data-backed cross-platform marketing strategy.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <RefreshCw className="h-4 w-4" /> Generate Strategy Now
        </button>
      </div>
    )
  }

  const healthScore = strategy.brand_health_score ?? 85
  const crossOverview = strategy.cross_platform_overview || {}
  const winningStrategies = strategy.winning_strategies || []
  const postsToRemove = strategy.posts_to_remove || []
  const whatToImprove = strategy.what_to_improve || []
  const recommendedPosts = strategy.recommended_posts || []
  const whatToAvoid = strategy.what_to_avoid || []
  const contentPillars = strategy.content_pillars || []
  const trendingHooks = strategy.trending_hooks || []

  return (
    <div className="space-y-6">
      {/* Executive Health & Summary Banner */}
      <div className="surface-panel rounded-3xl p-6 shadow-sm border border-slate-100 bg-gradient-to-r from-emerald-50/50 via-white to-blue-50/30">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">
              <Sparkles className="h-4 w-4" /> Cross-Platform Strategic Assessment
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Brand Positioning & Multi-Platform Growth Engine
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">
              {strategy.summary}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Brand Health</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-3xl font-black ${healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {healthScore}
                </span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-xl bg-slate-100 p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
              title="Refresh strategy analysis"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cross-Platform Unified Analytics Grid */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" /> Combined Cross-Platform Engagement Totals
          </h3>
          <span className="text-[11px] font-semibold text-slate-500">
            Across Instagram, Facebook, YouTube, X, & LinkedIn
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span>Total Views</span>
              <Eye className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-slate-900">
              {(crossOverview.total_views || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Aggregated cross-channel reach</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span>Total Likes</span>
              <Heart className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-rose-600">
              {(crossOverview.total_likes || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Direct positive reactions</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span>Total Comments</span>
              <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-blue-600">
              {(crossOverview.total_comments || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Community conversation velocity</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span>Avg Engagement</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="mt-1 text-xl font-extrabold text-emerald-600">
              {crossOverview.average_engagement_rate ? `${crossOverview.average_engagement_rate}%` : '0.0%'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Engagement rate standard</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span>Top Channel</span>
              <Award className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="mt-1 text-base font-extrabold text-slate-900 uppercase">
              {crossOverview.best_performing_platform || 'None'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Highest engagement velocity</p>
          </div>
        </div>
      </div>

      {/* Bad Marketing / Posts Recommended for Removal Section */}
      {postsToRemove.length > 0 && (
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/50 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-rose-950 text-sm flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" /> Recommended for Immediate Removal (Bad Marketing Detected)
              </h3>
              <p className="mt-0.5 text-xs text-rose-700">
                These posts contain exaggerated claims, deceptive guarantees, or non-compliant marketing that expose the brand to reputation backlash and regulatory sanctions.
              </p>
            </div>
            <span className="rounded-full bg-rose-200 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-900">
              {postsToRemove.length} Bad Posts Flagged
            </span>
          </div>

          <div className="space-y-3">
            {postsToRemove.map((post, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                      {post.platform}
                    </span>
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                      {post.risk_level} Risk
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      Action: {post.recommended_action?.replace('_', ' ') || 'Delete immediately'}
                    </span>
                  </div>

                  {post.post_id && onDeletePost && (
                    <button
                      type="button"
                      disabled={deletingId === post.post_id}
                      onClick={() => handleDelete(post.post_id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition"
                    >
                      {deletingId === post.post_id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Take Down / Delete Post
                    </button>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-800 font-mono">
                  &ldquo;{post.headline_or_preview}&rdquo;
                </div>

                <div className="rounded-xl bg-rose-50/70 p-3 text-xs text-rose-900 space-y-1 border border-rose-100">
                  <p className="font-bold flex items-center gap-1 text-rose-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" /> Why this must be removed:
                  </p>
                  <p className="leading-relaxed pl-4">{post.reason_to_remove}</p>
                </div>

                {post.suggested_replacement && (
                  <div className="rounded-xl bg-emerald-50/60 p-3 text-xs text-emerald-950 space-y-1.5 border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Suggested Safe Replacement Copy:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyReplacement(idx, post.suggested_replacement)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-emerald-800 shadow-sm hover:bg-emerald-100 transition"
                      >
                        {copiedReplacementIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedReplacementIdx === idx ? 'Copied' : 'Copy Replacement'}
                      </button>
                    </div>
                    <p className="text-slate-800 leading-relaxed font-sans bg-white/90 p-2.5 rounded-lg border border-emerald-100 whitespace-pre-wrap">
                      {post.suggested_replacement}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winning Marketing Strategies Section */}
      {winningStrategies.length > 0 && (
        <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" /> Winning Marketing Strategies (What Works & How to Replicate)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Strategies distilled directly from your top-performing, high-engagement posts across channels.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              {winningStrategies.length} Proven Tactics
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {winningStrategies.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm hover:border-emerald-200 transition space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                      {item.platform}
                    </span>
                    {item.metric_signal && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 rounded-full px-2 py-0.5">
                        {item.metric_signal}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">{item.strategy_title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.why_it_worked}</p>
                </div>

                <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 text-xs text-emerald-900 font-medium">
                  <span className="font-bold text-slate-800 block text-[10px] uppercase tracking-wider mb-1">Action to Replicate:</span>
                  {item.action_to_replicate}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: What to Improve & What to Avoid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* What to Improve */}
        <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" /> Key Things to Improve
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Action Plan</span>
          </div>

          <div className="space-y-3">
            {whatToImprove.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{item.area}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                      item.priority === 'high'
                        ? 'bg-rose-100 text-rose-700'
                        : item.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.priority} priority
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">{item.issue}</p>
                <div className="flex items-start gap-1.5 font-medium text-emerald-800 bg-emerald-50/70 rounded-lg p-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{item.actionable_fix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What to Avoid */}
        <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" /> What to Avoid (Risk Traps)
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Compliance Warnings</span>
          </div>

          <div className="space-y-3">
            {whatToAvoid.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>Avoid: &ldquo;{item.topic_or_phrase}&rdquo;</span>
                </div>
                <p className="text-slate-600 leading-relaxed">{item.reason}</p>
                <div className="flex items-start gap-1.5 font-medium text-slate-700 bg-white/80 rounded-lg p-2 border border-rose-100">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span><strong>Safer Angle:</strong> {item.alternative_angle}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended Posts and Blueprints */}
      <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600" /> What Kind of Posts & Content to Publish Next
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Ready-to-use drafted posts across platforms crafted to maximize engagement without false marketing claims.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            {recommendedPosts.length} Ready Blueprints
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {recommendedPosts.map((post, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-emerald-200 transition space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                    {post.platform}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                    {post.post_type.replace('_', ' ')}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-xs">{post.headline}</h4>

                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {post.content_draft}
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Clock className="h-3 w-3 text-slate-400" /> Best Time: {post.best_time_to_post}
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  💡 {post.strategic_reason}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopyDraft(idx, post.content_draft)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-600 hover:text-white transition"
                >
                  {copiedDraftIdx === idx ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedDraftIdx === idx ? 'Copied to Clipboard' : 'Copy Post Draft'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Pillars & Opening Hooks */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Strategic Content Pillars */}
        <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-600" /> Strategic Content Pillars
          </h3>
          <p className="text-xs text-slate-500">Recommended breakdown of post themes to maintain high consumer trust.</p>

          <div className="space-y-3 pt-1">
            {contentPillars.map((pillar, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>{pillar.pillar_name}</span>
                  <span className="text-emerald-700">{pillar.percentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${pillar.percentage}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* High-Trust Viral Opening Hooks */}
        <div className="surface-panel rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" /> High-Trust Opening Hooks
          </h3>
          <p className="text-xs text-slate-500">Hooks designed to spark reader curiosity without resorting to clickbait superlatives.</p>

          <div className="space-y-2.5 pt-1">
            {trendingHooks.map((hook, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-800 hover:border-slate-200 transition"
              >
                <span className="font-medium font-sans">&ldquo;{hook}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => handleCopyHook(idx, hook)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-emerald-600 transition"
                  title="Copy hook"
                >
                  {copiedHookIdx === idx ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
