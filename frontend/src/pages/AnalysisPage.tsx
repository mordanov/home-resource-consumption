import { useState } from 'react'
import { Card, CardBody, CardHeader, Button, Chip, Spinner } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ConsumptionTrendChart } from '../components/charts/ConsumptionTrendChart'
import { MonthlyCostChart } from '../components/charts/MonthlyCostChart'
import { PricePerUnitChart } from '../components/charts/PricePerUnitChart'
import { YearOverYearChart } from '../components/charts/YearOverYearChart'
import { CumulativeCostChart } from '../components/charts/CumulativeCostChart'
import { ConsumptionHeatmap } from '../components/charts/ConsumptionHeatmap'
import { ExportModal } from '../components/ExportModal'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'

export interface AnalyticsSummary {
  monthly_consumption: Array<{ month: string; ELECTRICITY?: number; GAS?: number; WATER?: number }>
  monthly_cost: Array<{ month: string; ELECTRICITY?: number; GAS?: number; WATER?: number }>
  price_per_unit: Array<{ month: string; ELECTRICITY?: number; GAS?: number; WATER?: number }>
  year_over_year: Array<{ resource_type: string; current_year: number; previous_year: number; change_pct: number }>
  cumulative_cost_ytd: Array<{ month: string; cumulative_cost: number }>
  consumption_heatmap: Record<string, Array<{ month: string; value: number }>>
}

type ResourceFilter = 'ALL' | 'ELECTRICITY' | 'GAS' | 'WATER'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function defaultDateFrom() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return toDateStr(d)
}

export function AnalysisPage() {
  const { t } = useTranslation()
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('ALL')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(() => toDateStr(new Date()))
  const [exportOpen, setExportOpen] = useState(false)

  const params = {
    date_from: dateFrom,
    date_to: dateTo,
    ...(resourceFilter !== 'ALL' ? { resource_type: resourceFilter } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics.summary(params),
    queryFn: async () => {
      const res = await axiosInstance.get<AnalyticsSummary>('/analytics/summary', { params })
      return res.data
    },
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{t('analysis.title')}</h1>
        <Button color="primary" onPress={() => setExportOpen(true)}>
          {t('analysis.exportReport')}
        </Button>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <CardBody>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['ALL', 'ELECTRICITY', 'GAS', 'WATER'] as ResourceFilter[]).map((f) => (
                <Chip
                  key={f}
                  onClick={() => setResourceFilter(f)}
                  style={{ cursor: 'pointer' }}
                  variant={resourceFilter === f ? 'solid' : 'flat'}
                >
                  {f}
                </Chip>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem' }}>
                {t('analysis.from')}{' '}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ marginLeft: 4, border: '1px solid #d4d4d8', borderRadius: 6, padding: '2px 6px' }}
                />
              </label>
              <label style={{ fontSize: '0.875rem' }}>
                {t('analysis.to')}{' '}
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ marginLeft: 4, border: '1px solid #d4d4d8', borderRadius: 6, padding: '2px 6px' }}
                />
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spinner />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 24 }}>
          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.trendTitle')}</h2></CardHeader>
            <CardBody><ConsumptionTrendChart data={data?.monthly_consumption ?? []} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.costTitle')}</h2></CardHeader>
            <CardBody><MonthlyCostChart data={data?.monthly_cost ?? []} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.priceTitle')}</h2></CardHeader>
            <CardBody><PricePerUnitChart data={data?.price_per_unit ?? []} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.yoyTitle')}</h2></CardHeader>
            <CardBody><YearOverYearChart data={data?.year_over_year ?? []} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.cumulativeTitle')}</h2></CardHeader>
            <CardBody><CumulativeCostChart data={data?.cumulative_cost_ytd ?? []} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.heatmapTitle')}</h2></CardHeader>
            <CardBody><ConsumptionHeatmap data={data?.consumption_heatmap ?? {}} /></CardBody>
          </Card>
        </div>
      )}

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
      />
    </div>
  )
}
