import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const brandFeatures = [
  { icon: Sparkles, text: 'AI-Powered Brand Intelligence' },
  { icon: Check, text: 'Automated Content Governance' },
  { icon: Zap, text: 'Real-Time Brand Consistency' },
]

export default function AuthPage({ mode = 'signin' }) {
  const isSignIn = mode === 'signin'
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!formData.email || !formData.password) {
      setError('Please enter both your work email and password.')
      return
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid work email address.')
      return
    }

    setIsSubmitting(true)
    setError('')

    setTimeout(() => {
      setIsSubmitting(false)
      navigate('/dashboard')
    }, 500)
  }

  return (
    <div className="auth-reference-shell min-h-screen overflow-hidden">
      <div className="auth-reference-inner mx-auto min-h-screen max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
        <header className="mb-8 flex items-center justify-between px-2 sm:px-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-[14px] text-lg font-black text-white shadow-[0_12px_30px_rgba(123,92,255,0.35)]">
              B
            </div>
            <div className="text-2xl font-black tracking-[-0.06em] text-slate-900 sm:text-3xl">BRANDITHM</div>
          </div>

          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((dot) => (
              <span
                key={dot}
                className="block h-2.5 w-2.5 rounded-full bg-violet-200/80"
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
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]">
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
              <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 transition hover:text-violet-500">
                <span>Home</span>
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
              <div className="auth-field flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <Mail className="h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Work Email"
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
                  placeholder="Password"
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
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span>Remember Me</span>
                  </label>
                  <Link to="/signin" className="font-semibold text-violet-600 hover:text-violet-500">
                    Forgot Password?
                  </Link>
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
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 px-4 py-3.5 text-lg font-bold text-white shadow-[0_14px_28px_rgba(96,83,255,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(96,83,255,0.4)] disabled:cursor-not-allowed disabled:opacity-75"
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

            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:border-violet-200 hover:text-violet-700"
            >
              <LockKeyhole className="h-4 w-4" />
              Continue with SSO
            </button>

            <p className="mt-5 text-center text-base text-slate-500">
              {isSignIn ? 'Need an account? ' : 'Already have an account? '}
              <Link to={isSignIn ? '/signup' : '/signin'} className="font-bold text-violet-600 hover:text-violet-500">
                {isSignIn ? 'Create Account' : 'Sign In'}
              </Link>
            </p>
          </main>
        </div>
      </div>
    </div>
  )
}
