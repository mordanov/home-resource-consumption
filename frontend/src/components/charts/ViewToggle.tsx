import { Chip } from '@heroui/react'

type View = 'chart' | 'table'

interface Props {
  view: View
  onChange: (v: View) => void
}

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <Chip
        style={{ cursor: 'pointer' }}
        variant={view === 'chart' ? 'solid' : 'flat'}
        onClick={() => onChange('chart')}
      >
        Chart
      </Chip>
      <Chip
        style={{ cursor: 'pointer' }}
        variant={view === 'table' ? 'solid' : 'flat'}
        onClick={() => onChange('table')}
      >
        Table
      </Chip>
    </div>
  )
}
