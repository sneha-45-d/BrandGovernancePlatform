import { useEffect, useState } from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import PricingPage from './pages/PricingPage'
import AuthPage from './pages/AuthPage'
import ContentAnalysisPage from './pages/ContentAnalysisPage'
import AICorrectionPage from './pages/AICorrectionPage'
import BrandIntelligencePage from './pages/BrandIntelligencePage'
import BrandGuidelinesPage from './pages/BrandGuidelinesPage'
import ReviewQueuePage from './pages/ReviewQueuePage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import CompetitorManagePage from './pages/CompetitorManagePage'
import LeaderboardPage from './pages/LeaderboardPage'
import VisualCheckPage from './pages/VisualCheckPage'
import LandingPage from './pages/LandingPage'
import { AuthProvider } from './lib/AuthContext'
import { useAuth } from './lib/auth-context'

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
        </Route>
      </Routes>
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
