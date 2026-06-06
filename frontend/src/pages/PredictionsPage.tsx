import { useState } from 'react'
import { Tabs, Tab, Card, CardBody, Select, SelectItem, Input, Divider } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { PredictionCard, type ModelParams } from '../components/PredictionCard'

const RESOURCE_TYPES = ['ELECTRICITY', 'GAS', 'WATER']

const DEFAULT_PARAMS: ModelParams = {
  model: 'linear_regression',
  ci_quantile: 0.05,
  n_resamples: 100,
  window: 3,
  alpha: 0.7,
}

export function PredictionsPage() {
  const { t } = useTranslation()
  const [horizon, setHorizon] = useState<1 | 2 | 3>(1)
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS)

  function update<K extends keyof ModelParams>(key: K, value: ModelParams[K]) {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 24 }}>{t('predictions.title')}</h1>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-start' }}>
        {/* Horizon */}
        <div>
          <p style={{ fontSize: '0.75rem', color: '#687076', marginBottom: 6 }}>{t('predictions.horizonLabel')}</p>
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

        {/* Model selector + params */}
        <Card style={{ flex: '1 1 360px' }}>
          <CardBody>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 12 }}>{t('predictions.modelSettings')}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Select
                label={t('predictions.modelLabel')}
                selectedKeys={[params.model]}
                onSelectionChange={(keys) => {
                  const val = [...keys][0] as ModelParams['model']
                  update('model', val)
                }}
                size="sm"
                style={{ minWidth: 180 }}
              >
                <SelectItem key="linear_regression">{t('predictions.modelLinear')}</SelectItem>
                <SelectItem key="moving_average">{t('predictions.modelMA')}</SelectItem>
              </Select>

              {params.model === 'linear_regression' && (
                <>
                  <Input
                    label={t('predictions.ciQuantile')}
                    type="number"
                    value={String(params.ci_quantile)}
                    onValueChange={(v) => update('ci_quantile', Math.min(0.49, Math.max(0.01, Number(v))))}
                    min={0.01}
                    max={0.49}
                    step={0.01}
                    size="sm"
                    style={{ width: 110 }}
                    description="0.01 – 0.49"
                  />
                  <Input
                    label={t('predictions.nResamples')}
                    type="number"
                    value={String(params.n_resamples)}
                    onValueChange={(v) => update('n_resamples', Math.min(500, Math.max(10, Number(v))))}
                    min={10}
                    max={500}
                    step={10}
                    size="sm"
                    style={{ width: 110 }}
                    description="10 – 500"
                  />
                </>
              )}

              {params.model === 'moving_average' && (
                <>
                  <Input
                    label={t('predictions.window')}
                    type="number"
                    value={String(params.window)}
                    onValueChange={(v) => update('window', Math.min(12, Math.max(1, Number(v))))}
                    min={1}
                    max={12}
                    step={1}
                    size="sm"
                    style={{ width: 110 }}
                    description="1 – 12"
                  />
                  <Input
                    label={t('predictions.alpha')}
                    type="number"
                    value={String(params.alpha)}
                    onValueChange={(v) => update('alpha', Math.min(0.99, Math.max(0.01, Number(v))))}
                    min={0.01}
                    max={0.99}
                    step={0.05}
                    size="sm"
                    style={{ width: 110 }}
                    description="0.01 – 0.99"
                  />
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Divider style={{ marginBottom: 24 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {RESOURCE_TYPES.map((rt) => (
          <PredictionCard key={rt} resourceType={rt} horizon={horizon} modelParams={params} />
        ))}
      </div>
    </div>
  )
}
