import { Input, Select, SelectItem } from '@heroui/react'
import { useTranslation } from 'react-i18next'

export type ResourceType = 'ELECTRICITY' | 'GAS' | 'WATER'
export type Unit = 'KWH' | 'CUBIC_METER'

export interface BillFormValues {
  resource_type: ResourceType | ''
  bill_date: string
  period_start: string
  period_end: string
  amount_consumed: string
  unit: Unit | ''
  amount_paid: string
  currency: string
}

interface Props {
  values: BillFormValues
  onChange: (values: BillFormValues) => void
  disabled?: boolean
}

const RESOURCE_TYPES: ResourceType[] = ['ELECTRICITY', 'GAS', 'WATER']
const UNITS: Unit[] = ['KWH', 'CUBIC_METER']

export function BillForm({ values, onChange, disabled }: Props) {
  const { t } = useTranslation()

  function set(field: keyof BillFormValues, value: string) {
    onChange({ ...values, [field]: value })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Select
        label={t('upload.fieldResource')}
        selectedKeys={values.resource_type ? [values.resource_type] : []}
        onSelectionChange={(keys) => {
          const k = Array.from(keys)[0] as ResourceType
          if (k) set('resource_type', k)
        }}
        isDisabled={disabled}
        size="sm"
      >
        {RESOURCE_TYPES.map((rt) => (
          <SelectItem key={rt}>{rt}</SelectItem>
        ))}
      </Select>

      <Input
        label={t('upload.fieldBillDate')}
        type="date"
        value={values.bill_date}
        onValueChange={(v) => set('bill_date', v)}
        isDisabled={disabled}
        size="sm"
      />

      <Input
        label={t('upload.fieldPeriodStart')}
        type="date"
        value={values.period_start}
        onValueChange={(v) => set('period_start', v)}
        isDisabled={disabled}
        size="sm"
      />

      <Input
        label={t('upload.fieldPeriodEnd')}
        type="date"
        value={values.period_end}
        onValueChange={(v) => set('period_end', v)}
        isDisabled={disabled}
        size="sm"
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Input
            label={t('upload.fieldAmountConsumed')}
            type="number"
            value={values.amount_consumed}
            onValueChange={(v) => set('amount_consumed', v)}
            isDisabled={disabled}
            size="sm"
          />
        </div>
        <div style={{ flex: 1 }}>
          <Select
            label={t('upload.fieldUnit')}
            selectedKeys={values.unit ? [values.unit] : []}
            onSelectionChange={(keys) => {
              const k = Array.from(keys)[0] as Unit
              if (k) set('unit', k)
            }}
            isDisabled={disabled}
            size="sm"
          >
            {UNITS.map((u) => (
              <SelectItem key={u}>{u}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Input
            label={t('upload.fieldAmountPaid')}
            type="number"
            value={values.amount_paid}
            onValueChange={(v) => set('amount_paid', v)}
            isDisabled={disabled}
            size="sm"
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label={t('upload.fieldCurrency')}
            value={values.currency}
            onValueChange={(v) => set('currency', v)}
            isDisabled={disabled}
            maxLength={3}
            size="sm"
          />
        </div>
      </div>
    </div>
  )
}

export function previewToBillFormValues(preview: {
  resource_type: string
  bill_date: string
  period_start: string
  period_end: string
  amount_consumed: string | number
  unit: string
  amount_paid: string | number
  currency: string
}): BillFormValues {
  return {
    resource_type: preview.resource_type as ResourceType,
    bill_date: preview.bill_date,
    period_start: preview.period_start,
    period_end: preview.period_end,
    amount_consumed: String(preview.amount_consumed),
    unit: preview.unit as Unit,
    amount_paid: String(preview.amount_paid),
    currency: preview.currency,
  }
}
