import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardBody, CardHeader, Input, Button, Progress, addToast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import axiosInstance from '../lib/axios'

interface ProblemDetail {
  detail?: string
}

interface PasswordStrength {
  score: number
  label: string
  color: 'danger' | 'warning' | 'primary' | 'success'
  ariaLabel: string
}

function usePasswordStrength(pw: string): PasswordStrength | null {
  const { t } = useTranslation()
  if (!pw) return null
  const hasUpper = /[A-Z]/.test(pw)
  const hasLower = /[a-z]/.test(pw)
  const hasDigit = /\d/.test(pw)
  const longEnough = pw.length >= 8
  const rulesMet = [hasUpper, hasLower, hasDigit].filter(Boolean).length

  if (!longEnough) {
    const label = t('register.strengthWeak')
    return { score: 25, label, color: 'danger', ariaLabel: label }
  }
  if (rulesMet === 1) {
    const label = t('register.strengthFair')
    return { score: 50, label, color: 'warning', ariaLabel: label }
  }
  if (rulesMet === 2) {
    const label = t('register.strengthGood')
    return { score: 75, label, color: 'primary', ariaLabel: label }
  }
  const label = t('register.strengthStrong')
  return { score: 100, label, color: 'success', ariaLabel: label }
}

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirm: false,
  })

  const [serverErrors, setServerErrors] = useState<{ username?: string; email?: string }>({})

  const strength = usePasswordStrength(password)

  function getPasswordError(pw: string): string | null {
    if (pw.length < 8) return t('register.passwordShort')
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return t('register.passwordWeak')
    return null
  }

  const errors = {
    username: touched.username && !username ? t('register.usernameRequired') : (serverErrors.username ?? null),
    email: touched.email
      ? !email
        ? t('register.emailRequired')
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? t('register.emailInvalid')
        : (serverErrors.email ?? null)
      : null,
    password: touched.password ? getPasswordError(password) : null,
    confirm: touched.confirm
      ? !confirm
        ? t('register.confirmRequired')
        : confirm !== password
        ? t('register.confirmMismatch')
        : null
      : null,
  }

  function touch(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function validateAll() {
    setTouched({ username: true, email: true, password: true, confirm: true })
    return (
      !!username &&
      !!email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      !getPasswordError(password) &&
      confirm === password &&
      !!confirm
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    setLoading(true)
    setServerErrors({})
    try {
      await axiosInstance.post('/auth/register', { username, email, password })
      addToast({ title: t('register.success'), color: 'success' })
      navigate('/login')
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: ProblemDetail } }).response?.status
      const detail = (err as { response?: { data?: ProblemDetail } }).response?.data?.detail ?? ''
      if (status === 409) {
        if (detail.toLowerCase().includes('username')) {
          setServerErrors({ username: t('register.usernameTaken') })
        } else if (detail.toLowerCase().includes('email')) {
          setServerErrors({ email: t('register.emailTaken') })
        } else {
          addToast({ title: t('register.failed'), description: detail, color: 'danger' })
        }
      } else {
        addToast({
          title: t('register.failed'),
          description: detail || t('register.unexpected'),
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
      <Card style={{ width: '100%', maxWidth: 440 }}>
        <CardHeader>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{t('register.title')}</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label={t('register.username')}
              value={username}
              onValueChange={(v) => { setUsername(v); setServerErrors((p) => ({ ...p, username: undefined })) }}
              onBlur={() => touch('username')}
              autoComplete="username"
              isRequired
              isDisabled={loading}
              isInvalid={!!errors.username}
              errorMessage={errors.username ?? undefined}
            />
            <Input
              label={t('register.email')}
              type="email"
              value={email}
              onValueChange={(v) => { setEmail(v); setServerErrors((p) => ({ ...p, email: undefined })) }}
              onBlur={() => touch('email')}
              autoComplete="email"
              isRequired
              isDisabled={loading}
              isInvalid={!!errors.email}
              errorMessage={errors.email ?? undefined}
            />
            <div>
              <Input
                label={t('register.password')}
                type="password"
                value={password}
                onValueChange={(v) => {
                  setPassword(v)
                  if (touched.password) touch('password')
                }}
                onBlur={() => touch('password')}
                autoComplete="new-password"
                isRequired
                isDisabled={loading}
                isInvalid={!!errors.password}
                errorMessage={errors.password ?? undefined}
              />
              {strength && strength.label && (
                <div style={{ marginTop: 6 }}>
                  <Progress
                    value={strength.score}
                    color={strength.color}
                    size="sm"
                    aria-label={t('register.strengthLabel', { strength: strength.ariaLabel })}
                  />
                  <p style={{ fontSize: '0.75rem', marginTop: 3, color: `var(--heroui-${strength.color})` }}>
                    {t('register.strengthLabel', { strength: strength.label })}
                  </p>
                </div>
              )}
            </div>
            <Input
              label={t('register.confirmPassword')}
              type="password"
              value={confirm}
              onValueChange={(v) => {
                setConfirm(v)
                if (touched.confirm) touch('confirm')
              }}
              onBlur={() => touch('confirm')}
              autoComplete="new-password"
              isRequired
              isDisabled={loading}
              isInvalid={!!errors.confirm}
              errorMessage={errors.confirm ?? undefined}
            />
            <Button type="submit" color="primary" isLoading={loading} fullWidth>
              {loading ? t('register.submitting') : t('register.submit')}
            </Button>
            <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>
              {t('register.haveAccount')}{' '}
              <Link to="/login" style={{ color: '#006FEE' }}>
                {t('register.signIn')}
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
