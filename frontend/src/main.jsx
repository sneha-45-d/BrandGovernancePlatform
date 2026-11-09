import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

const defaultProductionApi = 'https://backend-production-fe59.up.railway.app'
const apiBase = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? defaultProductionApi : '')).trim().replace(/\/+$/, '')

axios.defaults.baseURL = apiBase

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
