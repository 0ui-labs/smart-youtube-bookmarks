import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import type { Tag } from "@/types/tag";
import { EditTagDialog } from "./EditTagDialog";

const mockTag: Tag = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "Python",
  color: "#3B82F6",
  schema_id: null,
  is_video_type: true,
  user_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  created_at: "2025-11-18T10:00:00Z",
  updated_at: "2025-11-18T10:00:00Z",
};

const mockSchemas = [
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    name: "Tutorial Schema",
    description: "For tutorials",
    list_id: "d4e5f6a7-b8c9-0123-def1-234567890123",
    created_at: "2025-11-18T10:00:00Z",
    updated_at: "2025-11-18T10:00:00Z",
    schema_fields: [],
  },
  {
    id: "e5f6a7b8-c9d0-1234-ef12-345678901234",
    name: "Course Schema",
    description: "For courses",
    list_id: "d4e5f6a7-b8c9-0123-def1-234567890123",
    created_at: "2025-11-18T11:00:00Z",
    updated_at: "2025-11-18T11:00:00Z",
    schema_fields: [],
  },
];

const handlers = [
  http.put("/api/tags/:tagId", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockTag,
      name: body.name || mockTag.name,
      color: body.color || mockTag.color,
      schema_id:
        body.schema_id !== undefined ? body.schema_id : mockTag.schema_id,
    });
  }),
  http.get("/api/lists/:listId/schemas", () => HttpResponse.json(mockSchemas)),
];

beforeEach(() => server.use(...handlers));
afterEach(() => server.resetHandlers());

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("EditTagDialog", () => {
  it("pre-fills form with tag data", () => {
    render(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByDisplayValue("Python")).toBeInTheDocument();
    expect(screen.getByDisplayValue("#3B82F6")).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    render(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByText("Speichern"));

    expect(
      await screen.findByText(/Name ist erforderlich/i)
    ).toBeInTheDocument();
  });

  it("shows validation error for invalid color hex", async () => {
    render(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    // Find the text input for color (not the color picker)
    const colorInputs = screen.getAllByDisplayValue("#3B82F6");
    const textColorInput = colorInputs.find(
      (el) => el.getAttribute("type") !== "color"
    );
    if (textColorInput) {
      fireEvent.change(textColorInput, { target: { value: "invalid" } });
      fireEvent.click(screen.getByText("Speichern"));

      expect(
        await screen.findByText(/Ungültiges Farbformat/i)
      ).toBeInTheDocument();
    }
  });

  it("calls onClose after successful update", async () => {
    const onClose = vi.fn();
    render(
      <EditTagDialog
        listId="list-1"
        onClose={onClose}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });
    fireEvent.click(screen.getByText("Speichern"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows loading state on Save button while saving", async () => {
    // Delay the response to see loading state
    server.use(
      http.put("/api/tags/:tagId", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ ...mockTag, name: "Updated" });
      })
    );

    render(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });
    fireEvent.click(screen.getByText("Speichern"));

    // Should show loading text
    expect(await screen.findByText("Speichert...")).toBeInTheDocument();
  });

  it("shows the field editor empty state when no schema is assigned", async () => {
    render(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Keine Felder konfiguriert/)).toBeInTheDocument();
  });

  it("resets form when dialog closes", async () => {
    const { rerender } = render(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    // Change the name
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Changed Name" } });

    // Close the dialog
    rerender(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={false}
        tag={mockTag}
      />
    );

    // Reopen
    rerender(
      <EditTagDialog
        listId="list-1"
        onClose={vi.fn()}
        open={true}
        tag={mockTag}
      />
    );

    // Should be back to original value
    await waitFor(() => {
      expect(screen.getByDisplayValue("Python")).toBeInTheDocument();
    });
  });

  it("handles API error gracefully", async () => {
    server.use(
      http.put("/api/tags/:tagId", () =>
        HttpResponse.json(
          { detail: "Tag name already exists" },
          { status: 409 }
        )
      )
    );

    const onClose = vi.fn();
    render(
      <EditTagDialog
        listId="list-1"
        onClose={onClose}
        open={true}
        tag={mockTag}
      />,
      { wrapper: createWrapper() }
    );

    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Duplicate Name" } });
    fireEvent.click(screen.getByText("Speichern"));

    // Should show error message and NOT close
    await waitFor(() => {
      expect(screen.getByText(/tag name already exists/i)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
