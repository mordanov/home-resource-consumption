import { useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button } from '@heroui/react'
import { ViewToggle } from './ViewToggle'
import { ChartDataTable } from './ChartDataTable'

interface DataPoint {
  month: string
  ELECTRICITY?: number
  GAS?: number
  WATER?: number
}

interface Props {
  data: DataPoint[]
}

type View = 'chart' | 'table'

const TABLE_COLS = [
  { key: 'month', label: 'Month', align: 'left' as const },
  { key: 'ELECTRICITY', label: 'Electricity (price/unit)' },
  { key: 'GAS', label: 'Gas (price/unit)' },
  { key: 'WATER', label: 'Water (price/unit)' },
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

export function PricePerUnitChart({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('chart')

  if (data.length < 2) return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 8 }}>
        <ViewToggle view={view} onChange={setView} />
        {view === 'chart' && (
          <Button size="sm" variant="flat" onPress={() => exportPng(ref, 'price-per-unit.png')}>Export PNG</Button>
        )}
      </div>
      {view === 'chart' ? (
        <div ref={ref}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ELECTRICITY" stroke="#f5a524" dot={false} name="Electricity (price/unit)" />
              <Line type="monotone" dataKey="GAS" stroke="#f31260" dot={false} name="Gas (price/unit)" />
              <Line type="monotone" dataKey="WATER" stroke="#006FEE" dot={false} name="Water (price/unit)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartDataTable
          columns={TABLE_COLS}
          rows={data as unknown as Record<string, unknown>[]}
          formatValue={(v, k) => k === 'month' ? String(v) : v == null ? '—' : (v as number).toFixed(4)}
        />
      )}
    </div>
  )
}
