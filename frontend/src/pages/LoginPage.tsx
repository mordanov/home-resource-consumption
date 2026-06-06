import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardBody, CardHeader, Input, Button, addToast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import axiosInstance from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import type { UserRead } from '../store/authStore'

interface LoginResponse {
  access_token: string
  user: UserRead
}

interface ProblemDetail {
  detail?: string
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTokens, accessToken } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)

  useEffect(() => {
    if (accessToken) navigate('/', { replace: true })
  }, [accessToken, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCredError(null)
    setLoading(true)
    try {
      const form = new URLSearchParams({ username, password })
      const { data } = await axiosInstance.post<LoginResponse>('/auth/login', form)
      setTokens(data.access_token, data.user)
      navigate('/')
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: ProblemDetail } }).response?.status
      const detail = (err as { response?: { data?: ProblemDetail } }).response?.data?.detail
      if (status === 401) {
        setCredError(t('login.badCreds'))
      } else {
        addToast({
          title: t('login.failed'),
          description: detail ?? t('login.unexpected'),
          color: 'danger',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f4f5',
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <CardHeader style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span style={{ fontSize: '1.5rem' }}>⚡💧🔥</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{t('login.title')}</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label={t('login.username')}
              value={username}
              onValueChange={setUsername}
              autoComplete="username"
              isRequired
              isDisabled={loading}
            />
            <Input
              label={t('login.password')}
              type="password"
              value={password}
              onValueChange={(v) => { setPassword(v); setCredError(null) }}
              autoComplete="current-password"
              isRequired
              isDisabled={loading}
              isInvalid={!!credError}
              errorMessage={credError ?? undefined}
            />
            <Button type="submit" color="primary" isLoading={loading} fullWidth>
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
            <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>
              {t('login.noAccount')}{' '}
              <Link to="/register" style={{ color: '#006FEE' }}>
                {t('login.register')}
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
