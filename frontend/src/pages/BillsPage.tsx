import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Chip } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { BillTable } from '../components/BillTable'
import { BillDetailModal } from '../components/BillDetailModal'
import { ExportModal } from '../components/ExportModal'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'
import type { BillRead } from '../components/BillTable'

type ResourceFilter = 'ALL' | 'ELECTRICITY' | 'GAS' | 'WATER'

interface PaginatedBills {
  items: BillRead[]
  total: number
  page: number
  size: number
  pages: number
}

const PAGE_SIZE = 20

export function BillsPage() {
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('ALL')
  const [page, setPage] = useState(1)
  const [selectedBill, setSelectedBill] = useState<BillRead | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const params = {
    page,
    size: PAGE_SIZE,
    ...(resourceFilter !== 'ALL' ? { resource_type: resourceFilter } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.bills.list(params),
    queryFn: async () => {
      const res = await axiosInstance.get<PaginatedBills>('/bills/', { params })
      return res.data
    },
    placeholderData: (prev) => prev,
  })

  function handleFilterChange(filter: ResourceFilter) {
    setResourceFilter(filter)
    setPage(1)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Bill History</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="flat" onPress={() => setExportOpen(true)}>
            Export PDF
          </Button>
          <Button as={Link} to="/upload" color="primary">
            Upload Bill
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['ALL', 'ELECTRICITY', 'GAS', 'WATER'] as ResourceFilter[]).map((f) => (
          <Chip
            key={f}
            onClick={() => handleFilterChange(f)}
            style={{ cursor: 'pointer' }}
            variant={resourceFilter === f ? 'solid' : 'flat'}
            color={
              f === 'ELECTRICITY' ? 'warning' :
              f === 'GAS' ? 'danger' :
              f === 'WATER' ? 'primary' : 'default'
            }
          >
            {f}
          </Chip>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#687076' }}>Loading…</div>
      ) : (
        <BillTable
          bills={data?.items ?? []}
          total={data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onRowClick={setSelectedBill}
        />
      )}

      <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} />
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
