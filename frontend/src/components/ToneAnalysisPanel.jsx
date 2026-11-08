import { ArrowDown, ArrowUp, CheckCircle, Compass, Info, Sparkles } from 'lucide-react'
import ToneRadarChart from './ToneRadarChart'

const DIMENSION_CONFIG = {
  formality: { label: 'Formality', low: 'Casual', high: 'Executive' },
  warmth: { label: 'Warmth', low: 'Clinical', high: 'Empathetic' },
  confidence: { label: 'Confidence', low: 'Hesitant', high: 'Assertive' },
  urgency: { label: 'Urgency', low: 'Measured', high: 'High Pressure' },
  technicality: { label: 'Technicality', low: 'Plain Language', high: 'Deep Tech' },
}

export default function ToneAnalysisPanel({ toneData }) {
  if (!toneData) return null

  const {
    detected = {},
    target = {},
    deviations = [],
    archetype = 'Balanced Professional',
    archetype_description = 'Content communicates with clear, balanced brand presence.',
    archetype_match_score = 80,
  } = toneData

  return (
    <div className="surface-panel space-y-6 rounded-[2rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      {/* Archetype Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Archetype Match
              </span>
              <span className="rounded-full bg-emerald-200/60 px-2 py-0.5 text-xs font-bold text-emerald-900">
                {archetype_match_score}% Fit
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">{archetype}</h3>
            <p className="mt-1 text-sm text-slate-600">{archetype_description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span>5-Dimensional Semantic Tone Map</span>
        </div>
      </div>

      {/* Main Grid: Radar on left, dimension sliders on right */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tone Radar: Detected (Green) vs Target (Amber)
          </p>
          <ToneRadarChart detected={detected} target={target} />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Dimension Breakdown
          </p>
          {Object.entries(DIMENSION_CONFIG).map(([key, config]) => {
            const det = detected[key] ?? 50
            const tgt = target[key] ?? 50
            const diff = det - tgt
            const isOff = Math.abs(diff) >= 15

            return (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="font-semibold text-slate-900">{config.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Target: {tgt}%</span>
                    <span className="font-bold text-emerald-700">Detected: {det}%</span>
                    {isOff && (
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          diff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {diff > 0 ? <ArrowUp className="mr-0.5 h-3 w-3" /> : <ArrowDown className="mr-0.5 h-3 w-3" />}
                        {Math.abs(diff)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600"
                    style={{ width: `${Math.min(100, Math.max(0, det))}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>{config.low}</span>
                  <span>{config.high}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tone Deviations & Guidance */}
      {deviations.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Info className="h-4 w-4" />
            <span>Tone Deviations & Voice Guidance ({deviations.length})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {deviations.map((dev, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-slate-700 shadow-sm"
              >
                <div className="flex items-center justify-between font-semibold capitalize text-amber-950">
                  <span>{dev.dimension}</span>
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] uppercase">
                    {dev.direction} by {Math.abs(dev.gap)}%
                  </span>
                </div>
                <p className="mt-1.5 text-slate-600">{dev.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span>Copy tone aligns closely with all desired brand voice dimensions!</span>
        </div>
      )}
    </div>
  )
}

