import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Pagination,
} from '@heroui/react'

export interface BillRead {
  id: string
  resource_type: string
  billing_period_start: string
  billing_period_end: string
  bill_date: string
  amount_consumed: string
  unit: string
  amount_paid: string
  currency: string
  provider?: string
  created_at: string
}

const RESOURCE_COLORS: Record<string, 'warning' | 'danger' | 'primary'> = {
  ELECTRICITY: 'warning',
  GAS: 'danger',
  WATER: 'primary',
}

interface Props {
  bills: BillRead[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onRowClick: (bill: BillRead) => void
}

export function BillTable({ bills, total, page, pageSize, onPageChange, onRowClick }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))

  if (bills.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#687076' }}>
        <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>📭</p>
        <p>No bills found. Upload your first bill.</p>
      </div>
    )
  }

  return (
    <div>
      <Table
        aria-label="Bills history table"
        selectionMode="single"
        onRowAction={(key) => {
          const bill = bills.find((b) => b.id === key)
          if (bill) onRowClick(bill)
        }}
      >
        <TableHeader>
          <TableColumn>Date</TableColumn>
          <TableColumn>Resource</TableColumn>
          <TableColumn>Period</TableColumn>
          <TableColumn>Consumed</TableColumn>
          <TableColumn>Paid</TableColumn>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => (
            <TableRow key={bill.id} style={{ cursor: 'pointer' }}>
              <TableCell>{bill.bill_date}</TableCell>
              <TableCell>
                <Chip size="sm" color={RESOURCE_COLORS[bill.resource_type] ?? 'default'} variant="flat">
                  {bill.resource_type}
                </Chip>
              </TableCell>
              <TableCell>
                {bill.billing_period_start} – {bill.billing_period_end}
              </TableCell>
              <TableCell>{bill.amount_consumed} {bill.unit}</TableCell>
              <TableCell>{bill.amount_paid} {bill.currency}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Pagination total={pages} page={page} onChange={onPageChange} />
        </div>
      )}
    </div>
  )
}
