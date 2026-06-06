import { useRef, useState } from 'react'
import { Button, Select, SelectItem } from '@heroui/react'
import axiosInstance from '../lib/axios'

export type ResourceType = 'ELECTRICITY' | 'GAS' | 'WATER'

interface Props {
  onResult: (preview: unknown) => void
}

const RESOURCE_TYPES: ResourceType[] = ['ELECTRICITY', 'GAS', 'WATER']
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE_BYTES = 20 * 1024 * 1024

type ZoneState = 'idle' | 'accepted' | 'rejected' | 'uploading' | 'error'

export function UploadZone({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [resourceType, setResourceType] = useState<ResourceType | ''>('')
  const [dragOver, setDragOver] = useState(false)
  const [zoneState, setZoneState] = useState<ZoneState>('idle')
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [parsePhase, setParsePhase] = useState<'uploading' | 'parsing' | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  function validateAndAccept(f: File) {
    if (!ACCEPTED_MIME.includes(f.type)) {
      setRejectReason('Only PDF, JPEG, or PNG files are accepted.')
      setZoneState('rejected')
      return
    }
    if (f.size > MAX_SIZE_BYTES) {
      setRejectReason('File exceeds 20 MB limit.')
      setZoneState('rejected')
      return
    }
    setFile(f)
    setZoneState('accepted')
    setRejectReason(null)
    setParseError(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndAccept(dropped)
  }

  function resetZone() {
    setFile(null)
    setZoneState('idle')
    setRejectReason(null)
    setParseError(null)
    setParsePhase(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file) return
    if (!resourceType) {
      setResourceError('Please select a resource type before uploading.')
      return
    }
    setResourceError(null)
    setZoneState('uploading')
    setParsePhase('uploading')
    setParseError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('resource_type', resourceType)
      setParsePhase('parsing')
      const { data } = await axiosInstance.post('/bills/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onResult(data)
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
    : zoneState === 'accepted' ? '#17c964'
    : zoneState === 'rejected' || zoneState === 'error' ? '#f31260'
    : '#d4d4d8'

  const bgColor =
    dragOver ? '#eff6ff'
    : zoneState === 'accepted' ? '#f0fdf4'
    : zoneState === 'rejected' || zoneState === 'error' ? '#fff1f2'
    : '#fafafa'

  function renderZoneContent() {
    if (zoneState === 'idle') {
      return (
        <>
          <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>📄</p>
          <p style={{ margin: '0 0 4px' }}>
            {dragOver ? 'Drop to upload' : <>Drag a PDF or image here, or <span style={{ color: '#006FEE' }}>click to browse</span></>}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#687076', margin: 0 }}>PDF, JPEG, PNG — max 20 MB</p>
        </>
      )
    }
    if (zoneState === 'accepted' && file) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>📄 <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} KB</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); resetZone() }}
            aria-label="Remove file"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
      )
    }
    if (zoneState === 'rejected') {
      return (
        <>
          <p style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>⚠️</p>
          <p style={{ color: '#f31260', margin: '0 0 8px' }}>{rejectReason}</p>
          <Button size="sm" variant="flat" onPress={resetZone}>Try again</Button>
        </>
      )
    }
    if (zoneState === 'uploading') {
      return (
        <>
          <p style={{ margin: '0 0 12px' }}>
            {parsePhase === 'uploading' ? 'Uploading file…' : 'Parsing bill with AI — this may take up to 15 seconds'}
          </p>
          <span style={{ fontSize: '1.5rem' }}>⏳</span>
        </>
      )
    }
    if (zoneState === 'error') {
      return (
        <>
          <p style={{ color: '#f31260', margin: '0 0 8px' }}>Parsing failed: {parseError}</p>
          <Button size="sm" variant="flat" onPress={resetZone}>Try again</Button>
        </>
      )
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resource type selector — positioned above zone per spec */}
      <Select
        label="Resource type"
        placeholder="Select resource type"
        selectedKeys={resourceType ? [resourceType] : []}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as ResourceType
          if (key) { setResourceType(key); setResourceError(null) }
        }}
        isDisabled={isUploading}
        isInvalid={!!resourceError}
        errorMessage={resourceError ?? undefined}
        aria-label="Resource type"
      >
        {RESOURCE_TYPES.map((rt) => (
          <SelectItem key={rt}>{rt}</SelectItem>
        ))}
      </Select>

      {/* Drop zone — outer drag target */}
      <div
        role="region"
        aria-label="File upload zone"
        style={{
          border: `2px ${zoneState === 'accepted' ? 'solid' : 'dashed'} ${borderColor}`,
          borderRadius: 12,
          background: bgColor,
          transition: 'all 0.15s',
        }}
        onDragOver={(e) => { e.preventDefault(); if (!isUploading) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={isUploading ? undefined : handleDrop}
      >
        {/* Visually-hidden file input — discoverable by AT but not visible */}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndAccept(f) }}
          tabIndex={-1}
        />

        {/* Keyboard-focusable button that wraps all zone content */}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => { if (zoneState !== 'accepted') inputRef.current?.click() }}
          aria-label="Upload bill file — press Enter or Space to open file picker"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '2rem',
            textAlign: 'center',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            background: 'none',
            border: 'none',
            borderRadius: 10,
            minHeight: 120,
          }}
        >
          {renderZoneContent()}
        </button>
      </div>

      <Button
        color="primary"
        onPress={handleUpload}
        isDisabled={zoneState !== 'accepted' || isUploading}
        isLoading={isUploading}
      >
        {isUploading ? (parsePhase === 'uploading' ? 'Uploading…' : 'Parsing…') : 'Upload & Parse'}
      </Button>
    </div>
  )
}
