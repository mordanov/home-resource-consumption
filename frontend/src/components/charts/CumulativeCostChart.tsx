import { useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@heroui/react'
import { ViewToggle } from './ViewToggle'
import { ChartDataTable } from './ChartDataTable'

interface DataPoint {
  month: string
  cumulative_cost: number
}

interface Props {
  data: DataPoint[]
}

type View = 'chart' | 'table'

const TABLE_COLS = [
  { key: 'month', label: 'Month', align: 'left' as const },
  { key: 'cumulative_cost', label: 'Cumulative cost' },
]

function exportPng(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
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
    canvas.toBlob((b) => { if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; a.click() } })
    URL.revokeObjectURL(url)
  }
  img.src = url
}

export function CumulativeCostChart({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('chart')

  if (data.length < 2) return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 8 }}>
        <ViewToggle view={view} onChange={setView} />
        {view === 'chart' && (
          <Button size="sm" variant="flat" onPress={() => exportPng(ref, 'cumulative-cost.png')}>Export PNG</Button>
        )}
      </div>
      {view === 'chart' ? (
        <div ref={ref}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#006FEE" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#006FEE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="cumulative_cost" stroke="#006FEE" fill="url(#costGradient)" name="Cumulative cost" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartDataTable
          columns={TABLE_COLS}
          rows={data as unknown as Record<string, unknown>[]}
          formatValue={(v, k) => k === 'month' ? String(v) : (v as number).toFixed(2)}
        />
      )}
    </div>
  )
}
