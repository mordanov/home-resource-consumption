import { useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
  CheckboxGroup,
  addToast,
} from '@heroui/react'
import axiosInstance from '../lib/axios'

interface Props {
  isOpen: boolean
  onClose: () => void
  defaultDateFrom?: string
  defaultDateTo?: string
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

const ALL_RESOURCES = ['ELECTRICITY', 'GAS', 'WATER']

export function ExportModal({ isOpen, onClose, defaultDateFrom, defaultDateTo }: Props) {
  const today = toDateStr(new Date())
  const yearAgo = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return toDateStr(d) })()

  const [dateFrom, setDateFrom] = useState(defaultDateFrom ?? yearAgo)
  const [dateTo, setDateTo] = useState(defaultDateTo ?? today)
  const [resources, setResources] = useState<string[]>(ALL_RESOURCES)
  const [loading, setLoading] = useState(false)

  const monthDiff =
    (new Date(dateTo).getFullYear() - new Date(dateFrom).getFullYear()) * 12 +
    (new Date(dateTo).getMonth() - new Date(dateFrom).getMonth())

  const rangeError = monthDiff > 24 ? 'Date range cannot exceed 24 months.' : null

  async function handleDownload() {
    if (rangeError || resources.length === 0) return
    setLoading(true)
    try {
      // Use axiosInstance so the Authorization header is sent (token is in-memory, not a cookie)
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
      resources.forEach((r, i) => { params[`resource_type[${i}]`] = r })

      const response = await axiosInstance.get('/exports/report.pdf', {
        params,
        responseType: 'blob',
      })

      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'resource-report.pdf'
      a.click()
      URL.revokeObjectURL(blobUrl)
      onClose()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      addToast({
        title: 'Export failed',
        description: detail ?? 'Could not generate the report.',
        color: 'danger',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        {() => (
          <>
            <ModalHeader>Export PDF Report</ModalHeader>
            <ModalBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.875rem' }}>
                    From{' '}
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      style={{ marginLeft: 4, border: '1px solid #d4d4d8', borderRadius: 6, padding: '2px 6px' }}
                    />
                  </label>
                  <label style={{ fontSize: '0.875rem' }}>
                    To{' '}
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      style={{ marginLeft: 4, border: '1px solid #d4d4d8', borderRadius: 6, padding: '2px 6px' }}
                    />
                  </label>
                </div>

                {rangeError && (
                  <p role="alert" style={{ color: '#f31260', fontSize: '0.875rem' }}>{rangeError}</p>
                )}

                <CheckboxGroup
                  label="Resource types"
                  value={resources}
                  onValueChange={setResources}
                >
                  {ALL_RESOURCES.map((r) => (
                    <Checkbox key={r} value={r}>{r}</Checkbox>
                  ))}
                </CheckboxGroup>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="primary"
                onPress={handleDownload}
                isLoading={loading}
                isDisabled={!!rangeError || resources.length === 0}
              >
                Download PDF
              </Button>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
