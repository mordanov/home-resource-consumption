import { Card, CardBody, CardHeader, Spinner, Chip } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'

interface PredictionRead {
  resource_type: string
  horizon_months: number
  predicted_consumption: string
  predicted_cost: string
  confidence_interval_lower: string
  confidence_interval_upper: string
  model_version: string
}

interface InsufficientDataDetail {
  detail?: string
  bills_needed?: number
}

interface Props {
  resourceType: string
  horizon: number
}

const RESOURCE_ICONS: Record<string, string> = {
  ELECTRICITY: '⚡',
  GAS: '🔥',
  WATER: '💧',
}

const RESOURCE_COLORS: Record<string, 'warning' | 'danger' | 'primary'> = {
  ELECTRICITY: 'warning',
  GAS: 'danger',
  WATER: 'primary',
}

export function PredictionCard({ resourceType, horizon }: Props) {
  const { t } = useTranslation()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.predictions.byResource(resourceType, horizon),
    queryFn: async () => {
      const res = await axiosInstance.get<PredictionRead[]>(
        `/predictions/${resourceType}?horizon=${horizon}`,
      )
      return res.data[0] ?? null
    },
    retry: false,
  })

  const insufficientError = (error as { response?: { status?: number; data?: InsufficientDataDetail } } | null)
  const is409 = insufficientError?.response?.status === 409
  const billsNeeded = insufficientError?.response?.data?.bills_needed

  return (
    <Card>
      <CardHeader style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: '1.25rem' }}>{RESOURCE_ICONS[resourceType] ?? '📊'}</span>
        <Chip size="sm" color={RESOURCE_COLORS[resourceType] ?? 'default'} variant="flat">
          {resourceType}
        </Chip>
      </CardHeader>
      <CardBody>
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spinner size="sm" />
          </div>
        )}

        {is409 && (
          <div style={{ color: '#687076', fontSize: '0.875rem' }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{t('predictions.insufficientData')}</p>
            <p>
              {billsNeeded !== undefined
                ? t('predictions.needMore', { count: billsNeeded, plural: billsNeeded !== 1 ? 's' : '' })
                : t('predictions.needAtLeast')}
            </p>
          </div>
        )}

        {!isLoading && !error && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#687076', margin: 0 }}>{t('predictions.predictedConsumption')}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {Number(data.predicted_consumption).toFixed(1)}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#687076', margin: 0 }}>
                {t('predictions.range', {
                  lower: Number(data.confidence_interval_lower).toFixed(1),
                  upper: Number(data.confidence_interval_upper).toFixed(1),
                })}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#687076', margin: 0 }}>{t('predictions.predictedCost')}</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                {Number(data.predicted_cost).toFixed(2)}
              </p>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#a1a1aa', margin: 0 }}>
              {t('predictions.model', { version: data.model_version })}
            </p>
          </div>
        )}

        {!isLoading && error && !is409 && (
          <p style={{ color: '#f31260', fontSize: '0.875rem' }}>
            {t('predictions.loadError')}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
