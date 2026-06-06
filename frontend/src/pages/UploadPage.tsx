import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardBody, CardHeader, Button, addToast } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { UploadZone, type BillPreviewRaw } from '../components/UploadZone'
import { BillForm, previewToBillFormValues, type BillFormValues } from '../components/BillForm'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'

interface ProblemDetail {
  detail?: string
}

function billFormToConfirmPayload(values: BillFormValues) {
  return {
    resource_type: values.resource_type,
    bill_date: values.bill_date,
    period_start: values.period_start,
    period_end: values.period_end,
    amount_consumed: values.amount_consumed,
    unit: values.unit,
    amount_paid: values.amount_paid,
    currency: values.currency,
  }
}

export function UploadPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [previews, setPreviews] = useState<BillFormValues[]>([])

  function handleResult(rawPreviews: BillPreviewRaw[]) {
    setPreviews((prev) => [...prev, ...rawPreviews.map(previewToBillFormValues)])
  }

  function updatePreview(idx: number, values: BillFormValues) {
    setPreviews((prev) => prev.map((p, i) => (i === idx ? values : p)))
  }

  function discardPreview(idx: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const confirmOneMutation = useMutation({
    mutationFn: (data: BillFormValues) =>
      axiosInstance.post('/bills/confirm', billFormToConfirmPayload(data)),
    onSuccess: (_data, _variables, context) => {
      const idx = context as number
      discardPreview(idx)
      addToast({ title: t('upload.billSaved'), description: t('upload.billSavedDesc'), color: 'success' })
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
    },
    onError: (err) => {
      const problem = (err as { response?: { data?: ProblemDetail } }).response?.data
      addToast({
        title: t('upload.saveFailed'),
        description: problem?.detail ?? t('upload.saveError'),
        color: 'danger',
      })
    },
  })

  const confirmAllMutation = useMutation({
    mutationFn: (data: BillFormValues[]) =>
      Promise.all(data.map((d) => axiosInstance.post('/bills/confirm', billFormToConfirmPayload(d)))),
    onSuccess: () => {
      addToast({ title: t('upload.billSaved'), description: t('upload.billSavedDesc'), color: 'success' })
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
      setPreviews([])
      navigate('/bills')
    },
    onError: (err) => {
      const problem = (err as { response?: { data?: ProblemDetail } }).response?.data
      addToast({
        title: t('upload.saveFailed'),
        description: problem?.detail ?? t('upload.saveError'),
        color: 'danger',
      })
    },
  })

  const isPending = confirmOneMutation.isPending || confirmAllMutation.isPending

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>{t('upload.title')}</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('upload.selectFile')}</h2>
          </CardHeader>
          <CardBody>
            <UploadZone onResult={handleResult} />
          </CardBody>
        </Card>

        {previews.length > 0 && (
          <>
            {previews.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  color="primary"
                  onPress={() => confirmAllMutation.mutate(previews)}
                  isLoading={confirmAllMutation.isPending}
                  isDisabled={isPending}
                >
                  {t('upload.confirmAll')}
                </Button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {previews.map((preview, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                      {t('upload.parsedPreview')} #{idx + 1}
                    </h2>
                  </CardHeader>
                  <CardBody>
                    <BillForm
                      values={preview}
                      onChange={(v) => updatePreview(idx, v)}
                      disabled={isPending}
                    />

                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <Button
                        color="primary"
                        size="sm"
                        onPress={() => confirmOneMutation.mutate(preview, { onSuccess: () => discardPreview(idx) })}
                        isLoading={confirmOneMutation.isPending}
                        isDisabled={isPending}
                      >
                        {t('upload.confirmOne')}
                      </Button>
                      <Button
                        variant="flat"
                        size="sm"
                        onPress={() => discardPreview(idx)}
                        isDisabled={isPending}
                      >
                        {t('upload.discardOne')}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
