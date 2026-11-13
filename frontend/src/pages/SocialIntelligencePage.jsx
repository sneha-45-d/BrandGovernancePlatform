import axios from 'axios'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  BrainCircuit,
  Building2,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Edit2,
  Heart,
  LoaderCircle,
  MessageCircleMore,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import PostAuditPanel from '../components/PostAuditPanel'
import StrategyRecommendationsPanel from '../components/StrategyRecommendationsPanel'
import CompetitorComparisonDashboard from '../components/CompetitorComparisonDashboard'
import { getApiErrorMessage } from '../lib/apiError'
import { getCurrentUserId } from '../lib/brandData'

const sections = [
  { id: 'overview', label: 'Overview', path: '/social/overview', icon: Activity },
  { id: 'audit', label: 'Post Audit & Monitor', path: '/social/audit', icon: ShieldAlert },
  { id: 'strategy', label: 'AI Strategy & Advice', path: '/social/strategy', icon: Sparkles },
  { id: 'competitors', label: 'Competitor Intelligence', path: '/social/competitors', icon: Building2 },
  { id: 'mentions', label: 'Brand Mentions', path: '/social/mentions', icon: MessageCircleMore },
  { id: 'sentiment', label: 'Sentiment Analysis', path: '/social/sentiment', icon: BrainCircuit },
  { id: 'alerts', label: 'Intelligent Alerts', path: '/social/alerts', icon: BellRing },
]
const sentimentColors = { Positive: '#10b981', Negative: '#ef4444', Neutral: '#94a3b8' }
const platforms = ['instagram', 'facebook', 'youtube', 'x', 'linkedin', 'manual']
const platformLabels = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  x: 'X',
  linkedin: 'LinkedIn',
  manual: 'User submitted',
}
const sentiments = ['positive', 'negative', 'neutral', 'unanalysed']

