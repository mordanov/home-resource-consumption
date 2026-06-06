import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardBody, CardHeader, Input, Button, Progress, addToast } from '@heroui/react'
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

function getPasswordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: '', color: 'danger', ariaLabel: '' }
  const hasUpper = /[A-Z]/.test(pw)
  const hasLower = /[a-z]/.test(pw)
  const hasDigit = /\d/.test(pw)
  const longEnough = pw.length >= 8
  const rulesMet = [hasUpper, hasLower, hasDigit].filter(Boolean).length

  if (!longEnough) return { score: 25, label: 'Weak — too short', color: 'danger', ariaLabel: 'Weak — too short' }
  if (rulesMet === 1) return { score: 50, label: 'Fair', color: 'warning', ariaLabel: 'Fair' }
  if (rulesMet === 2) return { score: 75, label: 'Good', color: 'primary', ariaLabel: 'Good' }
  return { score: 100, label: 'Strong', color: 'success', ariaLabel: 'Strong' }
}

function getPasswordError(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw))
    return 'Password must include uppercase, lowercase, and a number'
  return null
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  // Touched state for blur-based validation
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirm: false,
  })

  // Field errors
  const [serverErrors, setServerErrors] = useState<{ username?: string; email?: string }>({})

  const strength = password ? getPasswordStrength(password) : null

  const errors = {
    username: touched.username && !username ? 'Username is required' : (serverErrors.username ?? null),
    email: touched.email
      ? !email
        ? 'Email is required'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'Enter a valid email address'
        : (serverErrors.email ?? null)
      : null,
    password: touched.password ? getPasswordError(password) : null,
    confirm: touched.confirm
      ? !confirm
        ? 'Please confirm your password'
        : confirm !== password
        ? 'Passwords do not match'
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
      addToast({ title: 'Account created — please sign in.', color: 'success' })
      navigate('/login')
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: ProblemDetail } }).response?.status
      const detail = (err as { response?: { data?: ProblemDetail } }).response?.data?.detail ?? ''
      if (status === 409) {
        if (detail.toLowerCase().includes('username')) {
          setServerErrors({ username: 'This username is already taken' })
        } else if (detail.toLowerCase().includes('email')) {
          setServerErrors({ email: 'An account with this email already exists' })
        } else {
          addToast({ title: 'Registration failed', description: detail, color: 'danger' })
        }
      } else {
        addToast({
          title: 'Registration failed',
          description: detail || 'An unexpected error occurred.',
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Create account</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input
              label="Username"
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
              label="Email"
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
                label="Password"
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
                    aria-label={`Password strength: ${strength.ariaLabel}`}
                  />
                  <p style={{ fontSize: '0.75rem', marginTop: 3, color: `var(--heroui-${strength.color})` }}>
                    Password strength: {strength.label}
                  </p>
                </div>
              )}
            </div>
            <Input
              label="Confirm password"
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
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
            <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#006FEE' }}>
                Sign in
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
