import { useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Button, Chip } from '@heroui/react'

interface MonthlyYoYPointRaw {
  month: string
  resource_type: string
  current_consumption: string
  prev_year_consumption: string | null
  consumption_change_pct: string | null
  current_cost: string
  prev_year_cost: string | null
  cost_change_pct: string | null
}

interface Props {
  data: MonthlyYoYPointRaw[]
}

type Mode = 'consumption' | 'cost'
type Resource = 'ELECTRICITY' | 'GAS' | 'WATER'

const COLORS: Record<Resource, string> = {
  ELECTRICITY: '#f5a524',
  GAS: '#f31260',
  WATER: '#006FEE',
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
    canvas.toBlob((b) => {
      if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; a.click() }
    })
    URL.revokeObjectURL(url)
  }
  img.src = url
}

export function MonthlyYoYChart({ data }: Props) {
  const [mode, setMode] = useState<Mode>('consumption')
  const availableResources = (['ELECTRICITY', 'GAS', 'WATER'] as Resource[]).filter(
    (r) => data.some((d) => d.resource_type === r),
  )
  const [resource, setResource] = useState<Resource>(
    () => availableResources[0] ?? 'ELECTRICITY',
  )
  const ref = useRef<HTMLDivElement>(null)

  if (!data.length) {
    return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>
  }

  const filtered = data.filter((d) => d.resource_type === resource)
  const hasData = filtered.length > 0

  const chartData = filtered.map((d) => {
    const current = mode === 'consumption' ? Number(d.current_consumption) : Number(d.current_cost)
    const prev = mode === 'consumption'
      ? (d.prev_year_consumption != null ? Number(d.prev_year_consumption) : null)
      : (d.prev_year_cost != null ? Number(d.prev_year_cost) : null)
    const pct = mode === 'consumption' ? d.consumption_change_pct : d.cost_change_pct
    return { month: d.month, current, prev, pct: pct != null ? Number(pct) : null }
  })

  const hasAnyPrev = chartData.some((d) => d.prev != null)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['ELECTRICITY', 'GAS', 'WATER'] as Resource[]).map((r) => (
          <Chip
            key={r}
            style={{
              cursor: availableResources.includes(r) ? 'pointer' : 'default',
              opacity: resource === r ? 1 : availableResources.includes(r) ? 0.55 : 0.2,
            }}
            onClick={() => availableResources.includes(r) && setResource(r)}
            variant="flat"
          >
            {r}
          </Chip>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Chip
            style={{ cursor: 'pointer' }}
            variant={mode === 'consumption' ? 'solid' : 'flat'}
            onClick={() => setMode('consumption')}
          >
            Consumption
          </Chip>
          <Chip
            style={{ cursor: 'pointer' }}
            variant={mode === 'cost' ? 'solid' : 'flat'}
            onClick={() => setMode('cost')}
          >
            Cost
          </Chip>
          <Button size="sm" variant="flat" onPress={() => exportPng(ref, `monthly-yoy-${resource}-${mode}.png`)}>
            Export PNG
          </Button>
        </div>
      </div>
      {!hasData && (
        <p style={{ color: '#687076', textAlign: 'center', padding: '24px 0' }}>
          No data for {resource} in the selected period.
        </p>
      )}
      <div ref={ref} style={{ display: hasData ? undefined : 'none' }}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="val" />
            {chartData.some((d) => d.pct != null) && (
              <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v}%`} />
            )}
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'Change %' ? [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, name] : [value.toFixed(2), name]
              }
            />
            <Legend />
            <Bar yAxisId="val" dataKey="current" name="Current year" fill={COLORS[resource]} />
            {hasAnyPrev && (
              <Bar yAxisId="val" dataKey="prev" name="Year ago" fill="#a1a1aa" />
            )}
            {chartData.some((d) => d.pct != null) && (
              <>
                <ReferenceLine yAxisId="pct" y={0} stroke="#687076" strokeDasharray="3 3" />
                <Bar
                  yAxisId="pct"
                  dataKey="pct"
                  name="Change %"
                  fill="none"
                  stroke="#17c964"
                  label={{
                    position: 'top',
                    fontSize: 10,
                    formatter: (v: number) => v != null ? `${v > 0 ? '+' : ''}${v.toFixed(0)}%` : '',
                  }}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
