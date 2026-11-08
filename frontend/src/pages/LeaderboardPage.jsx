import axios from 'axios'
import {
  Award,
  Crown,
  FileCheck2,
  Flame,
  Flag,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { getCurrentUserId } from '../lib/brandData'

const ICON_MAP = {
  flag: Flag,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  flame: Flame,
  trophy: Trophy,
  'file-check-2': FileCheck2,
  crown: Crown,
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([])
  const [badgeCatalog, setBadgeCatalog] = useState({})
  const [myStats, setMyStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const userId = getCurrentUserId()
      const [boardRes, meRes] = await Promise.all([
        axios.get('/api/leaderboard'),
        axios.get('/api/leaderboard/me', { params: { user_id: userId } }),
      ])
      setLeaderboard(boardRes.data.leaderboard || [])
      setBadgeCatalog(boardRes.data.badge_catalog || {})
      setMyStats(meRes.data)
    } catch (err) {
      console.error('Failed to load leaderboard data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const myBadgesSet = new Set(myStats?.badges || [])

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        {/* Header */}
        <div className="surface-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-700 shadow-inner">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Governance Gamification</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Brand Champion Leaderboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span>Earn points by submitting high-compliance copy!</span>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <main className="flex-1 space-y-6">
            {/* User Stats Hero Card */}
            {myStats && (
              <div className="surface-panel overflow-hidden rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-2xl font-black text-white shadow-lg shadow-emerald-500/25">
                      #{myStats.rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase text-emerald-800">
                          Level {myStats.level} Champion
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-800">
                          <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
                          {myStats.streak_days} Day Streak
                        </span>
                      </div>
                      <h2 className="mt-1 text-2xl font-bold text-slate-950">{myStats.display_name}</h2>
                      <p className="text-xs text-slate-500">{myStats.total_submissions} Audits Completed</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/60 md:items-end">
                    <span className="text-xs font-semibold uppercase text-slate-400">Total Points</span>
                    <span className="text-4xl font-black tracking-tight text-emerald-600">
                      {myStats.champion_score.toLocaleString()} <span className="text-sm font-semibold text-slate-500">pts</span>
                    </span>
                    <span className="mt-1 text-[11px] text-slate-500">
                      {myStats.points_to_next_level} pts to Level {myStats.level + 1}
                    </span>
                  </div>
                </div>

                {/* Progress bar to next level */}
                <div className="mt-6">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Level {myStats.level} Progress</span>
                    <span>{myStats.next_threshold - myStats.points_to_next_level} / {myStats.next_threshold} pts</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-400 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((myStats.next_threshold - myStats.points_to_next_level) / myStats.next_threshold) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Badges Showcase */}
            <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-950">Achievements & Badges</h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {Object.values(badgeCatalog).map((badge) => {
                  const unlocked = myBadgesSet.has(badge.id)
                  const Icon = ICON_MAP[badge.icon] || Trophy

                  return (
                    <div
                      key={badge.id}
                      className={`relative flex flex-col rounded-2xl border p-4 transition ${
                        unlocked
                          ? 'border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white shadow-xs'
                          : 'border-slate-200 bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            unlocked
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            badge.rarity === 'legendary'
                              ? 'bg-purple-100 text-purple-800'
                              : badge.rarity === 'epic'
                              ? 'bg-amber-100 text-amber-800'
                              : badge.rarity === 'rare'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {badge.rarity}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{badge.title}</h4>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{badge.description}</p>

                      <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold">
                        {unlocked ? (
                          <span className="text-emerald-700">✓ Unlocked</span>
                        ) : (
                          <span className="text-slate-400">🔒 Locked</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="surface-panel rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <h3 className="text-lg font-bold text-slate-950 mb-4">Organizational Rankings</h3>

              {loading ? (
                <div className="flex items-center justify-center p-8 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading rankings...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Team Member</th>
                        <th className="py-3 px-4">Streak</th>
                        <th className="py-3 px-4">Badges</th>
                        <th className="py-3 px-4 text-right">Champion Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaderboard.map((user) => {
                        const isMe = user.id === getCurrentUserId()
                        return (
                          <tr
                            key={user.id}
                            className={`transition hover:bg-slate-50 ${
                              isMe ? 'bg-emerald-50/60 font-semibold' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              {user.rank === 1 ? (
                                <span className="inline-flex items-center gap-1 font-black text-amber-500">
                                  🥇 1
                                </span>
                              ) : user.rank === 2 ? (
                                <span className="inline-flex items-center gap-1 font-black text-slate-400">
                                  🥈 2
                                </span>
                              ) : user.rank === 3 ? (
                                <span className="inline-flex items-center gap-1 font-black text-amber-700">
                                  🥉 3
                                </span>
                              ) : (
                                <span className="text-slate-500">#{user.rank}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-900">
                              {user.display_name} {isMe && <span className="text-xs text-emerald-700 font-bold">(You)</span>}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700">
                                <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
                                {user.streak_days}d
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                                {(user.badges || []).length} Badges
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-emerald-600">
                              {(user.champion_score || 0).toLocaleString()} pts
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

