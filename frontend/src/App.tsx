import { useState } from 'react'
import { ListsPage } from './components/ListsPage'
import { VideosPage } from './components/VideosPage'
import { Dashboard } from './pages/Dashboard'

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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 h-16 items-center">
            <button
              onClick={() => setCurrentView('lists')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'lists'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Lists
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {currentView === 'lists' && <ListsPage onSelectList={handleSelectList} />}
      {currentView === 'videos' && selectedListId && (
        <VideosPage listId={selectedListId} onBack={handleBackToLists} />
      )}
      {currentView === 'dashboard' && <Dashboard />}
    </div>
  )
}

export default App
