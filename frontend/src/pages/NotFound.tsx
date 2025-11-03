import { Link } from 'react-router-dom'

/**
 * 404 Not Found page component
 * Displayed when user navigates to a route that doesn't exist
 */
export const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-xl text-gray-600 mb-8">Seite nicht gefunden</p>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        Die von Ihnen gesuchte Seite existiert nicht oder wurde verschoben.
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Zurück zur Startseite
      </Link>
    </div>
  )
}