function PageTitle({ icon: Icon, eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">
          <Icon className="h-4 w-4" /> {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

function LoadingState({ label }) {
  return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white/60 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin text-emerald-600" />{label}</div>
}

function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`surface-panel rounded-[1.5rem] p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function EmptyState({ icon: Icon = CircleHelp, title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-5 py-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-300" />
      <h3 className="mt-3 text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function MetricCard({ label, value, detail, icon: Icon, tint = 'emerald' }) {
  const tintStyles = {
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className="surface-panel rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tintStyles[tint]}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{detail}</p>
    </div>
  )
}

function sentimentClass(sentiment) {
  if (sentiment === 'positive') return 'bg-emerald-50 text-emerald-700'
  if (sentiment === 'negative') return 'bg-rose-50 text-rose-700'
  if (sentiment === 'neutral') return 'bg-slate-100 text-slate-600'
  return 'bg-amber-50 text-amber-700'
}

function displayDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}

export default function SocialIntelligencePage({ section = 'overview' }) {
  const currentUserParams = useMemo(() => ({ user_id: getCurrentUserId() }), [])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [days, setDays] = useState(30)
  const [rangePreset, setRangePreset] = useState('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [connections, setConnections] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [competitorsLoading, setCompetitorsLoading] = useState(true)
  const [mentions, setMentions] = useState([])
  const [replyDrafts, setReplyDrafts] = useState({})
  const [mentionsLoading, setMentionsLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [auditSummary, setAuditSummary] = useState(null)
  const [strategy, setStrategy] = useState(null)
  const [strategyLoading, setStrategyLoading] = useState(true)
  const [competitorAnalysis, setCompetitorAnalysis] = useState(null)
  const [competitorAnalysisLoading, setCompetitorAnalysisLoading] = useState(true)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [mentionTotal, setMentionTotal] = useState(0)
  const [mentionPage, setMentionPage] = useState(1)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPlatform, setMentionPlatform] = useState('')
  const [mentionSentiment, setMentionSentiment] = useState('')
  const [mentionSort, setMentionSort] = useState('newest')
  const [alertSeverity, setAlertSeverity] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showAddMention, setShowAddMention] = useState(false)
  const [showAddCompetitor, setShowAddCompetitor] = useState(false)
  const [editingCompetitor, setEditingCompetitor] = useState(null)
  const [brandName, setBrandName] = useState('')
  const [monitoringEnabled, setMonitoringEnabled] = useState(false)
  const [keywordsText, setKeywordsText] = useState('')
  const [hashtagsText, setHashtagsText] = useState('')
  const [productsText, setProductsText] = useState('')
  const [mentionForm, setMentionForm] = useState({
    entity_name: '',
    entity_type: 'brand',
    platform: 'manual',
    author: '',
    content: '',
    source_url: '',
    published_at: new Date().toISOString().slice(0, 16),
    likes: '',
    comments: '',
    shares: '',
  })
  const [competitorForm, setCompetitorForm] = useState({ name: '', keywords: '' })
  const overviewParams = useMemo(() => ({
    ...currentUserParams,
    days,
    start_date: rangePreset === 'custom' ? customStart || undefined : undefined,
    end_date: rangePreset === 'custom' ? customEnd || undefined : undefined,
    platform: platformFilter || undefined,
  }), [currentUserParams, customEnd, customStart, days, platformFilter, rangePreset])

  useEffect(() => {
    if (!['overview', 'sentiment', 'competitors'].includes(section)) return undefined
    if (rangePreset === 'custom' && (!customStart || !customEnd)) return undefined
    let active = true
    axios.get('/api/social/overview', {
      params: overviewParams,
    })
      .then(({ data }) => { if (active) setOverview(data) })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Unable to load social intelligence data.')) })
      .finally(() => { if (active) setOverviewLoading(false) })
    return () => { active = false }
  }, [customEnd, customStart, overviewParams, rangePreset, section])

  useEffect(() => {
    if (!['overview', 'mentions', 'sentiment', 'competitors', 'alerts'].includes(section)) return undefined
    let active = true
    axios.get('/api/social/config', { params: currentUserParams })
      .then(({ data }) => {
        if (!active) return
        setConfig(data.config)
        setConnections(data.platforms || [])
        if (data.config) {
          setBrandName(data.config.brand_name || '')
          setMonitoringEnabled(Boolean(data.config.enabled))
          setKeywordsText((data.config.keywords || []).join(', '))
          setHashtagsText((data.config.hashtags || []).join(', '))
          setProductsText((data.config.product_names || []).join(', '))
        }
      })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Unable to load monitoring configuration.')) })
      .finally(() => { if (active) setConfigLoading(false) })
    return () => { active = false }
  }, [currentUserParams, section])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connectionStatus = params.get('social_connection')
    if (!connectionStatus) return
    const platform = params.get('platform') || 'social platform'
    const message = connectionStatus === 'connected'
      ? `${platformLabels[platform] || platform} account connected. Authorized post collection is not enabled until its provider-specific ingestion is configured.`
      : connectionStatus === 'denied'
        ? `${platformLabels[platform] || platform} account connection was cancelled.`
        : `${platformLabels[platform] || platform} account connection did not complete. Check provider permissions and callback configuration.`
    axios.get('/api/social/config', { params: currentUserParams })
      .then(({ data }) => {
        setConnections(data.platforms || [])
        setNotice(message)
      })
      .catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to refresh platform connection status.')))
    window.history.replaceState({}, '', window.location.pathname)
  }, [currentUserParams])

  useEffect(() => {
    if (!['mentions', 'sentiment'].includes(section)) return undefined
    let active = true
    axios.get('/api/social/mentions', {
      params: {
        ...currentUserParams,
        page: mentionPage,
        per_page: 20,
        search: mentionQuery || undefined,
        platform: mentionPlatform || undefined,
        sentiment: section === 'sentiment' ? (mentionSentiment || undefined) : undefined,
      },
    })
      .then(({ data }) => {
        if (!active) return
        setMentions(data.mentions || [])
        setMentionTotal(data.total || 0)
      })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Unable to load brand mentions.')) })
      .finally(() => { if (active) setMentionsLoading(false) })
    return () => { active = false }
  }, [currentUserParams, mentionPage, mentionPlatform, mentionQuery, mentionSentiment, section])

  useEffect(() => {
    if (section !== 'competitors') return undefined
    let active = true
    axios.get('/api/social/competitors', { params: currentUserParams })
      .then(({ data }) => { if (active) setCompetitors(data.competitors || []) })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Unable to load competitors.')) })
      .finally(() => { if (active) setCompetitorsLoading(false) })
    return () => { active = false }
  }, [currentUserParams, section])

  useEffect(() => {
    if (section !== 'alerts') return undefined
    let active = true
    axios.get('/api/social/alerts', {
      params: { ...currentUserParams, severity: alertSeverity || undefined, unread_only: unreadOnly },
    })
      .then(({ data }) => { if (active) setAlerts(data.alerts || []) })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Unable to load alerts.')) })
      .finally(() => { if (active) setAlertsLoading(false) })
    return () => { active = false }
  }, [alertSeverity, currentUserParams, section, unreadOnly])

  const fetchPosts = () => {
    setPostsLoading(true)
    axios.get('/api/social/posts', { params: currentUserParams })
      .then(({ data }) => setPosts(data.posts || []))
      .catch((err) => setError(getApiErrorMessage(err, 'Unable to load posts.')))
      .finally(() => setPostsLoading(false))

    axios.get('/api/social/posts/audit-summary', { params: currentUserParams })
      .then(({ data }) => setAuditSummary(data))
      .catch(() => {})
  }

  const fetchStrategy = () => {
    setStrategyLoading(true)
    axios.get('/api/social/strategy-recommendations', { params: currentUserParams })
      .then(({ data }) => setStrategy(data))
      .catch((err) => setError(getApiErrorMessage(err, 'Unable to load strategy recommendations.')))
      .finally(() => setStrategyLoading(false))
  }

  const fetchCompetitorAnalysis = () => {
    setCompetitorAnalysisLoading(true)
    axios.get('/api/social/competitor-analysis', { params: currentUserParams })
      .then(({ data }) => setCompetitorAnalysis(data))
      .catch((err) => setError(getApiErrorMessage(err, 'Unable to load competitor comparison analysis.')))
      .finally(() => setCompetitorAnalysisLoading(false))
  }

  const handleDeletePost = async (postId) => {
    try {
      await axios.delete(`/api/social/posts/${postId}`, { params: currentUserParams })
      setNotice('Post removed successfully.')
      fetchPosts()
      if (section === 'strategy') fetchStrategy()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to remove post.'))
    }
  }

  useEffect(() => {
    if (['overview', 'audit'].includes(section)) {
      fetchPosts()
    }
  }, [currentUserParams, section])

  useEffect(() => {
    if (section === 'strategy') {
      fetchStrategy()
    }
  }, [currentUserParams, section])

  useEffect(() => {
    if (section === 'competitors') {
      fetchCompetitorAnalysis()
    }
  }, [currentUserParams, section])

  const refreshSection = () => {
    setError('')
    setNotice('')
    if (section === 'overview' || section === 'sentiment' || section === 'competitors') {
      setOverviewLoading(true)
      axios.get('/api/social/overview', {
        params: overviewParams,
      }).then(({ data }) => setOverview(data))
        .catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to refresh social intelligence data.')))
        .finally(() => setOverviewLoading(false))
    }
    if (section === 'overview' || section === 'audit') {
      fetchPosts()
    }
    if (section === 'strategy') {
      fetchStrategy()
    }
    if (section === 'competitors') {
      fetchCompetitorAnalysis()
    }
    if (section === 'mentions' || section === 'sentiment') {
      setMentionsLoading(true)
      axios.get('/api/social/mentions', {
        params: {
          ...currentUserParams,
          page: mentionPage,
          per_page: 20,
          search: mentionQuery || undefined,
          platform: mentionPlatform || undefined,
          sentiment: mentionSentiment || undefined,
        },
      }).then(({ data }) => {
        setMentions(data.mentions || [])
        setMentionTotal(data.total || 0)
      }).catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to refresh mentions.')))
        .finally(() => setMentionsLoading(false))
    }
    if (section === 'alerts') {
      setAlertsLoading(true)
      axios.get('/api/social/alerts', {
        params: { ...currentUserParams, severity: alertSeverity || undefined, unread_only: unreadOnly },
      }).then(({ data }) => setAlerts(data.alerts || []))
        .catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to refresh alerts.')))
        .finally(() => setAlertsLoading(false))
    }
  }

  const saveCompetitorDirect = async (form) => {
    setWorking(true)
    setError('')
    try {
      const payload = {
        user_id: getCurrentUserId(),
        name: form.name,
        keywords: form.keywords.split(',').map((item) => item.trim()).filter(Boolean),
      }
      await axios.post('/api/social/competitors', payload)
      const { data } = await axios.get('/api/social/competitors', { params: currentUserParams })
      setCompetitors(data.competitors || [])
      fetchCompetitorAnalysis()
      setNotice('Competitor added and benchmarked!')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to add competitor.'))
    } finally {
      setWorking(false)
    }
  }

  const updateCompetitorDirect = async (id, form) => {
    setWorking(true)
    setError('')
    try {
      const payload = {
        user_id: getCurrentUserId(),
        name: form.name,
        keywords: form.keywords.split(',').map((item) => item.trim()).filter(Boolean),
      }
      await axios.put(`/api/social/competitors/${id}`, payload)
      const { data } = await axios.get('/api/social/competitors', { params: currentUserParams })
      setCompetitors(data.competitors || [])
      fetchCompetitorAnalysis()
      setNotice('Competitor updated!')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update competitor.'))
    } finally {
      setWorking(false)
    }
  }

  const saveConfig = async (event) => {
    event.preventDefault()
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const { data } = await axios.put('/api/social/config', {
        ...currentUserParams,
        brand_name: brandName,
        keywords: keywordsText.split(',').map((item) => item.trim()).filter(Boolean),
        hashtags: hashtagsText.split(',').map((item) => item.trim()).filter(Boolean),
        product_names: productsText.split(',').map((item) => item.trim()).filter(Boolean),
        enabled: monitoringEnabled,
      })
      setConfig(data.config)
      setShowConfig(false)
      setNotice('Monitoring configuration saved.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to save monitoring configuration.'))
    } finally {
      setWorking(false)
    }
  }

  const addMention = async (event) => {
    event.preventDefault()
    setWorking(true)
    setError('')
    setNotice('')
    const engagement = Object.fromEntries(
      ['likes', 'comments', 'shares']
        .filter((key) => mentionForm[key] !== '')
        .map((key) => [key, Number(mentionForm[key])]),
    )
    try {
      await axios.post('/api/social/mentions', {
        ...currentUserParams,
        entity_name: mentionForm.entity_name || (mentionForm.entity_type === 'brand' ? (config?.brand_name || brandName) : ''),
        entity_type: mentionForm.entity_type,
        platform: mentionForm.platform,
        author: mentionForm.author,
        content: mentionForm.content,
        source_url: mentionForm.source_url,
        published_at: new Date(mentionForm.published_at).toISOString(),
        engagement,
        collection_source: 'user_submitted',
      })
      setShowAddMention(false)
      setMentionForm((form) => ({ ...form, author: '', content: '', source_url: '', likes: '', comments: '', shares: '' }))
      setNotice('Mention saved as user-submitted data.')
      refreshSection()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to save this mention.'))
    } finally {
      setWorking(false)
    }
  }

  const analyzeMention = async (mentionId) => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      await axios.post(`/api/social/mentions/${mentionId}/analyze`, null, { params: currentUserParams })
      setNotice('Gemini sentiment analysis completed and saved.')
      refreshSection()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Sentiment analysis failed.'))
    } finally {
      setWorking(false)
    }
  }

  const generateReplyOptions = async (mentionId) => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const { data } = await axios.post(
        `/api/social/mentions/${mentionId}/reply-drafts`,
        null,
        { params: currentUserParams },
      )
      setReplyDrafts((existing) => ({ ...existing, [mentionId]: data.draft_set }))
      setNotice(data.message)
      refreshSection()
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to generate reply drafts.'))
    } finally {
      setWorking(false)
    }
  }

  const saveCompetitor = async (event) => {
    event.preventDefault()
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        ...currentUserParams,
        name: competitorForm.name,
        keywords: competitorForm.keywords.split(',').map((item) => item.trim()).filter(Boolean),
      }
      if (editingCompetitor) {
        await axios.put(`/api/social/competitors/${editingCompetitor.id}`, payload)
      } else {
        await axios.post('/api/social/competitors', payload)
      }
      const { data } = await axios.get('/api/social/competitors', { params: currentUserParams })
      setCompetitors(data.competitors || [])
      setCompetitorForm({ name: '', keywords: '' })
      setShowAddCompetitor(false)
      setNotice(editingCompetitor ? 'Competitor profile updated.' : 'Competitor profile saved. No external competitor posts are collected until an authorized integration is connected.')
      setEditingCompetitor(null)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to save competitor profile.'))
    } finally {
      setWorking(false)
    }
  }

  const deleteCompetitor = async (competitorId) => {
    setWorking(true)
    setError('')
    try {
      await axios.delete(`/api/social/competitors/${competitorId}`, { params: currentUserParams })
      setCompetitors((items) => items.filter((item) => item.id !== competitorId))
      setNotice('Competitor profile removed.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to remove competitor.'))
    } finally {
      setWorking(false)
    }
  }

  const updateAlert = async (alertId, read) => {
    setWorking(true)
    setError('')
    try {
      await axios.patch(`/api/social/alerts/${alertId}`, { read }, { params: currentUserParams })
      setAlerts((items) => items.map((item) => (item.id === alertId ? { ...item, read } : item)))
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to update alert.'))
    } finally {
      setWorking(false)
    }
  }

  const connectPlatform = async (platform, profileUrl = '') => {
    setWorking(true)
    setError('')
    try {
      if (profileUrl && profileUrl.trim()) {
        const { data } = await axios.post(`/api/social/integrations/${platform}/connect`, {
          profile_url: profileUrl.trim()
        })
        setNotice(data.message || `Connected ${platform} brand account successfully.`)
        try {
          const { data: configData } = await axios.get('/api/social/config', { params: currentUserParams })
          setConnections(configData.platforms || [])
        } catch (_) {}
        fetchPosts()
        fetchOverview()
      } else {
        const { data } = await axios.get(`/api/social/integrations/${platform}/connect`)
        if (data.status === 'connected') {
          setNotice(data.message || `Connected ${platform} brand account successfully.`)
          try {
            const { data: configData } = await axios.get('/api/social/config', { params: currentUserParams })
            setConnections(configData.platforms || [])
          } catch (_) {}
          try {
            await axios.post(`/api/social/integrations/${platform}/sync`)
          } catch (_) {}
          fetchPosts()
          fetchOverview()
        } else if (data.authorization_url) {
          window.location.assign(data.authorization_url)
        }
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to connect platform account.'))
    } finally {
      setWorking(false)
    }
  }

  const disconnectPlatform = async (platform) => {
    setWorking(true)
    setError('')
    try {
      await axios.delete(`/api/social/integrations/${platform}`, { params: currentUserParams })
      setConnections((items) => items.map((item) => item.platform === platform
        ? { ...item, status: item.oauth_available ? 'not_connected' : 'configuration_required', account_name: '' }
        : item))
      setNotice('Stored credentials were removed. Revoke the grant from your social account settings to invalidate provider access.')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to disconnect platform.'))
    } finally {
      setWorking(false)
    }
  }

  const sortedMentions = useMemo(() => [...mentions].sort((a, b) => {
    const difference = new Date(a.published_at) - new Date(b.published_at)
    return mentionSort === 'oldest' ? difference : -difference
  }), [mentionSort, mentions])

  const metrics = overview?.overview
  const aiAnalyzedMentions = mentions.filter((mention) => mention.sentiment_data?.topic)
  const recurringConcerns = useMemo(() => {
    const counts = new Map()
    for (const mention of mentions) {
      const analysis = mention.sentiment_data || {}
      if (mention.sentiment !== 'negative' || !analysis.topic) continue
      const key = analysis.topic.toLowerCase()
      const current = counts.get(key) || { topic: analysis.topic, count: 0, examples: [] }
      current.count += 1
      if (current.examples.length < 2) current.examples.push(analysis.customer_signal || analysis.explanation)
      counts.set(key, current)
    }
    return [...counts.values()].filter((item) => item.count > 1).sort((a, b) => b.count - a.count)
  }, [mentions])
  const handleRangeChange = (value) => {
    setRangePreset(value)
    setOverviewLoading(true)
    if (value !== 'custom') {
      setDays(Number(value))
      return
    }
    const end = new Date()
    const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000)
    setCustomStart(start.toISOString().slice(0, 10))
    setCustomEnd(end.toISOString().slice(0, 10))
  }

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-6">
        <Sidebar />
        <main className="min-w-0">
          <div className="surface-panel mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto">
              {sections.map(({ id, label, path, icon: Icon }) => (
                <Link
                  key={id}
                  to={path}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    section === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Link>
              ))}
            </div>
            <button type="button" onClick={refreshSection} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {(error || notice) && (
            <div role={error ? 'alert' : 'status'} className={`mb-5 flex items-start gap-2 rounded-xl border p-3 text-sm ${
              error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}>
              {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{error || notice}</span>
              <button type="button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }} className="ml-auto"><X className="h-4 w-4" /></button>
            </div>
          )}

          {section === 'overview' && (
            <>
              <PageTitle
                icon={Radio}
                eyebrow="Social Media Intelligence"
                title="Brand listening overview"
                description="A data-backed view of mentions and customer sentiment collected for your account."
                action={
                  <div className="flex gap-2">
                    <select aria-label="Overview period" value={rangePreset} onChange={(event) => handleRangeChange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom range</option>
                    </select>
                    <select aria-label="Filter by platform" value={platformFilter} onChange={(event) => { setOverviewLoading(true); setPlatformFilter(event.target.value) }} className="max-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <option value="">All platforms</option>{platforms.map((item) => <option key={item} value={item}>{platformLabels[item]}</option>)}
                    </select>
                  </div>
                }
              />
              {rangePreset === 'custom' && (
                <div className="mb-4 flex flex-wrap items-end gap-3">
                  <label className="text-xs text-slate-500">From<input type="date" value={customStart} onChange={(event) => { setOverviewLoading(true); setCustomStart(event.target.value) }} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                  <label className="text-xs text-slate-500">To<input type="date" value={customEnd} onChange={(event) => { setOverviewLoading(true); setCustomEnd(event.target.value) }} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                </div>
              )}
              <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total brand mentions" value={metrics?.total_mentions ?? '—'} detail="Saved records in the selected period" icon={MessageCircleMore} />
                <MetricCard label="Positive mentions" value={metrics?.positive_mentions ?? '—'} detail="AI-classified positive" icon={ThumbsUp} />
                <MetricCard label="Negative mentions" value={metrics?.negative_mentions ?? '—'} detail="AI-classified negative" icon={ThumbsDown} tint="rose" />
                <MetricCard label="Post Safety Score" value={auditSummary?.average_safety_score != null ? `${auditSummary.average_safety_score}/100` : '100/100'} detail={`${auditSummary?.critical_count ?? 0} critical false claims flagged`} icon={ShieldCheck} tint={auditSummary?.average_safety_score < 70 ? 'rose' : 'emerald'} />
                <MetricCard label="Monitored Brand Posts" value={auditSummary?.total_posts ?? 0} detail={`${auditSummary?.audited_count ?? 0} audited posts across channels`} icon={Sparkles} tint="blue" />
                <MetricCard label="Neutral mentions" value={metrics?.neutral_mentions ?? '—'} detail="AI-classified neutral" icon={Activity} tint="slate" />
                <MetricCard label="Total engagement" value={metrics?.total_engagement?.toLocaleString() ?? '—'} detail="Sum of user-submitted likes, comments, and shares" icon={Heart} tint="blue" />
                <MetricCard label="Reputation score" value={metrics?.reputation_score == null ? '—' : `${metrics.reputation_score}%`} detail="Positive share of AI-classified mentions" icon={ShieldAlert} tint="amber" />
              </div>

              {overview?.cross_platform_overview && overview.cross_platform_overview.total_analyzed_posts > 0 && (
                <div className="mb-5 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-white to-blue-50/40 p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" /> Combined Cross-Platform Engagement Summary
                    </h3>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 rounded-full px-2.5 py-0.5">
                      {overview.cross_platform_overview.total_analyzed_posts} Total Posts Monitored
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-500">Cross-Platform Views</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">{(overview.cross_platform_overview.total_views || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Combined audience reach</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-500">Total Likes</p>
                      <p className="text-xl font-bold text-rose-600 mt-1">{(overview.cross_platform_overview.total_likes || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Audience reactions</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-500">Total Comments</p>
                      <p className="text-xl font-bold text-blue-600 mt-1">{(overview.cross_platform_overview.total_comments || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Community discussions</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-500">Avg Engagement Rate</p>
                      <p className="text-xl font-bold text-emerald-600 mt-1">{overview.cross_platform_overview.average_engagement_rate ? `${overview.cross_platform_overview.average_engagement_rate}%` : '0.0%'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Interaction percentage</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-500">Top Performing Channel</p>
                      <p className="text-lg font-bold text-slate-900 uppercase mt-1">{overview.cross_platform_overview.best_performing_platform || 'None'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Highest engagement velocity</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-5 flex flex-wrap gap-2.5">
                <Link to="/social/audit" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">
                  <ShieldAlert className="h-4 w-4 text-emerald-400" /> Open Post Audit & False Marketing Monitor &rarr;
                </Link>
                <Link to="/social/strategy" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition">
                  <Sparkles className="h-4 w-4 text-emerald-600" /> AI Strategy Recommendations & Blueprints &rarr;
                </Link>
                <Link to="/social/competitors" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition">
                  <Building2 className="h-4 w-4 text-sky-600" /> Competitor Comparison Dashboard &rarr;
                </Link>
              </div>

              {overview?.data_note && <p className="mb-4 text-xs text-slate-500">{overview.data_note}</p>}

              <div className="mb-5 grid gap-5 xl:grid-cols-2">
                <Panel title="Sentiment distribution" description="Only AI-analyzed records are included.">
                  {overviewLoading ? <LoadingState label="Loading sentiment data…" /> : (overview?.sentiment_distribution || []).some((item) => item.value > 0) ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overview.sentiment_distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
                            {overview.sentiment_distribution.map((item) => <Cell key={item.name} fill={sentimentColors[item.name]} />)}
                          </Pie>
                          <Tooltip /><Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState title="No analyzed mentions yet" description="Add a mention, then run Gemini sentiment analysis to populate this chart." action={<Link className="text-xs font-semibold text-emerald-700" to="/social/mentions">Review mentions</Link>} />}
                </Panel>
                <Panel title="Brand mentions over time" description={`Saved mentions · ${overview?.start_date || ''} to ${overview?.end_date || ''}`}>
                  {overviewLoading ? <LoadingState label="Loading mention trend…" /> : (overview?.mention_trend || []).some((item) => item.mentions > 0) ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={overview.mention_trend}>
                          <defs><linearGradient id="mentionsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip />
                          <Area type="monotone" dataKey="mentions" stroke="#059669" fill="url(#mentionsGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState title="No mentions in this period" description="The chart will reflect saved mentions; no sample series are displayed." />}
                </Panel>
                <Panel title="Mentions by platform" description="Grouped by the source recorded with each mention.">
                  {overviewLoading ? <LoadingState label="Loading platform data…" /> : (overview?.platform_mentions || []).length ? (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overview.platform_mentions} margin={{ bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="platform" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip /><Bar dataKey="mentions" name="Mentions" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState title="No platform data" description="Saved platform values will appear here." />}
                </Panel>
                <Panel title="Positive vs negative trend" description="Sentiment trends use Gemini analyses saved to mentions.">
                  {overviewLoading ? <LoadingState label="Loading sentiment trend…" /> : (overview?.mention_trend || []).some((item) => item.positive + item.negative > 0) ? (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={overview.mention_trend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Legend />
                          <Area type="monotone" dataKey="positive" stroke="#10b981" fill="#10b981" fillOpacity={0.14} />
                          <Area type="monotone" dataKey="negative" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState title="No sentiment trend yet" description="Run sentiment analysis on saved mentions to see positive and negative trends." />}
                </Panel>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="Recent mentions" action={<Link to="/social/mentions" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">All mentions <ArrowUpRight className="h-3.5 w-3.5" /></Link>}>
                  {overviewLoading ? <LoadingState label="Loading recent mentions…" /> : (overview?.recent_mentions || []).length ? (
                    <div className="space-y-3">
                      {overview.recent_mentions.slice(0, 5).map((mention) => (
                        <MentionSummary key={mention.id} mention={mention} />
                      ))}
                    </div>
                  ) : <EmptyState title="Nothing collected yet" description="Configure your brand, then submit authorized or user-provided mentions. No sample data is shown." action={<Link className="text-xs font-semibold text-emerald-700" to="/social/mentions">Configure monitoring</Link>} />}
                </Panel>
                <Panel title="Latest analyzed topics" description="Topics are derived from saved Gemini mention analyses.">
                  {overviewLoading ? <LoadingState label="Loading analyzed topics…" /> : (overview?.insights || []).length ? (
                    <div className="space-y-3">
                      {overview.insights.map((item) => (
                        <div key={item.topic} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                          <span className="text-sm font-medium text-slate-700">{item.topic}</span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500">{item.mentions} mention{item.mentions === 1 ? '' : 's'}</span>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon={Sparkles} title="Insights will appear after analysis" description="This area summarizes topics actually extracted by Gemini; it does not invent brand trends." />}
                </Panel>
              </div>
              <Panel className="mt-5" title="Platform connections" description="Credentials do not grant access on their own; OAuth and platform permissions are required.">
                <ConnectionList connections={connections} onConnect={connectPlatform} onDisconnect={disconnectPlatform} working={working} />
              </Panel>
            </>
          )}

          {section === 'audit' && (
            <>
              <PageTitle
                icon={ShieldAlert}
                eyebrow="Compliance & Brand Safety"
                title="Post Monitor & Content Audit"
                description="Detect and eliminate false marketing, deceptive guarantees, regulatory non-compliance, and identity-harming posts before or after publication."
              />
              <PostAuditPanel
                posts={posts}
                postsLoading={postsLoading}
                auditSummary={auditSummary}
                onRefresh={fetchPosts}
                onDeletePost={handleDeletePost}
                connections={connections}
              />
            </>
          )}

          {section === 'strategy' && (
            <>
              <PageTitle
                icon={Sparkles}
                eyebrow="AI Brand Growth & Tactics"
                title="Social Media Strategy & Advice"
                description="AI-generated post recommendations, actionable improvements, things to avoid, and content pillars customized to your audience sentiment."
              />
              <StrategyRecommendationsPanel
                strategy={strategy}
                loading={strategyLoading}
                onRefresh={fetchStrategy}
                onDeletePost={handleDeletePost}
              />
            </>
          )}

          {section === 'mentions' && (
            <>
              <PageTitle icon={MessageCircleMore} eyebrow="Listening workspace" title="Brand mentions" description="Maintain monitoring terms and inspect each saved mention with its collection source." action={<button type="button" onClick={() => setShowAddMention((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus className="h-4 w-4" /> Add mention</button>} />
              <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <Panel title="Monitoring profile" description={config?.enabled ? 'Monitoring terms are saved. Collection still requires an authorized source.' : 'Set your brand and tracking terms. Saving a profile does not connect social platforms.'} action={<button type="button" onClick={() => setShowConfig((value) => !value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"><Settings2 className="mr-1 inline h-3.5 w-3.5" /> {config ? 'Edit' : 'Configure'}</button>}>
                  {configLoading ? <LoadingState label="Loading monitoring profile…" /> : showConfig || !config ? (
                    <form onSubmit={saveConfig} className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-slate-600 sm:col-span-2">Brand name<input required maxLength={120} value={brandName} onChange={(event) => setBrandName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Your brand" /></label>
                      <TermField label="Keywords" value={keywordsText} onChange={setKeywordsText} placeholder="brand name, common spelling" />
                      <TermField label="Hashtags" value={hashtagsText} onChange={setHashtagsText} placeholder="#YourBrand, #Campaign" />
                      <TermField label="Product names" value={productsText} onChange={setProductsText} placeholder="Product One, Service Plus" />
                      <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={monitoringEnabled} onChange={(event) => setMonitoringEnabled(event.target.checked)} className="h-4 w-4 accent-emerald-600" /> Enable monitoring configuration</label>
                        <button disabled={working} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{working ? 'Saving…' : 'Save monitoring profile'}</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{config.brand_name}</span>
                      {[...(config.keywords || []), ...(config.hashtags || []), ...(config.product_names || [])].map((term) => <span key={term} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{term}</span>)}
                    </div>
                  )}
                </Panel>
                <Panel title="Connected sources" description="Only authorized provider results are labeled API-collected.">
                  <ConnectionList connections={connections} compact onConnect={connectPlatform} onDisconnect={disconnectPlatform} working={working} />
                </Panel>
              </div>

              {showAddMention && (
                <Panel className="mb-5" title="Add a mention record" description="Manual entries are labeled user-submitted and are not represented as platform-collected posts.">
                  <form onSubmit={addMention} className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">About<input required maxLength={120} value={mentionForm.entity_name || (mentionForm.entity_type === 'brand' ? (config?.brand_name || brandName) : '')} onChange={(event) => setMentionForm({ ...mentionForm, entity_name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Brand or registered competitor" /></label>
                    <label className="text-xs font-medium text-slate-600">Entity type<select value={mentionForm.entity_type} onChange={(event) => setMentionForm({ ...mentionForm, entity_type: event.target.value, entity_name: event.target.value === 'brand' ? (config?.brand_name || brandName) : '' })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="brand">My brand</option><option value="competitor">Registered competitor</option></select></label>
                    <label className="text-xs font-medium text-slate-600">Source platform<select value={mentionForm.platform} onChange={(event) => setMentionForm({ ...mentionForm, platform: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">{platforms.map((item) => <option key={item} value={item}>{platformLabels[item]}</option>)}</select></label>
                    <label className="text-xs font-medium text-slate-600">Author / account<input maxLength={160} value={mentionForm.author} onChange={(event) => setMentionForm({ ...mentionForm, author: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Optional" /></label>
                    <label className="text-xs font-medium text-slate-600 md:col-span-2">Mention content<textarea required maxLength={10_000} rows={3} value={mentionForm.content} onChange={(event) => setMentionForm({ ...mentionForm, content: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Paste content you are authorized to analyze" /></label>
                    <label className="text-xs font-medium text-slate-600">Published at<input required type="datetime-local" value={mentionForm.published_at} onChange={(event) => setMentionForm({ ...mentionForm, published_at: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-600">Source link<input type="url" maxLength={2048} value={mentionForm.source_url} onChange={(event) => setMentionForm({ ...mentionForm, source_url: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Optional https://…" /></label>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      {['likes', 'comments', 'shares'].map((key) => <label key={key} className="text-xs text-slate-500">{key}<input type="number" min="0" value={mentionForm[key]} onChange={(event) => setMentionForm({ ...mentionForm, [key]: event.target.value })} className="ml-2 w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5" /></label>)}
                      <div className="ml-auto flex gap-2"><button type="button" onClick={() => setShowAddMention(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button><button disabled={working} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Send className="mr-1 inline h-4 w-4" /> Save mention</button></div>
                    </div>
                  </form>
                </Panel>
              )}

              <Panel title="Saved mention records" description={`${mentionTotal} result${mentionTotal === 1 ? '' : 's'} · data source and publication details are shown per record.`} action={<div className="flex flex-wrap gap-2">
                <label className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" /><input value={mentionQuery} onChange={(event) => { setMentionsLoading(true); setMentionPage(1); setMentionQuery(event.target.value) }} placeholder="Search mentions" className="w-40 rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs" /></label>
                <select aria-label="Filter mentions by platform" value={mentionPlatform} onChange={(event) => { setMentionsLoading(true); setMentionPage(1); setMentionPlatform(event.target.value) }} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="">All platforms</option>{platforms.map((item) => <option key={item} value={item}>{platformLabels[item]}</option>)}</select>
                <select aria-label="Sort mentions" value={mentionSort} onChange={(event) => setMentionSort(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
              </div>}>
                {mentionsLoading ? <LoadingState label="Loading mention records…" /> : sortedMentions.length ? (
                  <div className="space-y-3">
                    {sortedMentions.map((mention) => <MentionCard key={mention.id} mention={mention} onAnalyze={analyzeMention} onGenerateReplies={generateReplyOptions} onError={setError} replyDrafts={replyDrafts[mention.id]} working={working} />)}
                    <Pagination page={mentionPage} total={mentionTotal} onChange={setMentionPage} />
                  </div>
                ) : <EmptyState icon={MessageCircleMore} title="No mentions match these filters" description={mentionTotal ? 'Adjust the search or filters to see matching records.' : 'Add a user-submitted record or connect an official integration. The app will not fill this table with demo posts.'} action={!mentionTotal && <button type="button" onClick={() => setShowAddMention(true)} className="text-xs font-semibold text-emerald-700">Add a mention</button>} />}
              </Panel>
            </>
          )}

          {section === 'sentiment' && (
            <>
              <PageTitle icon={BrainCircuit} eyebrow="Gemini-powered analysis" title="Sentiment analysis" description="Understand sentiment and recurring customer signals from saved mentions. Analysis is only available when your backend Gemini key is configured." />
              <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="AI analyzed" value={((metrics?.positive_mentions || 0) + (metrics?.negative_mentions || 0) + (metrics?.neutral_mentions || 0))} detail="Saved sentiment classifications" icon={BrainCircuit} />
                <MetricCard label="Positive" value={metrics?.positive_mentions ?? 0} detail="Appreciation identified by Gemini" icon={ThumbsUp} />
                <MetricCard label="Negative" value={metrics?.negative_mentions ?? 0} detail="Concerns identified by Gemini" icon={ThumbsDown} tint="rose" />
                <MetricCard label="Awaiting analysis" value={metrics?.unanalysed_mentions ?? 0} detail="Saved mentions not yet classified" icon={Activity} tint="amber" />
              </div>
              <div className="mb-5 grid gap-5 xl:grid-cols-2">
                <Panel title="Recurring customer concerns" description="Grouped by the Gemini topic returned for negative mentions.">
                  {mentionsLoading ? <LoadingState label="Loading customer concerns…" /> : recurringConcerns.length ? <div className="space-y-3">{recurringConcerns.map((item) => <div key={item.topic} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">{item.topic}</p><span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">{item.count} mentions</span></div>{item.examples.map((example) => <p key={example} className="mt-2 text-xs text-slate-600">{example}</p>)}</div>)}</div> : <EmptyState icon={ThumbsDown} title="No repeated concern found" description="This is based on available analyzed negative mentions; more data may be needed." /> }
                </Panel>
                <Panel title="Insights and recommended actions" description="These summaries reflect saved AI analysis, not an external listening feed.">
                  {mentionsLoading ? <LoadingState label="Loading AI insights…" /> : aiAnalyzedMentions.length ? <div className="space-y-3">{aiAnalyzedMentions.slice(0, 6).map((mention) => <div key={mention.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-800">{mention.sentiment_data.topic} <span className={`ml-1 rounded-full px-2 py-0.5 ${sentimentClass(mention.sentiment)}`}>{mention.sentiment}</span></p><p className="mt-1 text-xs text-slate-600">{mention.sentiment_data.explanation}</p><p className="mt-2 text-xs font-medium text-emerald-800">Suggested action: {mention.sentiment_data.suggested_action}</p></div>)}</div> : <EmptyState icon={Sparkles} title="No AI insights available" description="Analyze saved mentions with Gemini to generate explainable insights and response suggestions." /> }
                </Panel>
              </div>
              <Panel title="Mentions available for analysis" description="Gemini responses are schema-validated before they are stored.">
                <div className="mb-4 flex flex-wrap gap-2"><select aria-label="Filter sentiment mentions" value={mentionSentiment} onChange={(event) => { setMentionsLoading(true); setMentionPage(1); setMentionSentiment(event.target.value) }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="">All analysis states</option>{sentiments.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Filter sentiment by platform" value={mentionPlatform} onChange={(event) => { setMentionsLoading(true); setMentionPage(1); setMentionPlatform(event.target.value) }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="">All platforms</option>{platforms.map((item) => <option key={item} value={item}>{platformLabels[item]}</option>)}</select></div>
                {mentionsLoading ? <LoadingState label="Loading mentions…" /> : mentions.length ? <div className="space-y-3">{mentions.map((mention) => <MentionCard key={mention.id} mention={mention} onAnalyze={analyzeMention} onGenerateReplies={generateReplyOptions} onError={setError} replyDrafts={replyDrafts[mention.id]} working={working} />)}<Pagination page={mentionPage} total={mentionTotal} onChange={setMentionPage} /></div> : <EmptyState title="No mentions to analyze" description="Add an authorized or user-submitted mention in Brand Mentions first." action={<Link className="text-xs font-semibold text-emerald-700" to="/social/mentions">Open Brand Mentions</Link>} />}
              </Panel>
            </>
          )}

          {section === 'competitors' && (
            <CompetitorComparisonDashboard
              comparisonData={competitorAnalysis}
              loading={competitorAnalysisLoading}
              competitors={competitors}
              competitorsLoading={competitorsLoading}
              onRefresh={fetchCompetitorAnalysis}
              onAddCompetitor={saveCompetitorDirect}
              onEditCompetitor={updateCompetitorDirect}
              onDeleteCompetitor={deleteCompetitor}
              working={working}
            />
          )}

          {section === 'alerts' && (
            <>
              <PageTitle icon={BellRing} eyebrow="Reputation watch" title="Intelligent alerts" description="Alerts are created from saved mention data and transparent thresholds. No background platform polling is active until official connections are implemented." action={<div className="flex gap-2"><select aria-label="Filter alerts by severity" value={alertSeverity} onChange={(event) => { setAlertsLoading(true); setAlertSeverity(event.target.value) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Filter read alerts" value={unreadOnly ? 'unread' : 'all'} onChange={(event) => { setAlertsLoading(true); setUnreadOnly(event.target.value === 'unread') }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="all">Read and unread</option><option value="unread">Unread only</option></select></div>} />
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Open alerts" value={alerts.filter((item) => !item.read).length} detail="Unread alerts in the current result set" icon={BellRing} tint="amber" />
                <MetricCard label="High severity" value={alerts.filter((item) => item.severity === 'high' || item.severity === 'critical').length} detail="Requires prompt review" icon={ShieldAlert} tint="rose" />
                <MetricCard label="Detection mode" value="On ingest" detail="Thresholds run when mention records are saved" icon={Activity} tint="blue" />
              </div>
              <Panel title="Alert feed" description="Threshold rules use saved mentions; scheduled polling and external delivery are not enabled.">
                {alertsLoading ? <LoadingState label="Loading alerts…" /> : alerts.length ? <div className="space-y-3">{alerts.map((alert) => <article key={alert.id} className={`rounded-2xl border p-4 ${alert.read ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/40'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div className={`rounded-xl p-2 ${alert.severity === 'critical' || alert.severity === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{alert.severity === 'critical' || alert.severity === 'high' ? <AlertTriangle className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-900">{alert.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${alert.severity === 'critical' || alert.severity === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{alert.severity}</span><span className="text-xs text-slate-400">{platformLabels[alert.platform] || alert.platform}</span></div><p className="mt-2 text-sm text-slate-700">{alert.description}</p><p className="mt-2 text-xs text-emerald-800"><strong>Suggested action:</strong> {alert.recommended_action}</p><p className="mt-2 text-[11px] text-slate-400">{displayDate(alert.detected_at)}</p></div><button type="button" disabled={working} onClick={() => updateAlert(alert.id, !alert.read)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:text-emerald-700">{alert.read ? <RefreshCw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{alert.read ? 'Mark unread' : 'Mark read'}</button></div></article>)}</div> : <EmptyState icon={BellRing} title="No alerts to show" description="Alerts appear when saved data meets a documented threshold, such as a mention-volume spike or repeated negative topic. No sample alerts are generated." />}
              </Panel>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function TermField({ label, value, onChange, placeholder }) {
  return <label className="text-xs font-medium text-slate-600">{label}<input maxLength={2000} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder={placeholder} /><span className="mt-1 block font-normal text-slate-400">Separate terms with commas.</span></label>
}

function ConnectionList({ connections = [], compact = false, onConnect, onDisconnect, working = false }) {
  const [profileUrls, setProfileUrls] = useState({})

  if (!connections.length) return <p className="text-xs text-slate-500">Loading provider status…</p>
  return (
    <div className={compact ? 'space-y-2' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>
      {connections.map((connection) => (
        <div key={connection.platform} className="rounded-xl border border-slate-100 bg-white/70 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">{connection.name}</p>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
              connection.status === 'connected'
                ? 'bg-emerald-50 text-emerald-700'
                : connection.status === 'reauth_required'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-amber-50 text-amber-700'
            }`}>
              {connection.status === 'connected'
                ? `Connected${connection.account_name ? ` · ${connection.account_name}` : ''}`
                : connection.status === 'reauth_required'
                  ? 'Reconnect required'
                  : connection.status === 'not_connected' ? 'Not connected' : 'Setup required'}
            </span>
          </div>
          {!compact && <p className="mt-1 text-xs leading-5 text-slate-500">{connection.setup_requirements}</p>}
          <p className="mt-1 text-[10px] text-slate-400">
            {connection.status === 'connected'
              ? `Posts from ${connection.account_name || 'this account'} are synced and ready for audit.`
              : 'Paste your profile URL or @handle to connect and sync posts.'}
          </p>

          <div className="mt-2.5">
            {connection.status !== 'connected' ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder={`https://${connection.platform}.com/handle or @handle`}
                  value={profileUrls[connection.platform] || ''}
                  onChange={(e) => setProfileUrls({ ...profileUrls, [connection.platform]: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={working || !profileUrls[connection.platform]?.trim()}
                  onClick={() => onConnect?.(connection.platform, profileUrls[connection.platform])}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => onDisconnect?.(connection.platform)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:border-rose-200 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function MentionSummary({ mention }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><span className="rounded-lg bg-slate-100 p-1.5"><MessageCircleMore className="h-3.5 w-3.5" /></span>{platformLabels[mention.platform] || mention.platform}<span className="font-normal text-slate-400">· {mention.author || 'Unknown author'}</span></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${sentimentClass(mention.sentiment)}`}>{mention.sentiment}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-700">{mention.content}</p>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>{mention.collection_source === 'user_submitted' ? 'User-submitted' : 'Authorized API'}</span><span>{displayDate(mention.published_at)}</span></div>
    </div>
  )
}

function MentionCard({ mention, onAnalyze, onGenerateReplies, onError, replyDrafts, working }) {
  const metrics = mention.engagement || {}
  const analysis = mention.sentiment_data || {}
  return (
    <article className="rounded-2xl border border-slate-100 bg-white/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{platformLabels[mention.platform] || mention.platform}</span>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${sentimentClass(mention.sentiment)}`}>{mention.sentiment}</span>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">{mention.collection_source === 'user_submitted' ? 'User-submitted data' : 'Authorized API data'}</span>
            <span className="text-[11px] text-slate-400">about {mention.entity_name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span>{mention.author || 'Author unavailable'}</span><span>{displayDate(mention.published_at)}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {mention.sentiment === 'unanalysed' && <button type="button" disabled={working} onClick={() => onAnalyze(mention.id)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><BrainCircuit className="h-3.5 w-3.5" /> Analyze</button>}
          <button type="button" disabled={working} onClick={() => onGenerateReplies(mention.id)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> Generate 3 replies</button>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{mention.content}</p>
      {analysis.topic && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-800">Topic: {analysis.topic} <span className="ml-1 font-normal text-slate-500">· {Math.round((analysis.confidence || 0) * 100)}% confidence</span></p><p className="mt-1 text-xs text-slate-600">{analysis.explanation}</p>{analysis.customer_signal && <p className="mt-2 text-xs text-slate-600"><strong>Customer signal:</strong> {analysis.customer_signal}</p>}<p className="mt-2 text-xs text-emerald-800"><strong>Suggested response:</strong> {analysis.suggested_action}</p>{analysis.keywords?.length > 0 && <p className="mt-2 text-[10px] text-slate-500">Keywords: {analysis.keywords.join(', ')}</p>}</div>}
      {replyDrafts?.drafts?.length > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-900">AI reply options · drafts only</p>
            <span className="text-[10px] text-slate-500">Review and edit before using</span>
          </div>
          <div className="grid gap-2 lg:grid-cols-3">
            {replyDrafts.drafts.map((draft) => (
              <div key={draft.tone} className="rounded-xl border border-emerald-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">{draft.tone}</p>
                  <button type="button" aria-label={`Copy ${draft.tone} reply`} onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(draft.text)
                    } catch {
                      onError('Clipboard access was denied. Select and copy the reply text manually.')
                    }
                  }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"><Copy className="h-3.5 w-3.5" /></button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{draft.text}</p>
                <p className="mt-2 text-[10px] leading-4 text-slate-400">{draft.rationale}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-amber-700">These suggestions are not published to {platformLabels[mention.platform] || mention.platform}.</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">{Object.entries(metrics).map(([key, value]) => <span key={key}>{key}: {value}</span>)}</div>
        {mention.source_url && <a href={mention.source_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-700 hover:underline">Open source ↗</a>}
      </div>
    </article>
  )
}

function Pagination({ page, total, onChange }) {
  const pages = Math.ceil(total / 20)
  if (pages <= 1) return null
  return <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span>Page {page} of {pages} · {total} mentions</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
}
