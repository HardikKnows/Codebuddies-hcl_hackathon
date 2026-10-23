import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { catalogApi } from '../api'
import { useAuth } from '../auth/AuthContext'

const STORE_KEY = 'rp.store'
const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const { user } = useAuth()
  const [stores, setStores] = useState([])
  const [error, setError] = useState(null)
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    const saved = Number(localStorage.getItem(STORE_KEY))
    if (Number.isFinite(saved) && saved > 0) return saved
    return user?.preferredStoreId || user?.storeId || null
  })
  const lastUserId = useRef(user?.id)

  useEffect(() => {
    catalogApi
      .stores()
      .then(setStores)
      .catch(setError)
  }, [])

  // Signing in (not reloading the page) switches to the customer's preferred store or the staff member's store.
  useEffect(() => {
    if (user?.id && user.id !== lastUserId.current) {
      const preferred = user.preferredStoreId || user.storeId
      if (preferred) setSelectedStoreId(preferred)
    }
    lastUserId.current = user?.id
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickupStores = useMemo(() => stores.filter((s) => s.type === 'STORE'), [stores])

  // Fall back to the first store once the list loads, and drop a saved id that no longer exists.
  useEffect(() => {
    if (!pickupStores.length) return
    if (!pickupStores.some((s) => s.id === selectedStoreId)) setSelectedStoreId(pickupStores[0].id)
  }, [pickupStores, selectedStoreId])

  useEffect(() => {
    if (selectedStoreId) localStorage.setItem(STORE_KEY, String(selectedStoreId))
  }, [selectedStoreId])

  const value = useMemo(
    () => ({
      stores,
      pickupStores,
      warehouse: stores.find((s) => s.type === 'WAREHOUSE') || null,
      selectedStoreId,
      selectedStore: pickupStores.find((s) => s.id === selectedStoreId) || null,
      setSelectedStoreId,
      storesError: error,
    }),
    [stores, pickupStores, selectedStoreId, error],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStores() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStores must be used inside StoreProvider')
  return context
}
