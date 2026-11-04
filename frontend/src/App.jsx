import { useEffect, useState } from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import AnalyticsPage from './pages/AnalyticsPage'

function App() {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    document.body.dataset.theme = theme
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

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
