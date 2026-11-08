import { useEffect, useState } from 'react'
import { BookOpenText, Check, Loader2, Save, ShieldCheck } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { defaultGuidelines, loadBrandGuidelines, saveBrandGuidelines } from '../lib/brandData'

const textFields = [
  { name: 'brand_name', label: 'Brand name', placeholder: 'Your brand' },
  { name: 'brand_description', label: 'Brand description', multiline: true },
  { name: 'preferred_tone', label: 'Preferred tone' },
  { name: 'target_audience', label: 'Target audience' },
  { name: 'preferred_keywords', label: 'Preferred keywords', list: true },
  { name: 'restricted_words', label: 'Restricted words and phrases', list: true },
  { name: 'writing_style', label: 'Writing style', multiline: true },
  { name: 'brand_communication_rules', label: 'Communication rules', multiline: true },
]

export default function BrandGuidelinesPage() {
  const [guidelines, setGuidelines] = useState(defaultGuidelines)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')

  useEffect(() => {
    let active = true
    loadBrandGuidelines().then(({ guidelines: saved }) => {
      if (!active) return
      setGuidelines(saved)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const updateField = (event) => {
    const { name, value } = event.target
    setGuidelines((current) => ({ ...current, [name]: value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const { warning } = await saveBrandGuidelines(guidelines)
      setNotice(warning || 'Brand guidelines saved.')
      setNoticeType('success')
    } catch (error) {
      setNotice('Guidelines could not be saved. Please try again.')
      setNoticeType('warning')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <header className="surface-panel mb-6 rounded-[2rem] p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <BookOpenText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-slate-500">Brand profile</p>
              <h1 className="text-2xl font-bold text-slate-950">Brand guidelines</h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            Define your voice, audience, approved vocabulary, and rules. Content analysis and AI correction use these guidelines.
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <form onSubmit={handleSave} className="surface-panel rounded-[2rem] p-6">
              <div className="mb-6 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Governance settings</h2>
                  <p className="text-sm text-slate-500">Changes apply to future analyses and corrections.</p>
                </div>
              </div>

              {notice && (
                <div role="status" className={`mb-5 rounded-2xl border p-3 text-sm ${
                  noticeType === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : noticeType === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}>
                  {notice}
                </div>
              )}

              {loading ? (
                <p className="py-10 text-center text-sm text-slate-500">Loading brand guidelines…</p>
              ) : (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    {textFields.map(({ name, label, multiline, list }) => {
                      const value = list && Array.isArray(guidelines[name])
                        ? guidelines[name].join(', ')
                        : guidelines[name] || ''
                      const sharedProps = {
                        id: name,
                        name,
                        value,
                        onChange: updateField,
                        required: name === 'brand_name',
                        placeholder: list ? 'Separate items with commas' : undefined,
                        className: 'mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100',
                      }
                      return (
                        <label key={name} htmlFor={name} className={`text-sm font-semibold text-slate-700 ${multiline ? 'md:col-span-2' : ''}`}>
                          {label}
                          {multiline
                            ? <textarea {...sharedProps} rows={3} />
                            : <input {...sharedProps} type="text" />}
                        </label>
                      )
                    })}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : noticeType === 'success' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving…' : 'Save brand guidelines'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </main>
        </div>
      </div>
    </div>
  )
}
