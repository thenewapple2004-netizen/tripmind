import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/hooks/useAuth'
import { shouldRetry } from '@/hooks/useTrips'
import { CreateTripPage } from '@/pages/CreateTripPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { EditTripPage } from '@/pages/EditTripPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { ItineraryPage } from '@/pages/ItineraryPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OwnerPortalPage } from '@/pages/OwnerPortalPage'
import { PlannerPage } from '@/pages/PlannerPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { RouteError } from '@/pages/RouteError'
import { SettingsPage } from '@/pages/SettingsPage'
import { TripDetailsPage } from '@/pages/TripDetailsPage'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
    },
  },
})

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        index: true,
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'trips/new',
        element: (
          <ProtectedRoute>
            <CreateTripPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'trips/:tripId',
        element: (
          <ProtectedRoute>
            <TripDetailsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'trips/:tripId/edit',
        element: (
          <ProtectedRoute>
            <EditTripPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'portal',
        element: (
          <ProtectedRoute>
            <OwnerPortalPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'itinerary',
        element: (
          <ProtectedRoute>
            <ItineraryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'expenses',
        element: (
          <ProtectedRoute>
            <ExpensesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'documents',
        element: (
          <ProtectedRoute>
            <DocumentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'planner',
        element: (
          <ProtectedRoute>
            <PlannerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
