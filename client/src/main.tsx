import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { shouldRetry } from '@/hooks/useTrips'
import { CreateTripPage } from '@/pages/CreateTripPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EditTripPage } from '@/pages/EditTripPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteError } from '@/pages/RouteError'
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
      { index: true, element: <DashboardPage /> },
      { path: 'trips/new', element: <CreateTripPage /> },
      { path: 'trips/:tripId', element: <TripDetailsPage /> },
      { path: 'trips/:tripId/edit', element: <EditTripPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
