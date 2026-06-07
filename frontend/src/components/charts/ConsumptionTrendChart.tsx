import { useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button, Chip } from '@heroui/react'

interface DataPoint {
  month: string
  ELECTRICITY?: number
  GAS?: number
  WATER?: number
}

interface Props {
  data: DataPoint[]
}

type Resource = 'ELECTRICITY' | 'GAS' | 'WATER'

const COLORS: Record<Resource, string> = {
  ELECTRICITY: '#f5a524',
  GAS: '#f31260',
  WATER: '#006FEE',
}

export function ConsumptionTrendChart({ data }: Props) {
  const [active, setActive] = useState<Set<Resource>>(new Set(['ELECTRICITY', 'GAS', 'WATER']))
  const ref = useRef<HTMLDivElement>(null)

  function toggleResource(r: Resource) {
    setActive((prev) => {
      const next = new Set(prev)
      next.has(r) ? next.delete(r) : next.add(r)
      return next
    })
  }

  function exportPng() {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      canvas.toBlob((b) => { if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'consumption-trend.png'; a.click() } })
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  if (data.length < 2) return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['ELECTRICITY', 'GAS', 'WATER'] as Resource[]).map((r) => (
          <Chip
            key={r}
            style={{ cursor: 'pointer', opacity: active.has(r) ? 1 : 0.4 }}
            onClick={() => toggleResource(r)}
            variant="flat"
          >
            {r}
          </Chip>
        ))}
        <Button size="sm" variant="flat" onPress={exportPng} style={{ marginLeft: 'auto' }}>
          Export PNG
        </Button>
      </div>
      <div ref={ref}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v: number) => v.toFixed(3)} />
            <Legend />
            {(['ELECTRICITY', 'GAS', 'WATER'] as Resource[]).filter((r) => active.has(r)).map((r) => (
              <Line key={r} type="monotone" dataKey={r} stroke={COLORS[r]} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
