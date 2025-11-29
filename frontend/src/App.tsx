import { Navigate, Route, Routes } from "react-router-dom";
import { ListsPage } from "./components/ListsPage";
import { MainLayout } from "./components/MainLayout";
import { VideosPage } from "./components/VideosPage";
import { useLists } from "./hooks/useLists";
import { ChannelsPage } from "./pages/ChannelsPage";
import { Dashboard } from "./pages/Dashboard";
import { NotFound } from "./pages/NotFound";
import { SettingsPage } from "./pages/SettingsPage";
import { VideoDetailsPage } from "./pages/VideoDetailsPage";

function App() {
  // Listen laden und Zustände auswerten
  const { data: lists, isLoading, isError } = useLists();
  const actualListId = lists?.[0]?.id ?? null;

  return (
    <Routes>
      {/* Routes with MainLayout (shared sidebar) */}
      <Route element={<MainLayout />}>
        <Route
          element={
            isLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-gray-600">Lade Listen...</p>
              </div>
            ) : isError ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-red-600">Fehler beim Laden der Listen.</p>
              </div>
            ) : actualListId ? (
              <VideosPage listId={actualListId} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-gray-600">Keine Listen gefunden.</p>
              </div>
            )
          }
          path="/videos"
        />
        <Route element={<VideoDetailsPage />} path="/videos/:videoId" />
        <Route element={<ChannelsPage />} path="/channels" />
        <Route element={<Dashboard />} path="/dashboard" />
        <Route element={<SettingsPage />} path="/settings/schemas" />
      </Route>

      {/* Routes without MainLayout */}
      <Route element={<ListsPage />} path="/lists" />
      <Route element={<Navigate replace to="/videos" />} path="/" />
      <Route element={<NotFound />} path="*" />
    </Routes>
  );
}

export default App;
