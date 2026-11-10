import { ClerkProvider } from "@clerk/react";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionBoundary } from "./components/auth/SessionBoundary";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WebSocketProvider } from "./components/WebSocketProvider";
import { getQueryClient } from "./lib/queryClient";
import { initializeTheme } from "./stores";
import "./index.css";

// Initialize theme before first render to prevent flash of wrong theme
initializeTheme();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <ErrorBoundary>
          <QueryClientProvider client={getQueryClient()}>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <SessionBoundary>
                <WebSocketProvider>
                  <App />
                </WebSocketProvider>
              </SessionBoundary>
            </BrowserRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </ClerkProvider>
    ) : (
      <main>
        <p role="alert">Die Anmeldung ist noch nicht konfiguriert.</p>
      </main>
    )}
  </React.StrictMode>
);
