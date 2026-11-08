import { AlertCircle, AlertTriangle, ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ClashAlert({ clashReport }) {
  if (!clashReport || !clashReport.has_clashes) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Competitor IP Guard</p>
            <p className="text-sm font-medium">No trademark, slogan, or positioning clashes detected against registered competitors.</p>
          </div>
        </div>
        <Link
          to="/competitors"
          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100"
        >
          Manage Registry <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  const isHighRisk = clashReport.risk_level === 'high'
  const isMediumRisk = clashReport.risk_level === 'medium'

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        isHighRisk
          ? 'border-red-300 bg-red-50/90 text-red-950'
          : isMediumRisk
          ? 'border-amber-300 bg-amber-50/90 text-amber-950'
          : 'border-yellow-200 bg-yellow-50 text-yellow-950'
      }`}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
              isHighRisk ? 'bg-red-600' : isMediumRisk ? 'bg-amber-600' : 'bg-yellow-600'
            }`}
          >
            {isHighRisk ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Competitor IP Conflict Alert
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                  isHighRisk
                    ? 'bg-red-200 text-red-900'
                    : isMediumRisk
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-yellow-200 text-yellow-900'
                }`}
              >
                {clashReport.risk_level} Risk
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold">{clashReport.summary}</p>
          </div>
        </div>

        <Link
          to="/competitors"
          className="inline-flex items-center gap-1 self-start rounded-xl border border-current bg-white/80 px-3 py-1.5 text-xs font-semibold backdrop-blur transition hover:bg-white sm:self-center"
        >
          Edit Competitor Registry <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {clashReport.clashes.map((clash, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-black/5 bg-white/75 p-3 text-xs shadow-sm"
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-900">
                Competitor: <strong className="text-emerald-950">{clash.competitor}</strong>
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-700">
                {clash.similarity}% Similarity · {clash.clash_type.replace(/_/g, ' ')}
              </span>
            </div>

            <p className="mt-1.5 text-slate-700">
              <span className="font-semibold text-slate-900">Collision:</span> {clash.context}
            </p>

            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-100/50 p-2 text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                <strong className="font-semibold">Recommended Fix:</strong> {clash.recommendation}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

