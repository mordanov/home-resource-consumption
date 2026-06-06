import { useState } from 'react'
import { Tabs, Tab } from '@heroui/react'
import { PredictionCard } from '../components/PredictionCard'

const RESOURCE_TYPES = ['ELECTRICITY', 'GAS', 'WATER']

export function PredictionsPage() {
  const [horizon, setHorizon] = useState<1 | 2 | 3>(1)

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>Consumption Forecasts</h1>

      <div style={{ marginBottom: 24 }}>
        <Tabs
          selectedKey={String(horizon)}
          onSelectionChange={(key) => setHorizon(Number(key) as 1 | 2 | 3)}
          aria-label="Forecast horizon"
        >
          <Tab key="1" title="1 month" />
          <Tab key="2" title="2 months" />
          <Tab key="3" title="3 months" />
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
