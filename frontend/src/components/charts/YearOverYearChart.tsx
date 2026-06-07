import { useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts'
import { Button } from '@heroui/react'
import { ViewToggle } from './ViewToggle'
import { ChartDataTable } from './ChartDataTable'

interface YoYPoint {
  resource_type: string
  current_year: number
  previous_year: number
  change_pct: number
}

interface Props {
  data: YoYPoint[]
}

type View = 'chart' | 'table'

const TABLE_COLS = [
  { key: 'resource_type', label: 'Resource', align: 'left' as const },
  { key: 'current_year', label: 'Current year' },
  { key: 'previous_year', label: 'Previous year' },
  { key: 'change_pct', label: 'Change %' },
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

export function YearOverYearChart({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('chart')

  if (!data.length) return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 8 }}>
        <ViewToggle view={view} onChange={setView} />
        {view === 'chart' && (
          <Button size="sm" variant="flat" onPress={() => exportPng(ref, 'year-over-year.png')}>Export PNG</Button>
        )}
      </div>
      {view === 'chart' ? (
        <div ref={ref}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="resource_type" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="current_year" fill="#006FEE" name="Current year">
                <LabelList dataKey="change_pct" position="top" formatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`} />
              </Bar>
              <Bar dataKey="previous_year" fill="#a1a1aa" name="Previous year" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartDataTable
          columns={TABLE_COLS}
          rows={data as unknown as Record<string, unknown>[]}
          formatValue={(v, k) => {
            if (k === 'resource_type') return String(v)
            if (k === 'change_pct') return v == null ? '—' : `${(v as number) > 0 ? '+' : ''}${(v as number).toFixed(1)}%`
            return v == null ? '—' : (v as number).toFixed(2)
          }}
        />
      )}
    </div>
  )
}
