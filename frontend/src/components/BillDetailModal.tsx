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
import { useTranslation } from 'react-i18next'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'
import { BillForm, previewToBillFormValues, type BillFormValues } from './BillForm'
import type { BillRead } from './BillTable'

interface ProblemDetail {
  detail?: string
}

interface Props {
  bill: BillRead | null
  onClose: () => void
}

type ModalMode = 'view' | 'edit' | 'confirmDelete'

export function BillDetailModal({ bill, onClose }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<ModalMode>('view')
  const [editValues, setEditValues] = useState<BillFormValues | null>(null)

  function handleClose() {
    setMode('view')
    setEditValues(null)
    onClose()
  }

  function enterEdit() {
    if (!bill) return
    setEditValues(
      previewToBillFormValues({
        resource_type: bill.resource_type,
        bill_date: bill.bill_date,
        period_start: bill.period_start,
        period_end: bill.period_end,
        amount_consumed: bill.amount_consumed,
        unit: bill.unit,
        amount_paid: bill.amount_paid,
        currency: bill.currency,
      }),
    )
    setMode('edit')
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/bills/${id}`),
    onSuccess: () => {
      addToast({ title: t('billDetail.deleted'), color: 'success' })
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
      setMode('view')
      onClose()
    },
    onError: (err) => {
      const problem = (err as { response?: { data?: ProblemDetail } }).response?.data
      addToast({
        title: t('billDetail.deleteFailed'),
        description: problem?.detail ?? t('billDetail.error'),
        color: 'danger',
      })
      setMode('view')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BillFormValues }) =>
      axiosInstance.patch(`/bills/${id}`, {
        resource_type: data.resource_type || undefined,
        bill_date: data.bill_date || undefined,
        period_start: data.period_start || undefined,
        period_end: data.period_end || undefined,
        amount_consumed: data.amount_consumed ? Number(data.amount_consumed) : undefined,
        unit: data.unit || undefined,
        amount_paid: data.amount_paid !== '' ? Number(data.amount_paid) : undefined,
        currency: data.currency || undefined,
      }),
    onSuccess: () => {
      addToast({ title: t('billDetail.updated'), color: 'success' })
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
      setMode('view')
      setEditValues(null)
      onClose()
    },
    onError: (err) => {
      const problem = (err as { response?: { data?: ProblemDetail } }).response?.data
      addToast({
        title: t('billDetail.updateFailed'),
        description: problem?.detail ?? t('billDetail.error'),
        color: 'danger',
      })
    },
  })

  const isPending = deleteMutation.isPending || updateMutation.isPending

  const viewFields = bill
    ? [
        [t('billDetail.resourceType'), bill.resource_type],
        [t('billDetail.billDate'), bill.bill_date],
        [t('billDetail.periodStart'), bill.period_start],
        [t('billDetail.periodEnd'), bill.period_end],
        [t('billDetail.amountConsumed'), `${bill.amount_consumed} ${bill.unit}`],
        [t('billDetail.amountPaid'), `${bill.amount_paid} ${bill.currency}`],
        [t('billDetail.created'), new Date(bill.created_at).toLocaleString()],
      ]
    : []

  return (
    <Modal isOpen={!!bill} onClose={handleClose} size="md">
      <ModalContent>
        {() => (
          <>
            <ModalHeader>{t('billDetail.title')}</ModalHeader>
            <ModalBody>
              {mode === 'view' && (
                viewFields.map(([label, value]) => (
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
              )}

              {mode === 'edit' && editValues && (
                <BillForm
                  values={editValues}
                  onChange={setEditValues}
                  disabled={isPending}
                />
              )}

              {mode === 'confirmDelete' && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <p style={{ fontSize: '1.25rem', marginBottom: 8 }}>🗑️</p>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{t('billDetail.deleteConfirmTitle')}</p>
                  <p style={{ color: '#687076', fontSize: '0.875rem' }}>{t('billDetail.deleteConfirmDesc')}</p>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              {mode === 'view' && (
                <>
                  <Button variant="flat" color="primary" onPress={enterEdit}>
                    {t('billDetail.edit')}
                  </Button>
                  <Button color="danger" variant="flat" onPress={() => setMode('confirmDelete')}>
                    {t('billDetail.delete')}
                  </Button>
                  <Button variant="flat" onPress={handleClose}>
                    {t('billDetail.close')}
                  </Button>
                </>
              )}

              {mode === 'edit' && (
                <>
                  <Button
                    color="primary"
                    onPress={() => bill && editValues && updateMutation.mutate({ id: bill.id, data: editValues })}
                    isLoading={updateMutation.isPending}
                    isDisabled={isPending}
                  >
                    {t('billDetail.save')}
                  </Button>
                  <Button
                    variant="flat"
                    onPress={() => setMode('view')}
                    isDisabled={isPending}
                  >
                    {t('billDetail.cancel')}
                  </Button>
                </>
              )}

              {mode === 'confirmDelete' && (
                <>
                  <Button
                    color="danger"
                    onPress={() => bill && deleteMutation.mutate(bill.id)}
                    isLoading={deleteMutation.isPending}
                    isDisabled={isPending}
                  >
                    {t('billDetail.delete')}
                  </Button>
                  <Button
                    variant="flat"
                    onPress={() => setMode('view')}
                    isDisabled={isPending}
                  >
                    {t('billDetail.cancel')}
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
