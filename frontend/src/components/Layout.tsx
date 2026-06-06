import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import axiosInstance from '../lib/axios'

const LANGS = ['en', 'ru', 'es'] as const
type Lang = typeof LANGS[number]

export function Layout() {
  const { t, i18n } = useTranslation()
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  function switchLang(lang: Lang) {
    i18n.changeLanguage(lang)
    localStorage.setItem('lang', lang)
  }

  async function handleLogout() {
    try {
      await axiosInstance.post('/auth/logout')
    } catch {
      // Ignore logout errors — still clear local state
    }
    clearAuth()
    navigate('/login')
  }

  const navLinks = [
    { to: '/', key: 'nav.dashboard' },
    { to: '/bills', key: 'nav.bills' },
    { to: '/upload', key: 'nav.upload' },
    { to: '/predictions', key: 'nav.predictions' },
    { to: '/analysis', key: 'nav.analysis' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar isBordered>
        <NavbarBrand>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{t('nav.brand')}</span>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          {navLinks.map(({ to, key }) => (
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
                {t(key)}
              </NavLink>
            </NavbarItem>
          ))}
        </NavbarContent>

        <NavbarContent justify="end">
          <NavbarItem>
            <div style={{ display: 'flex', gap: 4 }}>
              {LANGS.map((lang) => (
                <Button
                  key={lang}
                  size="sm"
                  variant={i18n.language === lang ? 'solid' : 'flat'}
                  onPress={() => switchLang(lang)}
                  style={{ minWidth: 36, padding: '0 8px', fontWeight: 600, textTransform: 'uppercase' }}
                >
                  {lang}
                </Button>
              ))}
            </div>
          </NavbarItem>
          <NavbarItem>
            <span style={{ fontSize: '0.875rem', color: '#687076', marginRight: 8 }}>
              {user?.username}
            </span>
          </NavbarItem>
          <NavbarItem>
            <Button size="sm" variant="flat" color="danger" onPress={handleLogout}>
              {t('nav.logout')}
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
