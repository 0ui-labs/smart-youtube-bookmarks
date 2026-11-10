import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("switches to design settings", async () => {
  showSettings();
  await userEvent.click(screen.getByRole("tab", { name: "Design" }));
  expect(screen.getByRole("tab", { name: "Design" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});
it("switches back to category settings", async () => {
  showSettings();
  await userEvent.click(screen.getByRole("tab", { name: "Design" }));
  await userEvent.click(screen.getByRole("tab", { name: "Kategorien" }));
  expect(
    screen.getByRole("heading", { name: "Kategorien & Labels" })
  ).toBeVisible();
});
it("opens category creation", async () => {
  showSettings();
  await userEvent.click(screen.getByRole("button", { name: "Neue Kategorie" }));
  expect(screen.getByRole("alertdialog")).toBeVisible();
});
it("cancels category creation", async () => {
  showSettings();
  await userEvent.click(screen.getByRole("button", { name: "Neue Kategorie" }));
  await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
it("retries a failed category query", async () => {
  state.tagError = true;
  showSettings();
  await userEvent.click(
    screen.getByRole("button", { name: "Erneut versuchen" })
  );
  expect(state.refetch).toHaveBeenCalledTimes(1);
});
it("shows category labels returned from persistence", () => {
  state.tags = [
    {
      id: "a",
      name: "Kochrezepte",
      is_video_type: true,
      color: null,
      schema_id: null,
    },
  ];
  showSettings();
  expect(screen.getByText("Kochrezepte")).toBeVisible();
});
it("renders labels alongside categories", () => {
  state.tags = [
    {
      id: "a",
      name: "Gesehen",
      is_video_type: false,
      color: null,
      schema_id: null,
    },
  ];
  showSettings();
  expect(screen.getByText("Gesehen")).toBeVisible();
});
it("keeps navigation available during a category request", () => {
  state.tagLoading = true;
  showSettings();
  expect(screen.getByRole("tab", { name: "Abos" })).toBeEnabled();
});
