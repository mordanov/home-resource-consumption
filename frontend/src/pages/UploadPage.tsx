import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardBody, CardHeader, Button, addToast } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UploadZone } from '../components/UploadZone'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'

interface BillPreview {
  resource_type: string
  billing_period_start: string
  billing_period_end: string
  bill_date: string
  amount_consumed: string
  unit: string
  amount_paid: string
  currency: string
  provider?: string
}

interface ProblemDetail {
  detail?: string
}

export function UploadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<BillPreview | null>(null)

  const confirmMutation = useMutation({
    mutationFn: (data: BillPreview) => axiosInstance.post('/bills/confirm', data),
    onSuccess: () => {
      addToast({ title: 'Bill saved', description: 'Your bill has been added to history.', color: 'success' })
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
      navigate('/bills')
    },
    onError: (err) => {
      const problem = (err as { response?: { data?: ProblemDetail } }).response?.data
      addToast({
        title: 'Could not save bill',
        description: problem?.detail ?? 'An error occurred.',
        color: 'danger',
      })
    },
  })

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Upload Bill</h1>

      <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: 24, maxWidth: 900 }}>
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Select file</h2>
          </CardHeader>
          <CardBody>
            <UploadZone onResult={(data) => setPreview(data as BillPreview)} />
          </CardBody>
        </Card>

        {preview && (
          <Card>
            <CardHeader>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Parsed preview</h2>
            </CardHeader>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                {[
                  ['Resource', preview.resource_type],
                  ['Period start', preview.billing_period_start],
                  ['Period end', preview.billing_period_end],
                  ['Bill date', preview.bill_date],
                  ['Consumed', `${preview.amount_consumed} ${preview.unit}`],
                  ['Paid', `${preview.amount_paid} ${preview.currency}`],
                  preview.provider ? ['Provider', preview.provider] : null,
                ]
                  .filter((x): x is [string, string] => x !== null)
                  .map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: 4 }}>
                      <span style={{ color: '#687076' }}>{label}</span>
                      <span style={{ fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <Button
                  color="primary"
                  onPress={() => confirmMutation.mutate(preview)}
                  isLoading={confirmMutation.isPending}
                >
                  Confirm & Save
                </Button>
                <Button
                  variant="flat"
                  onPress={() => setPreview(null)}
                  isDisabled={confirmMutation.isPending}
                >
                  Discard
                </Button>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
