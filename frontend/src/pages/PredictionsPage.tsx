import { useState } from 'react'
import { Tabs, Tab } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { PredictionCard } from '../components/PredictionCard'

const RESOURCE_TYPES = ['ELECTRICITY', 'GAS', 'WATER']

export function PredictionsPage() {
  const { t } = useTranslation()
  const [horizon, setHorizon] = useState<1 | 2 | 3>(1)

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>{t('predictions.title')}</h1>

      <div style={{ marginBottom: 24 }}>
        <Tabs
          selectedKey={String(horizon)}
          onSelectionChange={(key) => setHorizon(Number(key) as 1 | 2 | 3)}
          aria-label="Forecast horizon"
        >
          <Tab key="1" title={t('predictions.horizon1')} />
          <Tab key="2" title={t('predictions.horizon2')} />
          <Tab key="3" title={t('predictions.horizon3')} />
        </Tabs>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {RESOURCE_TYPES.map((rt) => (
          <PredictionCard key={rt} resourceType={rt} horizon={horizon} />
        ))}
      </div>
    </div>
  )
}
