import { ListsPage } from './components/ListsPage'
import { VideosPage } from './components/VideosPage'
import { Dashboard } from './pages/Dashboard'
import { NotFound } from './pages/NotFound'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useLists } from './hooks/useLists'

// Hardcoded listId for single-list MVP (will be replaced with Workspaces later)
// This constant uses the first available list from the backend
const FIXED_LIST_ID = 'first-available'

function App() {
  // Listen laden und Zustände auswerten
  const { data: lists, isLoading, isError } = useLists()
  const actualListId = lists?.[0]?.id ?? null

  return (
    <Routes>
      <Route path="/lists" element={<ListsPage />} />
      <Route
        path="/videos"
        element={
          isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">Lade Listen...</p>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-600">Fehler beim Laden der Listen.</p>
            </div>
          ) : actualListId ? (
            <VideosPage listId={actualListId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">Keine Listen gefunden.</p>
            </div>
          )
        }
      />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/" element={<Navigate to="/videos" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
