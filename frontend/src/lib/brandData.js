import axios from 'axios'

export const demoUserId = 'demo-user'
export const guidelinesStorageKey = 'brandithm-brand-guidelines'
export const localAnalysesStorageKey = 'brandithm-local-analyses'

export const reviewStatuses = ['needs_review', 'approved', 'revision_requested']

export function getUserStorageKey(key, userId = getCurrentUserId()) {
  return `${key}:${userId}`
}

export function getCurrentUserId() {
  try {
    const stored = localStorage.getItem('brandithm-auth-session') || sessionStorage.getItem('brandithm-auth-session')
    return JSON.parse(stored || 'null')?.user?.id || demoUserId
  } catch {
    return demoUserId
  }
}

export const defaultGuidelines = {
  user_id: getCurrentUserId(),
  brand_name: 'BRANDITHM',
  brand_description: 'AI-powered brand governance and intelligence platform.',
  preferred_tone: 'Confident, clear, modern, professional, and trustworthy.',
  target_audience: 'Marketing professionals, brand teams, and enterprise stakeholders.',
  preferred_keywords: ['brand', 'trust', 'clarity', 'innovation', 'governance'],
  restricted_words: ['guaranteed', 'instant', 'best ever', 'hype'],
  writing_style: 'Short, persuasive, and benefit-driven with structured messaging.',
  brand_communication_rules: 'Avoid exaggerated claims, hype, and vague language. Keep the message precise, credible, and aligned with brand standards.',
}

function writeGuidelinesCache(guidelines, pendingSync) {
  localStorage.setItem(
    getUserStorageKey(guidelinesStorageKey, guidelines.user_id),
    JSON.stringify({ guidelines, pendingSync })
  )
}

export function normalizeGuidelines(guidelines) {
  const normalizeList = (value) => (
    Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
  )

  return {
    ...defaultGuidelines,
    ...guidelines,
    user_id: getCurrentUserId(),
    preferred_keywords: normalizeList(guidelines.preferred_keywords),
    restricted_words: normalizeList(guidelines.restricted_words),
  }
}

export async function loadBrandGuidelines() {
  const userId = getCurrentUserId()
  const cacheKey = getUserStorageKey(guidelinesStorageKey, userId)
  let localGuidelines = normalizeGuidelines(defaultGuidelines)
  let hasLocalGuidelines = false
  let pendingSync = false
  let stored = null

  try {
    stored = JSON.parse(localStorage.getItem(cacheKey) || 'null')
  } catch {
    localStorage.removeItem(cacheKey)
  }

  if (!stored) {
    try {
      const legacy = JSON.parse(localStorage.getItem(guidelinesStorageKey) || 'null')
      const legacyGuidelines = legacy?.guidelines || legacy
      if (legacyGuidelines?.user_id === userId) {
        stored = legacy
        localStorage.setItem(cacheKey, JSON.stringify(legacy))
      }
    } catch {
      localStorage.removeItem(guidelinesStorageKey)
    }
  }

  if (stored) {
    hasLocalGuidelines = true
    if (stored.guidelines) {
      localGuidelines = normalizeGuidelines(stored.guidelines)
      pendingSync = stored.pendingSync === true
    } else {
      localGuidelines = normalizeGuidelines(stored)
    }
  }

  if (pendingSync) {
    try {
      const response = await axios.post('/api/brand-guidelines', localGuidelines)
      writeGuidelinesCache(localGuidelines, false)
      return {
        guidelines: localGuidelines,
        source: response.data?.storage || 'mongodb',
        warning: '',
      }
    } catch (error) {
      return {
        guidelines: localGuidelines,
        source: 'local',
        warning: '',
      }
    }
  }

  try {
    const response = await axios.get('/api/brand-guidelines', {
      params: { user_id: userId },
    })
    const savedGuidelines = response.data?.guidelines?.[0]
    if (savedGuidelines) {
      const guidelines = normalizeGuidelines(savedGuidelines)
      writeGuidelinesCache(guidelines, false)
      return {
        guidelines,
        source: response.data?.storage || 'mongodb',
        warning: '',
      }
    }

    if (hasLocalGuidelines) {
      try {
        const saveResponse = await axios.post('/api/brand-guidelines', localGuidelines)
        writeGuidelinesCache(localGuidelines, false)
        return {
          guidelines: localGuidelines,
          source: saveResponse.data?.storage || 'mongodb',
          warning: '',
        }
      } catch (error) {
        return {
          guidelines: localGuidelines,
          source: 'local',
          warning: '',
        }
      }
    }

    return { guidelines: localGuidelines, source: 'local', warning: '' }
  } catch (error) {
    return {
      guidelines: localGuidelines,
      source: 'local',
      warning: '',
    }
  }
}

export async function saveBrandGuidelines(guidelines) {
  const normalized = normalizeGuidelines(guidelines)
  writeGuidelinesCache(normalized, true)

  try {
    const response = await axios.post('/api/brand-guidelines', normalized)
    writeGuidelinesCache(normalized, false)
    return { source: response.data?.storage || 'mongodb', warning: '' }
  } catch (error) {
    return {
      source: 'local',
      warning: '',
    }
  }
}

export function getLocalAnalyses() {
  try {
    const userId = getCurrentUserId()
    const analyses = JSON.parse(localStorage.getItem(getUserStorageKey(localAnalysesStorageKey, userId)) || '[]')
    return Array.isArray(analyses)
      ? analyses.filter((item) => item && (!item.user_id || item.user_id === userId))
      : []
  } catch {
    return []
  }
}

export function saveLocalAnalysis({ reportId, title, brandName, content, analysis, createdAt }) {
  const analyses = getLocalAnalyses()
  const id = reportId || `local-${Date.now()}`
  const nextAnalysis = {
    id,
    user_id: getCurrentUserId(),
    title,
    brand_name: brandName,
    content,
    analysis,
    summary: analysis?.summary || '',
    overall_score: analysis?.overall_score,
    compliance_score: analysis?.brand_compliance_score,
    status: 'completed',
    review_status: 'needs_review',
    created_at: createdAt || new Date().toISOString(),
  }
  localStorage.setItem(
    getUserStorageKey(localAnalysesStorageKey, nextAnalysis.user_id),
    JSON.stringify([nextAnalysis, ...analyses.filter((item) => item.id !== id)].slice(0, 100))
  )
  return nextAnalysis
}

export function updateLocalAnalysisReviewStatus(id, reviewStatus) {
  const analyses = getLocalAnalyses()
  const exists = analyses.some((item) => item.id === id)
  const updated = analyses.map((item) => (
    item.id === id
      ? { ...item, review_status: reviewStatus, review_updated_at: new Date().toISOString() }
      : item
  ))
  if (exists) {
    localStorage.setItem(
      getUserStorageKey(localAnalysesStorageKey),
      JSON.stringify(updated)
    )
  }
  return exists
}
