import {
  BarChart3,
  BookOpenText,
  FileText,
  Flame,
  Gauge,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wand2,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { useEffect, useState } from 'react'
import axios from 'axios'
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
  { label: 'Settings', icon: Settings, to: '/settings' },
]

export default function Sidebar({ score = null }) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const [championStats, setChampionStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    const fetchChampion = async () => {
      try {
        const res = await axios.get('/api/leaderboard/me', {
          params: { user_id: getCurrentUserId() },
        })
        if (!cancelled) {
          setChampionStats(res.data)
        }
      } catch {
        // graceful ignore
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
      setLogoutError(error?.response?.data?.detail || 'Signed out on this device, but the server session could not be ended.')
    }
  }

  return (
    <aside className="sidebar-shell w-full rounded-[1.8rem] p-5 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] lg:w-72">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/25">
          B
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Brandithm</p>
          <h2 className="text-xl font-semibold text-white">Command Center</h2>
        </div>
      </div>

      <nav className="space-y-2">
        {items.map(({ label, icon: Icon, to }) => {
          const active = location.pathname === to

          return (
            <Link
              key={label}
              to={to}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
                active
                  ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/10'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-green-500/10 p-4 shadow-inner shadow-emerald-500/10">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200">Champion Score</p>
          {championStats && (
            <span className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-200">
              <Flame className="h-3 w-3 fill-orange-400 text-orange-400" />
              {championStats.streak_days}d streak
            </span>
          )}
        </div>
        <p className="mt-2 text-3xl font-bold text-white">
          {championStats ? `${championStats.champion_score.toLocaleString()} pts` : score === null ? '—' : `${Math.round(Number(score))}%`}
        </p>
        <p className="mt-1 text-xs text-emerald-100">
          {championStats ? `Level ${championStats.level} · Rank #${championStats.rank}` : 'Average score from your reviews.'}
        </p>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
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
    </aside>
  )
}
