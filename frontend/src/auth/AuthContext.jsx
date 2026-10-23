import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { authApi } from '../api'
import { setUnauthorizedHandler, tokenStore } from '../api/client'

const USER_KEY = 'rp.user'
export const STAFF_ROLES = ['STORE_STAFF', 'STORE_MANAGER', 'ADMIN']
export const MANAGER_ROLES = ['STORE_MANAGER', 'ADMIN']

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    return tokenStore.get() ? JSON.parse(localStorage.getItem(USER_KEY)) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(readStoredUser)

  const saveUser = useCallback((next) => {
    setUser(next)
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next))
    else localStorage.removeItem(USER_KEY)
  }, [])

  const logout = useCallback(
    (options = {}) => {
      tokenStore.clear()
      saveUser(null)
      if (options.redirect) navigate('/login', { replace: true, state: { message: options.message } })
    },
    [navigate, saveUser],
  )

  // An expired or revoked session anywhere in the app sends the user back to sign in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (tokenStore.get()) logout({ redirect: true, message: 'Your session has expired. Please sign in again.' })
    })
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // Refresh the profile once on load so role or tier changes show up.
  useEffect(() => {
    if (!tokenStore.get()) return
    authApi.me().then(saveUser).catch(() => {})
  }, [saveUser])

  const login = useCallback(
    async (email, password) => {
      const result = await authApi.login(email, password)
      tokenStore.set(result.accessToken)
      saveUser(result.user)
      return result.user
    },
    [saveUser],
  )

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isCustomer: user?.role === 'CUSTOMER',
      isStaff: STAFF_ROLES.includes(user?.role),
      isManager: MANAGER_ROLES.includes(user?.role),
      login,
      logout,
      setUser: saveUser,
    }),
    [user, login, logout, saveUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
