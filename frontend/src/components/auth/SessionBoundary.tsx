import { SignIn, UserButton, useAuth } from "@clerk/react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { resetUserSession } from "@/lib/resetUserSession";
import { configureSessionTransport } from "@/lib/sessionTransport";

/** A fresh cache per login also isolates late mutation callbacks from old users. */
export function SessionBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, userId, sessionId, getToken } = useAuth();
  const defaults = useQueryClient();
  const privateClient = useRef<QueryClient>();
  const [prepared, setPrepared] = useState<{
    key: string;
    client: QueryClient;
  } | null>(null);
  const identity = userId && sessionId ? `${userId}:${sessionId}` : null;
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const oldClient = privateClient.current;
    privateClient.current = undefined;
    void resetUserSession(oldClient ?? defaults).then(() => {
      if (cancelled || !isLoaded || !identity) return;
      const client = new QueryClient({
        defaultOptions: defaults.getDefaultOptions(),
      });
      privateClient.current = client;
      dispose = configureSessionTransport(getToken);
      setPrepared({ key: identity, client });
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [isLoaded, identity, getToken, defaults]);
  if (!isLoaded) return <p role="status">Anmeldung wird geprüft…</p>;
  if (!userId)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <SignIn routing="hash" />
      </main>
    );
  if (!identity || prepared?.key !== identity)
    return <p role="status">Sitzung wird vorbereitet…</p>;
  return (
    <QueryClientProvider client={prepared.client} key={identity}>
      <div className="flex justify-end p-2">
        <UserButton />
      </div>
      {children}
    </QueryClientProvider>
  );
}
