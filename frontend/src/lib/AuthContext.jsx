/* eslint-disable react-refresh/only-export-components */
import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext, useAuth } from './auth-context'

export { AuthContext, useAuth }

const authStorageKey = 'brandithm-auth-session'

function readStoredSession() {
  try {
    const stored = localStorage.getItem(authStorageKey) || sessionStorage.getItem(authStorageKey)
    return stored ? JSON.parse(stored) : null
  } catch {
    localStorage.removeItem(authStorageKey)
    sessionStorage.removeItem(authStorageKey)
    return null
  }
}

function clearStoredSession() {
  localStorage.removeItem(authStorageKey)
  sessionStorage.removeItem(authStorageKey)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)
  const [isLoading, setIsLoading] = useState(() => {
    const stored = readStoredSession()
    return Boolean(stored?.token && !stored?.localOnly)
  })
  const token = session?.token

  useEffect(() => {
    if (!token || session?.localOnly) return

    let active = true
    axios.get('/api/auth/me', {
      timeout: 8000,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => {
        if (!active) return
        const refreshed = { token, user: data.user }
        setSession(refreshed)
        const storage = localStorage.getItem(authStorageKey) ? localStorage : sessionStorage
        storage.setItem(authStorageKey, JSON.stringify(refreshed))
      })
      .catch((error) => {
        if (!active || error.response?.status !== 401) return
        clearStoredSession()
        setSession(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
  }, [token, session?.localOnly])

  const signIn = useCallback((nextSession, rememberMe) => {
    const storage = rememberMe ? localStorage : sessionStorage
    clearStoredSession()
    storage.setItem(authStorageKey, JSON.stringify(nextSession))
    setSession(nextSession)
  }, [])

  const updateUser = useCallback((user) => {
    setSession((current) => {
      if (!current) return current
      const updated = { ...current, user }
      const storage = localStorage.getItem(authStorageKey) ? localStorage : sessionStorage
      storage.setItem(authStorageKey, JSON.stringify(updated))
      return updated
    })
  }, [])

  const signOut = useCallback(async () => {
    const token = session?.token
    const localOnly = session?.localOnly
    clearStoredSession()
    setSession(null)
    if (!token || localOnly) return

    try {
      await axios.post('/api/auth/logout', null, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (error) {
      if (error.response && error.response.status !== 401) throw error
    }
  }, [session])

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || '',
    isLoading,
    signIn,
    updateUser,
    signOut,
  }), [session, isLoading, signIn, updateUser, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
