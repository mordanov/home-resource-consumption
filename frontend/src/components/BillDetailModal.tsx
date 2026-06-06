import { useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  addToast,
} from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'
import type { BillRead } from './BillTable'

interface ProblemDetail {
  detail?: string
}

interface Props {
  bill: BillRead | null
  onClose: () => void
}

export function BillDetailModal({ bill, onClose }: Props) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/bills/${id}`),
    onSuccess: () => {
      addToast({ title: 'Bill deleted', color: 'success' })
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
      setConfirming(false)
      onClose()
    },
    onError: (err) => {
      const problem = (err as { response?: { data?: ProblemDetail } }).response?.data
      addToast({
        title: 'Delete failed',
        description: problem?.detail ?? 'An error occurred.',
        color: 'danger',
      })
      setConfirming(false)
    },
  })

  function handleClose() {
    setConfirming(false)
    onClose()
  }

  const fields = bill
    ? [
        ['Resource type', bill.resource_type],
        ['Bill date', bill.bill_date],
        ['Period start', bill.billing_period_start],
        ['Period end', bill.billing_period_end],
        ['Amount consumed', `${bill.amount_consumed} ${bill.unit}`],
        ['Amount paid', `${bill.amount_paid} ${bill.currency}`],
        bill.provider ? ['Provider', bill.provider] : null,
        ['Created', new Date(bill.created_at).toLocaleString()],
      ].filter((x): x is [string, string] => x !== null)
    : []

  return (
    <Modal isOpen={!!bill} onClose={handleClose} size="md">
      <ModalContent>
        {() => (
          <>
            <ModalHeader>Bill detail</ModalHeader>
            <ModalBody>
              {!confirming ? (
                fields.map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f4f4f5',
                      paddingBottom: 8,
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ color: '#687076' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <p style={{ fontSize: '1.25rem', marginBottom: 8 }}>🗑️</p>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>Delete this bill?</p>
                  <p style={{ color: '#687076', fontSize: '0.875rem' }}>This cannot be undone.</p>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              {!confirming ? (
                <>
                  <Button
                    color="danger"
                    variant="flat"
                    onPress={() => setConfirming(true)}
                  >
                    Delete
                  </Button>
                  <Button variant="flat" onPress={handleClose}>
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    color="danger"
                    onPress={() => bill && deleteMutation.mutate(bill.id)}
                    isLoading={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="flat"
                    onPress={() => setConfirming(false)}
                    isDisabled={deleteMutation.isPending}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
