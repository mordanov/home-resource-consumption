import { useRef, useState } from 'react'
import { Button, Chip } from '@heroui/react'

interface HeatmapCell {
  month: string
  value: number
}

interface Props {
  totalData: Record<string, HeatmapCell[]>
  dailyData: Record<string, HeatmapCell[]>
}

type Resource = 'ELECTRICITY' | 'GAS' | 'WATER'
type Mode = 'total' | 'daily'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function valueToColor(value: number, min: number, max: number): string {
  if (max === min) return '#e0f2fe'
  const t = (value - min) / (max - min)
  const r = Math.round(lerp(224, 3, t))
  const g = Math.round(lerp(242, 105, t))
  const b = Math.round(lerp(254, 25, t))
  return `rgb(${r},${g},${b})`
}

export function ConsumptionHeatmap({ totalData, dailyData }: Props) {
  const [resource, setResource] = useState<Resource>('ELECTRICITY')
  const [mode, setMode] = useState<Mode>('total')
  const ref = useRef<HTMLDivElement>(null)

  const data = mode === 'daily' ? dailyData : totalData
  const cells = data[resource] ?? []
  const values = cells.map((c) => c.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  const decimals = mode === 'daily' ? 3 : 0

  function exportData() {
    const text = cells.map((c) => `${c.month}: ${c.value.toFixed(decimals)}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `heatmap-${resource.toLowerCase()}-${mode}.txt`
    a.click()
  }

  if (!cells.length) return <p style={{ color: '#687076', textAlign: 'center' }}>Not enough data to display this chart.</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['ELECTRICITY', 'GAS', 'WATER'] as Resource[]).map((r) => (
          <Chip
            key={r}
            style={{ cursor: 'pointer', opacity: resource === r ? 1 : 0.4 }}
            onClick={() => setResource(r)}
            variant="flat"
          >
            {r}
          </Chip>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Chip
            style={{ cursor: 'pointer' }}
            variant={mode === 'total' ? 'solid' : 'flat'}
            onClick={() => setMode('total')}
          >
            Total
          </Chip>
          <Chip
            style={{ cursor: 'pointer' }}
            variant={mode === 'daily' ? 'solid' : 'flat'}
            onClick={() => setMode('daily')}
          >
            Per day
          </Chip>
          <Button size="sm" variant="flat" onPress={exportData}>
            Export
          </Button>
        </div>
      </div>
      <div ref={ref} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
        {cells.map((cell) => (
          <div
            key={cell.month}
            title={`${cell.month}: ${cell.value.toFixed(decimals)}`}
            style={{
              background: valueToColor(cell.value, min, max),
              borderRadius: 6,
              padding: '12px 4px',
              textAlign: 'center',
              fontSize: '0.7rem',
              color: '#11181c',
            }}
          >
            <div style={{ fontWeight: 600 }}>{cell.month.slice(-5)}</div>
            <div>{cell.value.toFixed(decimals)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: '0.75rem', color: '#687076' }}>
        <span style={{ background: valueToColor(min, min, max), borderRadius: 3, padding: '2px 8px' }}>Low</span>
        <span style={{ background: valueToColor(max, min, max), borderRadius: 3, padding: '2px 8px', color: '#fff' }}>High</span>
      </div>
    </div>
  )
}
