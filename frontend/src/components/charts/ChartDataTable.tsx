interface Column {
  key: string
  label: string
  align?: 'left' | 'right'
}

interface Props {
  columns: Column[]
  rows: Record<string, unknown>[]
  formatValue?: (value: unknown, colKey: string) => string
}

function defaultFormat(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return String(value)
}

export function ChartDataTable({ columns, rows, formatValue }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '6px 10px',
                  textAlign: col.align ?? 'right',
                  fontWeight: 600,
                  borderBottom: '2px solid #e4e4e7',
                  whiteSpace: 'nowrap',
                  color: '#3f3f46',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#fafafa' }}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '5px 10px',
                    textAlign: col.align ?? 'right',
                    borderBottom: '1px solid #f0f0f0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatValue
                    ? formatValue(row[col.key], col.key)
                    : defaultFormat(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
