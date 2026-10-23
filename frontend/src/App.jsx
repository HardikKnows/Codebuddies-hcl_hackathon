import { Compass } from 'lucide-react'
import { Link, Route, Routes } from 'react-router'
import { MANAGER_ROLES, STAFF_ROLES } from './auth/AuthContext'
import { RequireRole } from './auth/RequireRole'
import { Button } from './components/Button'
import { EmptyState } from './components/States'
import { OpsLayout } from './layouts/OpsLayout'
import { StorefrontLayout } from './layouts/StorefrontLayout'
import { LoginPage } from './pages/LoginPage'
import { AuditPage } from './pages/ops/AuditPage'
import { InventoryPage } from './pages/ops/InventoryPage'
import { KnowledgePage } from './pages/ops/KnowledgePage'
import { OpsOrdersPage } from './pages/ops/OpsOrdersPage'
import { OverviewPage } from './pages/ops/OverviewPage'
import { TicketsPage } from './pages/ops/TicketsPage'
import { CartPage } from './pages/storefront/CartPage'
import { CatalogPage } from './pages/storefront/CatalogPage'
import { OrderDetailPage, OrdersPage } from './pages/storefront/OrdersPages'
import { ProductPage } from './pages/storefront/ProductPage'

function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you were looking for doesn't exist."
      action={
        <Button as={Link} to="/" variant="secondary">
          Back to the store
        </Button>
      }
    />
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<StorefrontLayout />}>
        <Route index element={<CatalogPage />} />
        <Route path="products/:sku" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route
          path="orders"
          element={
            <RequireRole roles={['CUSTOMER']}>
              <OrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="orders/:orderNumber"
          element={
            <RequireRole>
              <OrderDetailPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="/ops"
        element={
          <RequireRole roles={STAFF_ROLES}>
            <OpsLayout />
          </RequireRole>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="orders" element={<OpsOrdersPage />} />
        <Route
          path="audit"
          element={
            <RequireRole roles={MANAGER_ROLES}>
              <AuditPage />
            </RequireRole>
          }
        />
        <Route
          path="knowledge"
          element={
            <RequireRole roles={MANAGER_ROLES}>
              <KnowledgePage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
