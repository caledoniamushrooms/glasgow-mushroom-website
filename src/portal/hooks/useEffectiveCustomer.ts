import { useAuthContext } from '../components/AuthProvider'
import { useViewAs } from '../components/ViewAsProvider'

/**
 * Returns the effective customer ID — either the View As target
 * or the logged-in user's own customer.
 */
export function useEffectiveCustomerId(): string | undefined {
  const { portalUser } = useAuthContext()
  const { viewAsCustomerId } = useViewAs()
  return viewAsCustomerId || portalUser?.customer_id
}
