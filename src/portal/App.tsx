import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './components/AuthProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PortalLayout } from './components/PortalLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import '../styles/portal.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/portal/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/portal" element={<Dashboard />} />
              <Route path="/portal/orders" element={<Placeholder title="Orders" />} />
              <Route path="/portal/invoices" element={<Placeholder title="Invoices" />} />
              <Route path="/portal/payments" element={<Placeholder title="Payments" />} />
              <Route path="/portal/price-list" element={<Placeholder title="Price List" />} />
              <Route path="/portal/profile" element={<Placeholder title="Profile" />} />
            </Route>
            <Route path="/portal/*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--portal-font-heading)', fontSize: 'var(--portal-text-2xl)', marginBottom: 'var(--portal-space-sm)' }}>{title}</h1>
      <p style={{ color: 'var(--portal-text-muted)' }}>This section is coming soon.</p>
    </div>
  )
}
