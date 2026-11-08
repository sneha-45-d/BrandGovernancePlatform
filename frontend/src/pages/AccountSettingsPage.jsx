import axios from 'axios'
import { AlertCircle, CheckCircle2, LogOut, Save, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { getApiErrorMessage } from '../lib/apiError'
import { useAuth } from '../lib/auth-context'
import { updateLocalAccount } from '../lib/localAuth'

export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const { user, token, updateUser, signOut } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [notice, setNotice] = useState(null)

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const updates = { full_name: fullName.trim(), email: email.trim() }
      let updatedUser
      if (user.localOnly) {
        updatedUser = updateLocalAccount(user, updates)
      } else {
        const { data } = await axios.patch('/api/auth/me', updates, {
          timeout: 8000,
          headers: { Authorization: `Bearer ${token}` },
        })
        updatedUser = data.user
      }
      updateUser(updatedUser)
      setFullName(updatedUser.full_name)
      setEmail(updatedUser.email)
      setNotice({ type: 'success', text: 'Account settings updated.' })
    } catch (error) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(error, 'Could not save your account settings. Please try again.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(error, 'Signed out on this device, but the server session could not be ended.'),
      })
    } finally {
      navigate('/signin', { replace: true })
      setSigningOut(false)
    }
  }

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <header className="surface-panel mb-6 rounded-[2rem] p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Account</p>
              <h1 className="text-2xl font-bold text-slate-950">Settings</h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            Manage the name and email associated with your BRANDITHM account.
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1 space-y-6">
            <form onSubmit={handleSave} className="surface-panel rounded-[2rem] p-6">
              <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
              <p className="mt-1 text-sm text-slate-500">These details are saved to your account.</p>
              {notice && (
                <div
                  role={notice.type === 'error' ? 'alert' : 'status'}
                  className={`mt-5 flex items-start gap-2 rounded-2xl border p-3 text-sm ${
                    notice.type === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {notice.type === 'error'
                    ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                  {notice.text}
                </div>
              )}

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Full name
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    maxLength={120}
                    autoComplete="name"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {signingOut ? 'Logging out…' : 'Log out'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </form>

            <section className="surface-panel rounded-[2rem] p-6">
              <h2 className="font-semibold text-slate-900">Signed-in account</h2>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                  {(user?.full_name || user?.email || 'B').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{user?.full_name}</p>
                  <p className="truncate text-sm text-slate-500">{user?.email}</p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
