import {
  BarChart3,
  BellRing,
  BookOpenText,
  BrainCircuit,
  Building2,
  FileText,
  Flame,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleMore,
  MessageSquareText,
  Palette,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wand2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { getApiErrorMessage } from '../lib/apiError'
import { useAuth } from '../lib/auth-context'
import { getCurrentUserId } from '../lib/brandData'

const items = [
  { label: 'Overview', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Brand Intelligence', icon: Sparkles, to: '/brand-intelligence' },
  { label: 'Brand Guidelines', icon: BookOpenText, to: '/brand-guidelines' },
  { label: 'Content Analysis', icon: FileText, to: '/content-analysis' },
  { label: 'Competitor Guard', icon: ShieldCheck, to: '/competitors' },
  { label: 'Visual Brand Check', icon: Palette, to: '/visual-check' },
  { label: 'Brand Champions', icon: Trophy, to: '/leaderboard' },
  { label: 'Review Queue', icon: MessageSquareText, to: '/review-queue' },
  { label: 'AI Corrections', icon: Wand2, to: '/ai-correction' },
  { label: 'Analytics', icon: BarChart3, to: '/analytics' },
  {
    label: 'Social Media Intelligence',
    icon: Radio,
    to: '/social/overview',
    children: [
      { label: 'Overview', icon: LayoutDashboard, to: '/social/overview' },
      { label: 'Brand Mentions', icon: MessageCircleMore, to: '/social/mentions' },
      { label: 'Sentiment Analysis', icon: BrainCircuit, to: '/social/sentiment' },
      { label: 'Competitor Intelligence', icon: Building2, to: '/social/competitors' },
      { label: 'Intelligent Alerts', icon: BellRing, to: '/social/alerts' },
    ],
  },
  { label: 'Settings', icon: Settings, to: '/settings' },
]

export default function Sidebar({ score = null }) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const [championStats, setChampionStats] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchChampion = async () => {
      try {
        const res = await axios.get('/api/leaderboard/me', {
          params: { user_id: getCurrentUserId() },
        })
        if (!cancelled) setChampionStats(res.data)
      } catch {
        // Champion data is an enhancement; the main navigation remains usable if it fails.
      }
    }

    fetchChampion()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  const handleSignOut = async () => {
    setLogoutError('')
    try {
      await signOut()
    } catch (error) {
      setLogoutError(getApiErrorMessage(error, 'Signed out on this device, but the server session could not be ended.'))
    }
  }

  return (
    <aside className="sidebar-shell w-full rounded-[1.5rem] p-4 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] sm:rounded-[1.8rem] sm:p-5 lg:w-72">
      <div className="mb-1 flex items-center justify-between gap-3 lg:mb-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/25">
            B
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Brandithm</p>
            <h2 className="truncate text-xl font-semibold text-white">Command Center</h2>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-mobile-toggle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200/20 bg-white/5 text-emerald-100 transition hover:bg-emerald-400/10 lg:hidden"
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="sidebar-mobile-content"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div id="sidebar-mobile-content" className={`sidebar-mobile-content ${isMobileMenuOpen ? 'is-open' : ''}`}>
        <nav className="grid grid-cols-2 gap-2 lg:block lg:space-y-2" aria-label="Workspace navigation">
          {items.map(({ label, icon: Icon, to, children }) => {
            const active = location.pathname === to || Boolean(children?.some((child) => child.to === location.pathname))

            return (
              <div key={label} className={children ? 'col-span-2 lg:col-span-1' : ''}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
                    active
                      ? 'sidebar-nav-active bg-emerald-400/10 text-emerald-50 shadow-inner ring-1 ring-emerald-300/20'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{label}</span>
                </Link>
                {children && (
                  <div className="ml-3 mt-1 space-y-1 border-l border-emerald-200/15 pl-3">
                    {children.map(({ label: childLabel, icon: ChildIcon, to: childTo }) => {
                      const childActive = location.pathname === childTo
                      return (
                        <Link
                          key={childTo}
                          to={childTo}
                          aria-current={childActive ? 'page' : undefined}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-medium transition ${
                            childActive
                              ? 'bg-emerald-400/10 text-emerald-50'
                              : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                          <span>{childLabel}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="mt-5 rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-green-500/10 p-4 shadow-inner shadow-emerald-500/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200">Champion Score</p>
            {championStats && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-200">
                <Flame className="h-3 w-3 fill-orange-400 text-orange-400" />
                {championStats.streak_days}d streak
              </span>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {championStats
              ? `${championStats.champion_score.toLocaleString()} pts`
              : score === null ? '—' : `${Math.round(Number(score))}%`}
          </p>
          <p className="mt-1 text-xs text-emerald-100">
            {championStats
              ? `Level ${championStats.level} · Rank #${championStats.rank}`
              : 'Average score from your reviews.'}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Signed in as</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{user?.full_name || 'Account'}</p>
          <p className="truncate text-xs text-slate-300">{user?.email}</p>
          {logoutError && <p role="alert" className="mt-2 text-xs text-amber-200">{logoutError}</p>}
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-200 transition hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>
    </aside>
  )
}
