import { Lock } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '../components/Button'
import { EmptyState } from '../components/States'
import { useAuth } from './AuthContext'

/** Route guard. The backend enforces every permission again; this only keeps the UI honest. */
export function RequireRole({ roles, children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={Lock}
        title="You don't have access to this page"
        description="Your account's role doesn't include this area. Switch to an account with the right role."
        action={
          <Button as={Link} to="/" variant="secondary">
            Back to the store
          </Button>
        }
      />
    )
  }
  return children
}
