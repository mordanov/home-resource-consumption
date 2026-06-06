import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from '@heroui/react'
import { useAuthStore } from '../store/authStore'
import axiosInstance from '../lib/axios'

export function Layout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await axiosInstance.post('/auth/logout')
    } catch {
      // Ignore logout errors — still clear local state
    }
    clearAuth()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar isBordered>
        <NavbarBrand>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Resource Tracker</span>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {[
            { to: '/', label: 'Dashboard' },
            { to: '/bills', label: 'Bills' },
            { to: '/upload', label: 'Upload' },
            { to: '/predictions', label: 'Predictions' },
            { to: '/analysis', label: 'Analysis' },
          ].map(({ to, label }) => (
            <NavbarItem key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#006FEE' : 'inherit',
                  textDecoration: 'none',
                })}
              >
                {label}
              </NavLink>
            </NavbarItem>
          ))}
        </NavbarContent>

        <NavbarContent justify="end">
          <NavbarItem>
            <span style={{ fontSize: '0.875rem', color: '#687076', marginRight: 8 }}>
              {user?.username}
            </span>
          </NavbarItem>
          <NavbarItem>
            <Button size="sm" variant="flat" color="danger" onPress={handleLogout}>
              Logout
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  )
}
