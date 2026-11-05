import { useEffect, useState } from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import PricingPage from './pages/PricingPage'
import AuthPage from './pages/AuthPage'
import ContentAnalysisPage from './pages/ContentAnalysisPage'
import AICorrectionPage from './pages/AICorrectionPage'

function AppShell() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('brandithm-theme')
    return savedTheme || 'light'
  })
  const location = useLocation()
  const isAuthRoute = location.pathname === '/signin' || location.pathname === '/signup'

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem('brandithm-theme', theme)
  }, [theme])

  return (
    <>
      {!isAuthRoute && (
        <button
          type="button"
          aria-label="Toggle color theme"
          className="app-theme-toggle"
          onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
        >
          {theme === 'light' ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
          <span>{theme === 'light' ? 'Dark' : 'Light'} mode</span>
        </button>
      )}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/signin" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/content-analysis" element={<ContentAnalysisPage />} />
        <Route path="/ai-correction" element={<AICorrectionPage />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
