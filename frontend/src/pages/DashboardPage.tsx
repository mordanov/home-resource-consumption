import { Link } from 'react-router-dom'
import { Card, CardBody, CardHeader, Button, Spinner } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import axiosInstance from '../lib/axios'
import { queryKeys } from '../lib/queryKeys'
import type { BillRead } from '../components/BillTable'
import type { AnalyticsSummary } from './AnalysisPage'

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') return <span style={{ color: '#f31260' }}>↑</span>
  if (trend === 'down') return <span style={{ color: '#17c964' }}>↓</span>
  return <span style={{ color: '#687076' }}>→</span>
}

function ResourceCard({ resourceType }: { resourceType: string }) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.bills.list({ resource_type: resourceType, page: 1, size: 2 }),
    queryFn: async () => {
      const res = await axiosInstance.get<{ items: BillRead[] }>('/bills/', {
        params: { resource_type: resourceType, page: 1, size: 2 },
      })
      return res.data.items
    },
  })

  if (isLoading) return <Card><CardBody><Spinner size="sm" /></CardBody></Card>

  const latest = data?.[0]
  const previous = data?.[1]
  const trend: 'up' | 'down' | 'neutral' =
    !latest || !previous
      ? 'neutral'
      : Number(latest.amount_consumed) > Number(previous.amount_consumed)
      ? 'up'
      : Number(latest.amount_consumed) < Number(previous.amount_consumed)
      ? 'down'
      : 'neutral'

  const icons: Record<string, string> = { ELECTRICITY: '⚡', GAS: '🔥', WATER: '💧' }

  return (
    <Card>
      <CardHeader style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: '1.5rem' }}>{icons[resourceType] ?? '📊'}</span>
        <span style={{ fontWeight: 600 }}>{resourceType}</span>
        {latest && <TrendArrow trend={trend} />}
      </CardHeader>
      <CardBody>
        {!latest ? (
          <p style={{ color: '#687076', fontSize: '0.875rem' }}>{t('dashboard.noBills')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
            <span>{t('dashboard.lastBill', { date: latest.bill_date })}</span>
            <span>{t('dashboard.consumed', { value: latest.amount_consumed, unit: latest.unit })}</span>
            <span>{t('dashboard.paid', { value: latest.amount_paid, currency: latest.currency })}</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function pivotForDashboard(pts: Array<{ month: string; resource_type: string; value: string }>) {
  const map = new Map<string, { month: string; electricity?: number; gas?: number; water?: number }>()
  for (const pt of pts) {
    if (!map.has(pt.month)) map.set(pt.month, { month: pt.month })
    const entry = map.get(pt.month)!
    const v = Number(pt.value)
    if (pt.resource_type === 'ELECTRICITY') entry.electricity = v
    else if (pt.resource_type === 'GAS') entry.gas = v
    else if (pt.resource_type === 'WATER') entry.water = v
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function DashboardPage() {
  const { t } = useTranslation()

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: queryKeys.analytics.summary({}),
    queryFn: async () => {
      const res = await axiosInstance.get<AnalyticsSummary>('/analytics/summary')
      return res.data
    },
  })

  const chartData = pivotForDashboard(analytics?.daily_consumption ?? [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{t('dashboard.title')}</h1>
        <Button as={Link} to="/upload" color="primary">
          {t('dashboard.uploadBill')}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {['ELECTRICITY', 'GAS', 'WATER'].map((rt) => (
          <ResourceCard key={rt} resourceType={rt} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('dashboard.trendTitle')}</h2>
        </CardHeader>
        <CardBody>
          {analyticsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Spinner />
            </div>
          ) : chartData.length === 0 ? (
            <p style={{ color: '#687076', textAlign: 'center', padding: 32 }}>
              {t('dashboard.noData')}{' '}
              <Link to="/upload" style={{ color: '#006FEE' }}>{t('dashboard.uploadFirst')}</Link>
              {t('dashboard.uploadFirstSuffix')}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: number) => v.toFixed(3)} />
                <Legend />
                <Line type="monotone" dataKey="electricity" stroke="#f5a524" name={t('dashboard.electricity')} dot={false} />
                <Line type="monotone" dataKey="gas" stroke="#f31260" name={t('dashboard.gas')} dot={false} />
                <Line type="monotone" dataKey="water" stroke="#006FEE" name={t('dashboard.water')} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
