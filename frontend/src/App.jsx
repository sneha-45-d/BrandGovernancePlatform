import { Suspense, lazy, useEffect, useState } from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const ContentAnalysisPage = lazy(() => import('./pages/ContentAnalysisPage'))
const AICorrectionPage = lazy(() => import('./pages/AICorrectionPage'))
const BrandIntelligencePage = lazy(() => import('./pages/BrandIntelligencePage'))
const BrandGuidelinesPage = lazy(() => import('./pages/BrandGuidelinesPage'))
const ReviewQueuePage = lazy(() => import('./pages/ReviewQueuePage'))
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const CompetitorManagePage = lazy(() => import('./pages/CompetitorManagePage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const VisualCheckPage = lazy(() => import('./pages/VisualCheckPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const SocialIntelligencePage = lazy(() => import('./pages/SocialIntelligencePage'))

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  )
}

function RequireAuth() {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking your account…</div>
  }
  return user ? <Outlet /> : <Navigate to="/signin" replace />
}

function AppShell() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('brandithm-theme')
    return savedTheme || 'light'
  })
  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem('brandithm-theme', theme)
  }, [theme])

  return (
    <>
      <button
        type="button"
        aria-label="Toggle color theme"
        className="app-theme-toggle"
        onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      >
        {theme === 'light' ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
        <span>{theme === 'light' ? 'Dark' : 'Light'} mode</span>
      </button>

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/content-analysis" element={<ContentAnalysisPage />} />
            <Route path="/ai-correction" element={<AICorrectionPage />} />
            <Route path="/brand-intelligence" element={<BrandIntelligencePage />} />
            <Route path="/brand-guidelines" element={<BrandGuidelinesPage />} />
            <Route path="/review-queue" element={<ReviewQueuePage />} />
            <Route path="/competitors" element={<CompetitorManagePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/visual-check" element={<VisualCheckPage />} />
            <Route path="/settings" element={<AccountSettingsPage />} />
            <Route path="/social" element={<Navigate to="/social/overview" replace />} />
            <Route path="/social/overview" element={<SocialIntelligencePage key="overview" section="overview" />} />
            <Route path="/social/audit" element={<SocialIntelligencePage key="audit" section="audit" />} />
            <Route path="/social/strategy" element={<SocialIntelligencePage key="strategy" section="strategy" />} />
            <Route path="/social/mentions" element={<SocialIntelligencePage key="mentions" section="mentions" />} />
            <Route path="/social/sentiment" element={<SocialIntelligencePage key="sentiment" section="sentiment" />} />
            <Route path="/social/competitors" element={<SocialIntelligencePage key="competitors" section="competitors" />} />
            <Route path="/social/alerts" element={<SocialIntelligencePage key="alerts" section="alerts" />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
