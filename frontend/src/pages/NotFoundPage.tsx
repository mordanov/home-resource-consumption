import { Link } from 'react-router-dom'
import { Button } from '@heroui/react'

export function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ color: '#687076', marginBottom: 24 }}>Page not found.</p>
      <Button as={Link} to="/" color="primary">
        Back to Dashboard
      </Button>
    </div>
  )
}
