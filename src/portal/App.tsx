import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuthContext } from './components/AuthProvider'
import { ViewAsProvider } from './components/ViewAsProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ModuleGate } from './components/ModuleGate'
import { PortalLayout } from './components/PortalLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Invoices } from './pages/Invoices'
import { Payments } from './pages/Payments'
import { Accounts } from './pages/Accounts'
import { Profile } from './pages/Profile'
import { Orders } from './pages/Orders'
import { NewOrder } from './pages/NewOrder'
import { RecurringOrders } from './pages/RecurringOrders'
import { PriceList } from './pages/PriceList'
import { Team } from './pages/Team'
import { Markets } from './pages/Markets'
import { PartnerLogos } from './pages/PartnerLogos'
import { DeliveryNotes } from './pages/DeliveryNotes'
import { Promotions } from './pages/Promotions'
import { Stockouts } from './pages/Stockouts'
import { Customers } from './pages/admin/Customers'
import { Registrations } from './pages/admin/Registrations'
import '../styles/portal-tailwind.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

// /portal: shows Login when unauthenticated, Dashboard (inside the
// PortalLayout sidebar) when authenticated. Same URL in both states.
function PortalRoot() {
  const { isAuthenticated, loading } = useAuthContext()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-fixed p-4"
           style={{ backgroundImage: "url('/images/splash-hero.jpg')" }}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8">
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        </div>
      </div>
    )
  }
  if (!isAuthenticated) return <Login />
  return <PortalLayout><Dashboard /></PortalLayout>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ViewAsProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            {/* /portal renders the login form when unauthenticated, the
                dashboard when authenticated — URL stays /portal in both
                states. /portal/login kept as a back-compat alias. */}
            <Route path="/portal" element={<PortalRoot />} />
            <Route path="/portal/login" element={<Navigate to="/portal" replace />} />
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

              {/* Ordering */}
              <Route path="/portal/orders" element={<ModuleGate moduleKey="ordering"><Orders /></ModuleGate>} />
              <Route path="/portal/orders/new" element={<ModuleGate moduleKey="ordering"><NewOrder /></ModuleGate>} />

              {/* Recurring orders */}
              <Route path="/portal/orders/recurring" element={<ModuleGate moduleKey="recurring_orders"><RecurringOrders /></ModuleGate>} />

              {/* Accounts (combined invoices + payments) */}
              <Route path="/portal/accounts" element={<ModuleGate moduleKey="accounts"><Accounts /></ModuleGate>} />
              {/* Legacy routes redirect to accounts */}
              <Route path="/portal/invoices" element={<ModuleGate moduleKey="accounts"><Accounts /></ModuleGate>} />
              <Route path="/portal/payments" element={<ModuleGate moduleKey="accounts"><Accounts /></ModuleGate>} />

              {/* Pricing */}
              <Route path="/portal/price-list" element={<ModuleGate moduleKey="pricing"><PriceList /></ModuleGate>} />

              {/* Delivery notes */}
              <Route path="/portal/delivery-notes" element={<ModuleGate moduleKey="delivery_notes"><DeliveryNotes /></ModuleGate>} />

              {/* Promotions */}
              <Route path="/portal/promotions" element={<ModuleGate moduleKey="promotions"><Promotions /></ModuleGate>} />

              {/* Stockouts */}
              <Route path="/portal/stockouts" element={<ModuleGate moduleKey="stockouts"><Stockouts /></ModuleGate>} />

              {/* Team */}
              <Route path="/portal/team" element={<ModuleGate moduleKey="team"><Team /></ModuleGate>} />

              {/* Always-on */}
              <Route path="/portal/profile" element={<Profile />} />

              {/* Admin (system_admin only) */}
              <Route path="/portal/admin/customers" element={
                <ProtectedRoute requireSystemAdmin><Customers /></ProtectedRoute>
              } />
              <Route path="/portal/admin/registrations" element={
                <ProtectedRoute requireSystemAdmin><Registrations /></ProtectedRoute>
              } />
              <Route path="/portal/markets" element={<Markets />} />
              <Route path="/portal/partner-logos" element={<PartnerLogos />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="/portal/*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </BrowserRouter>
        </ViewAsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
