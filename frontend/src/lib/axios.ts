import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { tokenRegistry } from './tokenRegistry'

const axiosInstance = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

axiosInstance.interceptors.request.use((config) => {
  const token = tokenRegistry.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Single in-flight refresh promise to prevent concurrent refresh storms
let refreshPromise: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const response = await axios.post<{ access_token: string }>(
    '/api/v1/auth/refresh',
    {},
    { withCredentials: true },
  )
  return response.data.access_token
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => {
            refreshPromise = null
          })
        }
        const newToken = await refreshPromise
        tokenRegistry.set(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return axiosInstance(originalRequest)
      } catch {
        tokenRegistry.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  },
)

export default axiosInstance
