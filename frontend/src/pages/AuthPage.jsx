import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
  UserRound,
} from 'lucide-react'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { getApiErrorMessage } from '../lib/apiError'
import { loginLocalAccount, registerLocalAccount } from '../lib/localAuth'

const brandFeatures = [
  { icon: Sparkles, text: 'AI-Powered Brand Intelligence' },
  { icon: Check, text: 'Automated Content Governance' },
  { icon: Zap, text: 'Real-Time Brand Consistency' },
]

export default function AuthPage({ mode = 'signin' }) {
  const isSignIn = mode === 'signin'
  const navigate = useNavigate()
  const { user, signIn, isLoading: checkingSession } = useAuth()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    rememberMe: false,
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!checkingSession && user) navigate('/dashboard', { replace: true })
  }, [checkingSession, navigate, user])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if ((!isSignIn && !formData.full_name.trim()) || !formData.email || !formData.password) {
      setError(isSignIn ? 'Please enter both your email and password.' : 'Please enter your name, email, and password.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const endpoint = isSignIn ? '/api/auth/login' : '/api/auth/register'
      const payload = isSignIn
        ? { email: formData.email, password: formData.password }
        : { full_name: formData.full_name.trim(), email: formData.email, password: formData.password }
      let session
      try {
        const { data } = await axios.post(endpoint, payload, { timeout: 8000 })
        session = data
      } catch (requestError) {
        if (requestError.response?.status === 409 || requestError.response?.status === 422) {
          throw requestError
        }
        if (isSignIn) {
          session = await loginLocalAccount(payload)
          try {
            const { data } = await axios.post('/api/auth/register', {
              full_name: session.user.full_name,
              email: payload.email,
              password: payload.password,
            }, { timeout: 8000 })
            session = data
          } catch (migrationError) {
            if (migrationError.response?.status !== 409) {
              console.warn('Local account could not be migrated to app-server storage.')
            }
          }
        } else {
          session = await registerLocalAccount(payload)
        }
      }
      signIn(session, formData.rememberMe)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(getApiErrorMessage(
        requestError,
        'Could not connect to the account service. Check that the backend and database are running.'
      ))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-reference-shell min-h-screen overflow-hidden">
      <div className="auth-reference-inner mx-auto min-h-screen max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
        <header className="mb-8 flex items-center justify-between px-2 pr-24 sm:px-4 sm:pr-24">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-[14px] text-lg font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.28)]">
              B
            </div>
            <div className="text-2xl font-black tracking-[-0.06em] text-slate-900 sm:text-3xl">BRANDITHM</div>
          </div>

          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((dot) => (
              <span
                key={dot}
                className="block h-2.5 w-2.5 rounded-full bg-emerald-200/80"
                style={{ opacity: dot % 2 === 0 ? 0.85 : 0.5 }}
              />
            ))}
          </div>
        </header>

        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
          <aside className="auth-copy-panel px-2 pb-4 pt-2 sm:px-6 lg:px-4">
            <div className="max-w-xl">
              <h1 className="max-w-[420px] text-[3rem] font-black leading-[0.93] tracking-[-0.07em] text-slate-900 sm:text-[4rem]">
                Your Brand.
                <br />
                Always <span className="brand-highlight">Consistent.</span>
              </h1>

              <p className="mt-6 max-w-md text-[1.02rem] leading-7 text-slate-700">
                BRANDITHM uses AI to protect your brand identity across all content.
              </p>

              <ul className="mt-8 space-y-5">
                {brandFeatures.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-4 text-[1.04rem] font-medium text-slate-700">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <main className="auth-form-panel mx-auto w-full max-w-[560px] rounded-[30px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-slate-500">
                {isSignIn ? 'Sign In' : 'Create Account'}
              </div>
              <Link to={isSignIn ? '/signup' : '/signin'} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-600">
                <span>{isSignIn ? 'Create account' : 'Sign in'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mb-5">
              <h2 className="text-[3rem] font-black tracking-[-0.06em] text-slate-900 leading-[1]">
                {isSignIn ? 'Welcome Back' : 'Create Account'}
              </h2>
            </div>

            <p className="mb-5 text-lg text-slate-500">
              {isSignIn ? 'Sign in to continue managing your brand.' : 'Create your secure workspace to manage your brand.'}
            </p>

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {!isSignIn && (
                <div className="auth-field flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <UserRound className="h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    autoComplete="name"
                    placeholder="Full name"
                    maxLength={120}
                    required
                    className="w-full border-0 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              )}
              <div className="auth-field flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <Mail className="h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="Work Email"
                  required
                  className="w-full border-0 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <div className="auth-field flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <LockKeyhole className="h-5 w-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete={isSignIn ? 'current-password' : 'new-password'}
                  placeholder="Password"
                  minLength={isSignIn ? 1 : 8}
                  required
                  className="w-full border-0 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {isSignIn && (
                <div className="flex items-center justify-between gap-3 pt-1 text-sm text-slate-600">
                  <label className="inline-flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                    />
                    <span>Remember Me</span>
                  </label>
                  <span className="text-xs text-slate-400">Use your registered email</span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-700 via-green-600 to-teal-500 px-4 py-3.5 text-lg font-bold text-white shadow-[0_14px_28px_rgba(5,150,105,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(5,150,105,0.34)] disabled:cursor-not-allowed disabled:opacity-75"
              >
                <span>{isSubmitting ? (isSignIn ? 'Signing in...' : 'Creating account...') : isSignIn ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-700">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <span>Secure access</span>
              </div>
              <div className="flex items-center gap-2 border-l border-emerald-200 pl-4">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <span>SOC 2 Ready</span>
              </div>
            </div>

            <p className="mt-5 text-center text-base text-slate-500">
              {isSignIn ? 'Need an account? ' : 'Already have an account? '}
              <Link to={isSignIn ? '/signup' : '/signin'} className="font-bold text-emerald-700 hover:text-emerald-600">
                {isSignIn ? 'Create Account' : 'Sign In'}
              </Link>
            </p>
          </main>
        </div>
      </div>
    </div>
  )
}
