import { CollapsibleSidebar } from './components/CollapsibleSidebar'
import { ListsPage } from './components/ListsPage'
import { VideosPage } from './components/VideosPage'
import { Dashboard } from './pages/Dashboard'
import { useState } from 'react'

function App() {
  const [currentView, setCurrentView] = useState<'lists' | 'videos' | 'dashboard'>('lists')
  const [selectedListId, setSelectedListId] = useState<string | null>(null)

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId)
    setCurrentView('videos')
  }

  const handleBackToLists = () => {
    setCurrentView('lists')
    setSelectedListId(null)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <CollapsibleSidebar>
        <nav className="flex flex-col gap-2 p-4">
          <h2 className="text-lg font-semibold mb-4">Navigation</h2>
          <button
            onClick={() => setCurrentView('lists')}
            className={`px-3 py-2 rounded text-left hover:bg-gray-100 ${
              currentView === 'lists' ? 'bg-gray-100 font-medium' : ''
            }`}
          >
            Lists
          </button>
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`px-3 py-2 rounded text-left hover:bg-gray-100 ${
              currentView === 'dashboard' ? 'bg-gray-100 font-medium' : ''
            }`}
          >
            Dashboard
          </button>
        </nav>
      </CollapsibleSidebar>

      <main className="flex-1 overflow-y-auto p-8">
        {currentView === 'lists' && <ListsPage onSelectList={handleSelectList} />}
        {currentView === 'videos' && selectedListId && (
          <VideosPage listId={selectedListId} onBack={handleBackToLists} />
        )}
        {currentView === 'dashboard' && <Dashboard />}
      </main>
    </div>
  )
}

export default App
