import {
  BarChart3,
  BookOpenText,
  FileText,
  Gauge,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const items = [
  { label: 'Overview', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Brand Intelligence', icon: Sparkles, to: '/dashboard' },
  { label: 'Brand Guidelines', icon: BookOpenText, to: '/dashboard' },
  { label: 'Content Analysis', icon: FileText, to: '/content-analysis' },
  { label: 'Review Queue', icon: MessageSquareText, to: '/dashboard' },
  { label: 'AI Corrections', icon: Wand2, to: '/ai-correction' },
  { label: 'Analytics', icon: BarChart3, to: '/analytics' },
  { label: 'Reports', icon: Gauge, to: '/dashboard' },
  { label: 'Settings', icon: Settings, to: '/dashboard' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="sidebar-shell w-full rounded-[1.8rem] p-5 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)] lg:w-72">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-bold text-white shadow-lg shadow-indigo-500/25">
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

      <div className="mt-8 rounded-2xl border border-indigo-500/35 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 p-4 shadow-inner shadow-indigo-500/10">
        <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-200">Score</p>
        <p className="mt-2 text-3xl font-bold text-white">94%</p>
        <p className="mt-1 text-sm text-indigo-100">Brand consistency is trending up.</p>
      </div>
    </aside>
  )
}
