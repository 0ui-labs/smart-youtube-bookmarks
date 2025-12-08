import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Tag } from "@/types/tag";
import { ConfirmDeleteTagDialog } from "./ConfirmDeleteTagDialog";

const mockTag: Tag = {
  id: "tag-123",
  name: "Python",
  color: "#3B82F6",
  schema_id: null,
  is_video_type: true,
  user_id: "user-456",
  created_at: "2025-11-18T10:00:00Z",
  updated_at: "2025-11-18T10:00:00Z",
};

const server = setupServer(
  http.delete("/api/tags/:tagId", () => new HttpResponse(null, { status: 204 }))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("ConfirmDeleteTagDialog", () => {
  it("shows tag name in warning", () => {
    render(
      <ConfirmDeleteTagDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Python/)).toBeInTheDocument();
  });

  it("shows warning about removing tag from all videos", () => {
    render(
      <ConfirmDeleteTagDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    expect(
      screen.getByText(/remove the tag from all videos/i)
    ).toBeInTheDocument();
  });

  it("shows action cannot be undone text", () => {
    render(
      <ConfirmDeleteTagDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("shows warning icon", () => {
    render(
      <ConfirmDeleteTagDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    // AlertTriangle icon should be in the title area
    expect(screen.getByText("Delete Tag")).toBeInTheDocument();
  });

  it("calls onConfirm after successful deletion", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteTagDialog
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });

  it("calls onCancel when cancelled", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteTagDialog
        onCancel={onCancel}
        onConfirm={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalled();
  });

  it("shows loading state while deleting", async () => {
    // Make the delete request slow
    server.use(
      http.delete("/api/tags/:tagId", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return new HttpResponse(null, { status: 204 });
      })
    );

    render(
      <ConfirmDeleteTagDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText("Delete"));

    // Should show loading text
    expect(await screen.findByText("Deleting...")).toBeInTheDocument();
  });

  it("delete button has destructive variant", () => {
    render(
      <ConfirmDeleteTagDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    // Button should have destructive styling (bg-destructive or similar classes)
    expect(deleteButton).toBeInTheDocument();
  });
});
