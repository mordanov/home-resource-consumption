import { useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts'
import { Button } from '@heroui/react'

interface YoYPoint {
  resource_type: string
  current_year: number
  previous_year: number
  change_pct: number
}

interface Props {
  data: YoYPoint[]
}

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
  if (!data.length) return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="sm" variant="flat" onPress={() => exportPng(ref, 'year-over-year.png')}>Export PNG</Button>
      </div>
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
    </div>
  )
}
