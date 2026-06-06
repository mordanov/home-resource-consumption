import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

export function ProtectedRoute() {
  const { accessToken, setAccessToken } = useAuthStore()
  const [checking, setChecking] = useState(!accessToken)

  useEffect(() => {
    if (accessToken) return
    axios
      .post<{ access_token: string }>('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then((res) => setAccessToken(res.data.access_token))
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  if (checking) return null
  if (!accessToken) return <Navigate to="/login" replace />
  return <Outlet />
}
