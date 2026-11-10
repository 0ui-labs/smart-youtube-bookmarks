import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useTagStore } from "@/stores/tagStore";
import { SessionBoundary } from "./SessionBoundary";

const auth = vi.hoisted(() => ({
  isLoaded: true,
  userId: "user-a" as string | null,
  sessionId: "session-a" as string | null,
  getToken: vi.fn(async () => "synthetic-token"),
}));
vi.mock("@clerk/react", () => ({
  useAuth: () => auth,
  SignIn: () => <div>Anmelden</div>,
  UserButton: () => <button>Konto</button>,
}));
let observed: QueryClient;
function Probe() {
  observed = useQueryClient();
  return <div>Private Ansicht</div>;
}
beforeEach(() => {
  auth.isLoaded = true;
  auth.userId = "user-a";
  auth.sessionId = "session-a";
});
const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionBoundary>
        <Probe />
      </SessionBoundary>
    </QueryClientProvider>
  );

it("waits for Clerk before mounting private queries", () => {
  auth.isLoaded = false;
  show();
  expect(screen.queryByText("Private Ansicht")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Anmeldung wird geprüft"
  );
});
it("shows sign-in without mounting private views", () => {
  auth.userId = null;
  auth.sessionId = null;
  show();
  expect(screen.getByText("Anmelden")).toBeVisible();
  expect(screen.queryByText("Private Ansicht")).not.toBeInTheDocument();
});
it("creates a clean cache for B and isolates late A callbacks", async () => {
  const view = show();
  await screen.findByText("Private Ansicht");
  const clientA = observed;
  clientA.setQueryData(["private"], "A secret");
  useTagStore.getState().setSelectedTagIds(["private-a"]);
  auth.userId = "user-b";
  auth.sessionId = "session-b";
  view.rerender(
    <QueryClientProvider client={new QueryClient()}>
      <SessionBoundary>
        <Probe />
      </SessionBoundary>
    </QueryClientProvider>
  );
  await waitFor(() => expect(observed).not.toBe(clientA));
  const clientB = observed;
  clientA.setQueryData(["private"], "late A mutation");
  expect(clientB.getQueryData(["private"])).toBeUndefined();
  expect(useTagStore.getState().selectedTagIds).toEqual([]);
  expect(localStorage.getItem("tag-filter-selection")).toBeNull();
});
