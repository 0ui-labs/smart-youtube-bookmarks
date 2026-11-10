import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

const state = vi.hoisted(() => ({
  listLoading: false,
  tagLoading: false,
  tagError: false,
  tags: [] as any[],
  refetch: vi.fn(),
}));
vi.mock("@/hooks/useLists", () => ({
  useLists: () => ({
    data: [{ id: "list-1", name: "Sammlung" }],
    isLoading: state.listLoading,
  }),
  useUpdateList: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/useTags", () => ({
  useTags: () => ({
    data: state.tags,
    isLoading: state.tagLoading,
    isError: state.tagError,
    refetch: state.refetch,
  }),
  useCreateTag: () => ({ mutateAsync: vi.fn() }),
  useUpdateTag: () => ({ mutateAsync: vi.fn() }),
  useDeleteTag: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/useSchemas", async () => ({
  ...(await vi.importActual("@/hooks/useSchemas")),
  useSchemas: () => ({ data: [], isLoading: false }),
  useSchema: () => ({ data: undefined }),
  useSchemaUsageStats: () => ({ count: 0, tagNames: [] }),
}));
vi.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: () => ({ data: [], isLoading: false }),
  useCreateCustomField: () => ({ mutateAsync: vi.fn() }),
  useUpdateCustomField: () => ({ mutate: vi.fn() }),
  useDeleteCustomField: () => ({ mutate: vi.fn() }),
  useFieldUsageCounts: () => new Map(),
}));
const showSettings = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
beforeEach(() => {
  state.listLoading = false;
  state.tagLoading = false;
  state.tagError = false;
  state.tags = [];
  state.refetch.mockClear();
});
it("renders the German settings heading", () => {
  showSettings();
  expect(screen.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
});
it("exposes the current categories subscriptions and design tabs", () => {
  showSettings();
  for (const name of ["Kategorien", "Abos", "Design"])
    expect(screen.getByRole("tab", { name })).toBeVisible();
});
it("selects categories by default", () => {
  showSettings();
  expect(screen.getByRole("tab", { name: "Kategorien" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});
it("offers creating a category", () => {
  showSettings();
  expect(screen.getByRole("button", { name: "Neue Kategorie" })).toBeEnabled();
});
it("waits for the collection before rendering its controls", () => {
  state.listLoading = true;
  showSettings();
  expect(screen.getByText("Lade Daten...")).toBeVisible();
});
it("shows category loading separately", () => {
  state.tagLoading = true;
  showSettings();
  expect(screen.getByText("Lade Kategorien...")).toBeVisible();
});
it("reports category failures instead of showing an empty collection", () => {
  state.tagError = true;
  showSettings();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Kategorien konnten nicht geladen werden"
  );
});
it("shows the category empty state", () => {
  showSettings();
  expect(screen.getByText(/Keine Kategorien/i)).toBeVisible();
});
it("renders persisted categories", () => {
  state.tags = [
    {
      id: "cat-1",
      name: "Tutorial",
      is_video_type: true,
      color: null,
      schema_id: null,
    },
  ];
  showSettings();
  expect(screen.getByText("Tutorial")).toBeVisible();
});
