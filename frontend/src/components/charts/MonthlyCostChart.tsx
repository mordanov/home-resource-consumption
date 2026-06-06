import { useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button } from '@heroui/react'

interface DataPoint {
  month: string
  ELECTRICITY?: number
  GAS?: number
  WATER?: number
}

interface Props {
  data: DataPoint[]
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

export function MonthlyCostChart({ data }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  if (data.length < 2) return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="sm" variant="flat" onPress={() => exportPng(ref, 'monthly-cost.png')}>Export PNG</Button>
      </div>
      <div ref={ref}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="ELECTRICITY" stackId="a" fill="#f5a524" />
            <Bar dataKey="GAS" stackId="a" fill="#f31260" />
            <Bar dataKey="WATER" stackId="a" fill="#006FEE" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
