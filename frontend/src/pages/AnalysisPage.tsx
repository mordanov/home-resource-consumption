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
import { MonthlyYoYChart } from '../components/charts/MonthlyYoYChart'
import { ExportModal } from '../components/ExportModal'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'

// Raw shapes returned by the API (Decimal fields serialized as strings by Pydantic)
interface MonthlyDataPointRaw {
  month: string
  resource_type: string
  value: string
}
interface YoYPointRaw {
  resource_type: string
  current_year: string
  previous_year: string
  change_pct: string | null
}
interface CumulativeCostPointRaw {
  month: string
  resource_type: string
  cumulative_cost: string
}

interface MonthlyYoYPointRaw {
  month: string
  resource_type: string
  current_consumption: string
  prev_year_consumption: string | null
  consumption_change_pct: string | null
  current_cost: string
  prev_year_cost: string | null
  cost_change_pct: string | null
}

export interface AnalyticsSummary {
  monthly_consumption: MonthlyDataPointRaw[]
  daily_consumption: MonthlyDataPointRaw[]
  monthly_cost: MonthlyDataPointRaw[]
  price_per_unit: MonthlyDataPointRaw[]
  year_over_year: YoYPointRaw[]
  cumulative_cost_ytd: CumulativeCostPointRaw[]
  monthly_yoy: MonthlyYoYPointRaw[]
}

type PivotedPoint = { month: string; ELECTRICITY?: number; GAS?: number; WATER?: number }

function pivotMonthly(pts: MonthlyDataPointRaw[]): PivotedPoint[] {
  const map = new Map<string, PivotedPoint>()
  for (const pt of pts) {
    if (!map.has(pt.month)) map.set(pt.month, { month: pt.month })
    ;(map.get(pt.month) as Record<string, unknown>)[pt.resource_type] = Number(pt.value)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

function transformYoY(pts: YoYPointRaw[]) {
  return pts.map((p) => ({
    resource_type: p.resource_type,
    current_year: Number(p.current_year),
    previous_year: Number(p.previous_year),
    change_pct: p.change_pct != null ? Number(p.change_pct) : 0,
  }))
}

function aggregateCumulative(pts: CumulativeCostPointRaw[]) {
  const map = new Map<string, number>()
  for (const pt of pts) {
    map.set(pt.month, (map.get(pt.month) ?? 0) + Number(pt.cumulative_cost))
  }
  return [...map.entries()]
    .map(([month, cumulative_cost]) => ({ month, cumulative_cost }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

function buildHeatmap(pts: MonthlyDataPointRaw[]): Record<string, Array<{ month: string; value: number }>> {
  const map: Record<string, Array<{ month: string; value: number }>> = {}
  for (const pt of pts) {
    if (!map[pt.resource_type]) map[pt.resource_type] = []
    map[pt.resource_type].push({ month: pt.month, value: Number(pt.value) })
  }
  return map
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
            <CardBody>
              <ConsumptionTrendChart
                totalData={pivotMonthly(data?.monthly_consumption ?? [])}
                dailyData={pivotMonthly(data?.daily_consumption ?? [])}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.costTitle')}</h2></CardHeader>
            <CardBody><MonthlyCostChart data={pivotMonthly(data?.monthly_cost ?? [])} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.priceTitle')}</h2></CardHeader>
            <CardBody><PricePerUnitChart data={pivotMonthly(data?.price_per_unit ?? [])} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.yoyTitle')}</h2></CardHeader>
            <CardBody><YearOverYearChart data={transformYoY(data?.year_over_year ?? [])} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.cumulativeTitle')}</h2></CardHeader>
            <CardBody><CumulativeCostChart data={aggregateCumulative(data?.cumulative_cost_ytd ?? [])} /></CardBody>
          </Card>

          <Card>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.heatmapTitle')}</h2></CardHeader>
            <CardBody>
              <ConsumptionHeatmap
                totalData={data ? buildHeatmap(data.monthly_consumption) : {}}
                dailyData={data ? buildHeatmap(data.daily_consumption) : {}}
              />
            </CardBody>
          </Card>

          <Card style={{ gridColumn: '1 / -1' }}>
            <CardHeader><h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('analysis.monthlyYoYTitle')}</h2></CardHeader>
            <CardBody><MonthlyYoYChart data={data?.monthly_yoy ?? []} /></CardBody>
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
