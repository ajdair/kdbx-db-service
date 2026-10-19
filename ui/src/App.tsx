import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { ConfigPage } from '@/features/config/ConfigPage'
import { DeletePage } from '@/features/delete/DeletePage'
import { HomePage } from '@/features/home/HomePage'
import { IngestPage } from '@/features/ingest/IngestPage'
import { ResourcesPage } from '@/features/resources/ResourcesPage'
import { TablesPage } from '@/features/tables/TablesPage'
import { AppStateProvider } from '@/lib/app-state'

// The query page pulls in the code editor and charts, so load it on demand.
const QueryPage = lazy(() => import('@/features/query/QueryPage').then((m) => ({ default: m.QueryPage })))

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 5_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="tables" element={<TablesPage />} />
              <Route path="query" element={<Suspense fallback={null}><QueryPage /></Suspense>} />
              <Route path="ingest" element={<IngestPage />} />
              <Route path="delete" element={<DeletePage />} />
              <Route path="config" element={<ConfigPage />} />
              <Route path="resources" element={<ResourcesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppStateProvider>
    </QueryClientProvider>
  )
}
