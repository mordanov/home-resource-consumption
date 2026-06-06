import { useRef, useState } from 'react'
import { Button, Select, SelectItem } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import axiosInstance from '../lib/axios'

export type ResourceType = 'ELECTRICITY' | 'GAS' | 'WATER'

export interface BillPreviewRaw {
  resource_type: string
  bill_date: string
  period_start: string
  period_end: string
  amount_consumed: string
  unit: string
  amount_paid: string
  currency: string
  raw_text?: string
}

interface Props {
  onResult: (previews: BillPreviewRaw[]) => void
}

const RESOURCE_TYPES: ResourceType[] = ['ELECTRICITY', 'GAS', 'WATER']
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE_BYTES = 20 * 1024 * 1024

type ZoneState = 'idle' | 'hasFiles' | 'rejected' | 'uploading' | 'error'

export function UploadZone({ onResult }: Props) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [resourceType, setResourceType] = useState<ResourceType | ''>('')
  const [dragOver, setDragOver] = useState(false)
  const [zoneState, setZoneState] = useState<ZoneState>('idle')
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [parsePhase, setParsePhase] = useState<'uploading' | 'parsing' | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  function validateFiles(fileList: FileList): File[] {
    const valid: File[] = []
    let reason: string | null = null
    for (const f of Array.from(fileList)) {
      if (!ACCEPTED_MIME.includes(f.type)) {
        reason = t('upload.invalidType')
      } else if (f.size > MAX_SIZE_BYTES) {
        reason = t('upload.tooLarge')
      } else {
        valid.push(f)
      }
    }
    if (reason && valid.length === 0) {
      setRejectReason(reason)
      setZoneState('rejected')
    } else {
      setRejectReason(null)
    }
    return valid
  }

  function addFiles(fileList: FileList) {
    const valid = validateFiles(fileList)
    if (valid.length > 0) {
      setFiles((prev) => {
        const newFiles = [...prev, ...valid]
        setZoneState('hasFiles')
        return newFiles
      })
    }
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (next.length === 0) {
        setZoneState('idle')
      }
      return next
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  function resetZone() {
    setFiles([])
    setZoneState('idle')
    setRejectReason(null)
    setParseError(null)
    setParsePhase(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleUpload() {
    if (files.length === 0) return
    if (!resourceType) {
      setResourceError(t('upload.resourceRequired'))
      return
    }
    setResourceError(null)
    setZoneState('uploading')
    setParsePhase('uploading')
    setParseError(null)
    try {
      setParsePhase('parsing')
      const results = await Promise.all(
        files.map((file) => {
          const form = new FormData()
          form.append('file', file)
          form.append('resource_type', resourceType)
          return axiosInstance.post<BillPreviewRaw>('/bills/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        }),
      )
      onResult(results.map((r) => r.data))
      resetZone()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      setParseError(detail ?? 'Upload failed. Please try again.')
      setZoneState('error')
      setParsePhase(null)
    }
  }

  const isUploading = zoneState === 'uploading'

  const borderColor =
    dragOver ? '#006FEE'
    : zoneState === 'hasFiles' ? '#17c964'
    : zoneState === 'rejected' || zoneState === 'error' ? '#f31260'
    : '#d4d4d8'

  const bgColor =
    dragOver ? '#eff6ff'
    : zoneState === 'hasFiles' ? '#f0fdf4'
    : zoneState === 'rejected' || zoneState === 'error' ? '#fff1f2'
    : '#fafafa'

  function renderZoneContent() {
    if (zoneState === 'idle') {
      return (
        <>
          <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>📄</p>
          <p style={{ margin: '0 0 4px' }}>
            {dragOver
              ? t('upload.dropActive')
              : (
                <>
                  {t('upload.dropHint')}{' '}
                  <span style={{ color: '#006FEE' }}>{t('upload.browseLink')}</span>
                </>
              )}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#687076', margin: 0 }}>{t('upload.fileHint')}</p>
        </>
      )
    }
    if (zoneState === 'hasFiles' && files.length > 0) {
      return (
        <div style={{ width: '100%' }}>
          {files.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: i < files.length - 1 ? '1px solid #e4e4e7' : 'none',
              }}
            >
              <span style={{ fontSize: '0.875rem' }}>📄 <strong>{f.name}</strong> — {(f.size / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                aria-label={`Remove ${f.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>
          ))}
          <p style={{ fontSize: '0.75rem', color: '#687076', margin: '8px 0 0', textAlign: 'center' }}>
            {t('upload.dropHint')}{' '}
            <span style={{ color: '#006FEE' }}>{t('upload.browseLink')}</span>
          </p>
        </div>
      )
    }
    if (zoneState === 'rejected') {
      return (
        <>
          <p style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>⚠️</p>
          <p style={{ color: '#f31260', margin: '0 0 8px' }}>{rejectReason}</p>
          <Button size="sm" variant="flat" onPress={resetZone}>{t('upload.tryAgain')}</Button>
        </>
      )
    }
    if (zoneState === 'uploading') {
      return (
        <>
          <p style={{ margin: '0 0 12px' }}>
            {parsePhase === 'uploading' ? t('upload.uploading') : t('upload.parsing')}
          </p>
          <span style={{ fontSize: '1.5rem' }}>⏳</span>
        </>
      )
    }
    if (zoneState === 'error') {
      return (
        <>
          <p style={{ color: '#f31260', margin: '0 0 8px' }}>{t('upload.parseFailed', { error: parseError })}</p>
          <Button size="sm" variant="flat" onPress={resetZone}>{t('upload.tryAgain')}</Button>
        </>
      )
    }
    return null
  }

  const uploadButtonLabel =
    isUploading
      ? parsePhase === 'uploading'
        ? t('upload.buttonUploading')
        : t('upload.buttonParsing')
      : files.length > 1
        ? t('upload.buttonUploadN', { count: files.length })
        : t('upload.buttonUpload')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Select
        label={t('upload.resourceType')}
        placeholder={t('upload.selectResourceType')}
        selectedKeys={resourceType ? [resourceType] : []}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as ResourceType
          if (key) { setResourceType(key); setResourceError(null) }
        }}
        isDisabled={isUploading}
        isInvalid={!!resourceError}
        errorMessage={resourceError ?? undefined}
        aria-label={t('upload.resourceType')}
      >
        {RESOURCE_TYPES.map((rt) => (
          <SelectItem key={rt}>{rt}</SelectItem>
        ))}
      </Select>

      <div
        role="region"
        aria-label="File upload zone"
        style={{
          border: `2px ${zoneState === 'hasFiles' ? 'solid' : 'dashed'} ${borderColor}`,
          borderRadius: 12,
          background: bgColor,
          transition: 'all 0.15s',
        }}
        onDragOver={(e) => { e.preventDefault(); if (!isUploading) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={isUploading ? undefined : handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' }}
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files) }}
          tabIndex={-1}
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => { if (zoneState !== 'hasFiles') inputRef.current?.click() }}
          aria-label="Upload bill files — press Enter or Space to open file picker"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '1.5rem',
            textAlign: 'center',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            background: 'none',
            border: 'none',
            borderRadius: 10,
            minHeight: 100,
          }}
        >
          {renderZoneContent()}
        </button>
      </div>

      <Button
        color="primary"
        onPress={handleUpload}
        isDisabled={zoneState !== 'hasFiles' || isUploading}
        isLoading={isUploading}
      >
        {uploadButtonLabel}
      </Button>
    </div>
  )
}
