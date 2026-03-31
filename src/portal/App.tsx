import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './components/AuthProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PortalLayout } from './components/PortalLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Invoices } from './pages/Invoices'
import { Payments } from './pages/Payments'
import { Profile } from './pages/Profile'
import { Orders } from './pages/Orders'
import { NewOrder } from './pages/NewOrder'
import { RecurringOrders } from './pages/RecurringOrders'
import { PriceList } from './pages/PriceList'
import { Team } from './pages/Team'
import { EditOrder } from './pages/EditOrder'
import { StockoutReport } from './pages/StockoutReport'
import '../styles/portal-tailwind.css'

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
            {/* Public routes */}
            <Route path="/portal/login" element={<Login />} />
            <Route path="/portal/register" element={<Register />} />
            <Route path="/portal/forgot-password" element={<ForgotPassword />} />
            <Route path="/portal/onboarding" element={<Onboarding />} />

            {/* Protected routes wrapped in layout */}
            <Route
              element={
                <ProtectedRoute>
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/portal" element={<Dashboard />} />
              <Route path="/portal/orders" element={<Orders />} />
              <Route path="/portal/orders/new" element={<NewOrder />} />
              <Route path="/portal/orders/:id/edit" element={<EditOrder />} />
              <Route path="/portal/orders/stockout" element={<StockoutReport />} />
              <Route path="/portal/orders/recurring" element={<RecurringOrders />} />
              <Route path="/portal/invoices" element={<Invoices />} />
              <Route path="/portal/payments" element={<Payments />} />
              <Route path="/portal/price-list" element={<PriceList />} />
              <Route path="/portal/profile" element={<Profile />} />
              <Route path="/portal/team" element={<Team />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="/portal/*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
