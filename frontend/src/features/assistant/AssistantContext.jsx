import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { assistantApi } from '../../api'
import { useStores } from '../StoreContext'

const AssistantContext = createContext(null)
const HISTORY_TURNS = 10

let counter = 0
const nextId = () => `m${Date.now()}-${counter++}`

export function AssistantProvider({ children }) {
  const { selectedStoreId } = useStores()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [pending, setPending] = useState(false)
  const [draft, setDraft] = useState('')
  const [productContext, setProductContext] = useState(null) // { productId, name }
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const pendingRef = useRef(false)

  const sendFrom = useCallback(
    async (text, base) => {
      const message = text.trim().slice(0, 1000)
      if (!message || pendingRef.current) return
      // Only successful turns go back as history; the server re-validates everything it is given.
      const history = base
        .filter((m) => !m.error && m.content)
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      setMessages([...base, { id: nextId(), role: 'user', content: message }])
      setDraft('')
      pendingRef.current = true
      setPending(true)
      try {
        const response = await assistantApi.chat({
          message,
          history,
          storeId: selectedStoreId || undefined,
          productId: productContext?.productId || undefined,
        })
        setMessages((current) => [...current, { id: nextId(), role: 'assistant', content: response.reply || '', response }])
      } catch (error) {
        setMessages((current) => [...current, { id: nextId(), role: 'assistant', content: '', error, retryText: message }])
      } finally {
        pendingRef.current = false
        setPending(false)
      }
    },
    [selectedStoreId, productContext],
  )

  const send = useCallback((text) => sendFrom(text, messagesRef.current), [sendFrom])

  // Retrying drops the failed exchange and resends the same text on the history before it.
  const retry = useCallback(
    (errorMessageId) => {
      const current = messagesRef.current
      const index = current.findIndex((m) => m.id === errorMessageId)
      if (index < 1) return
      sendFrom(current[index].retryText, current.slice(0, index - 1))
    },
    [sendFrom],
  )

  const openWith = useCallback(({ prompt, product } = {}) => {
    if (product) setProductContext(product)
    if (prompt) setDraft(prompt)
    setOpen(true)
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setDraft('')
    setProductContext(null)
  }, [])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      messages,
      pending,
      draft,
      setDraft,
      productContext,
      setProductContext,
      send,
      retry,
      openWith,
      reset,
    }),
    [open, messages, pending, draft, productContext, send, retry, openWith, reset],
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) throw new Error('useAssistant must be used inside AssistantProvider')
  return context
}
