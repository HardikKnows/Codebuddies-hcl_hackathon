import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CART_KEY = 'rp.cart'
const MAX_PER_LINE = 10
const CartContext = createContext(null)

function readCart() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY))
    return Array.isArray(items) ? items.filter((i) => i?.productId && i.quantity > 0) : []
  } catch {
    return []
  }
}

/** The cart only stores product ids and quantities; prices and stock always come from the server quote. */
export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart)

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items])

  const addItem = useCallback((productId, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.productId === productId)
      if (existing) {
        return current.map((i) =>
          i.productId === productId ? { ...i, quantity: Math.min(MAX_PER_LINE, i.quantity + quantity) } : i,
        )
      }
      return [...current, { productId, quantity: Math.min(MAX_PER_LINE, quantity) }]
    })
  }, [])

  const setQuantity = useCallback((productId, quantity) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((i) => i.productId !== productId)
        : current.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(MAX_PER_LINE, quantity) } : i)),
    )
  }, [])

  const removeItem = useCallback((productId) => {
    setItems((current) => current.filter((i) => i.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      addItem,
      setQuantity,
      removeItem,
      clear,
      maxPerLine: MAX_PER_LINE,
    }),
    [items, addItem, setQuantity, removeItem, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
