import { Link } from "react-router-dom";

/**
 * 404 Not Found page component
 * Displayed when user navigates to a route that doesn't exist
 */
export const NotFound = () => (
  <div className="flex h-full min-h-[400px] flex-col items-center justify-center">
    <h1 className="mb-4 font-bold text-6xl text-gray-900">404</h1>
    <p className="mb-8 text-gray-600 text-xl">Seite nicht gefunden</p>
    <p className="mb-8 max-w-md text-center text-gray-500">
      Die von Ihnen gesuchte Seite existiert nicht oder wurde verschoben.
    </p>
    <Link
      className="rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
      to="/"
    >
      Zurück zur Startseite
    </Link>
  </div>
);
