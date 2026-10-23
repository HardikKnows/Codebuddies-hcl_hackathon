import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider } from './components/Overlay'
import { AssistantProvider } from './features/assistant/AssistantContext'
import { CartProvider } from './features/CartContext'
import { StoreProvider } from './features/StoreContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <StoreProvider>
            <CartProvider>
              <AssistantProvider>
                <App />
              </AssistantProvider>
            </CartProvider>
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
