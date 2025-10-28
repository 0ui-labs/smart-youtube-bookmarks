import { useState } from 'react'
import { ListsPage } from './components/ListsPage'
import { VideosPage } from './components/VideosPage'

function App() {
  const [currentView, setCurrentView] = useState<'lists' | 'videos'>('lists')
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
      {currentView === 'lists' && <ListsPage onSelectList={handleSelectList} />}
      {currentView === 'videos' && selectedListId && (
        <VideosPage listId={selectedListId} onBack={handleBackToLists} />
      )}
    </div>
  )
}

export default App
