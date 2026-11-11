import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

const defaultProductionApi = 'https://backend-production-fe59.up.railway.app'
const apiBase = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? defaultProductionApi : '')).trim().replace(/\/+$/, '')
const authStorageKey = 'brandithm-auth-session'

axios.defaults.baseURL = apiBase
axios.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const stored = localStorage.getItem(authStorageKey) || sessionStorage.getItem(authStorageKey)
    if (stored) {
      try {
        const session = JSON.parse(stored)
        if (session?.token && !session.localOnly) {
          config.headers.Authorization = `Bearer ${session.token}`
        }
      } catch {
        localStorage.removeItem(authStorageKey)
        sessionStorage.removeItem(authStorageKey)
      }
    }
  }
  return config
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
