import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const DIMENSION_LABELS = {
  formality: 'Formality',
  warmth: 'Warmth',
  confidence: 'Confidence',
  urgency: 'Urgency',
  technicality: 'Technicality',
}

export default function ToneRadarChart({ detected = {}, target = {} }) {
  const data = Object.keys(DIMENSION_LABELS).map((key) => ({
    dimension: DIMENSION_LABELS[key],
    detected: detected[key] ?? 50,
    target: target[key] ?? 50,
  }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '1rem',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 500 }}
          />
          <Radar
            name="Detected Tone"
            dataKey="detected"
            stroke="#059669"
            fill="#10b981"
            fillOpacity={0.45}
          />
          <Radar
            name="Brand Target"
            dataKey="target"
            stroke="#f59e0b"
            fill="#fbbf24"
            fillOpacity={0.15}
            strokeDasharray="4 4"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

