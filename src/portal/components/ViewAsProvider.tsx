import { createContext, useContext, useState, type ReactNode } from 'react'

interface ViewAsState {
  viewAsCustomerId: string | null
  viewAsCustomerName: string | null
  startViewAs: (customerId: string, customerName: string) => void
  stopViewAs: () => void
  isViewingAs: boolean
}

const ViewAsContext = createContext<ViewAsState | null>(null)

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsCustomerId, setViewAsCustomerId] = useState<string | null>(null)
  const [viewAsCustomerName, setViewAsCustomerName] = useState<string | null>(null)

  const startViewAs = (customerId: string, customerName: string) => {
    setViewAsCustomerId(customerId)
    setViewAsCustomerName(customerName)
  }

  const stopViewAs = () => {
    setViewAsCustomerId(null)
    setViewAsCustomerName(null)
  }

  return (
    <ViewAsContext.Provider value={{
      viewAsCustomerId,
      viewAsCustomerName,
      startViewAs,
      stopViewAs,
      isViewingAs: !!viewAsCustomerId,
    }}>
      {children}
    </ViewAsContext.Provider>
  )
}

export function useViewAs(): ViewAsState {
  const context = useContext(ViewAsContext)
  if (!context) {
    throw new Error('useViewAs must be used within a ViewAsProvider')
  }
  return context
}
