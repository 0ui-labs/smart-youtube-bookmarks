import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaEditor } from "./SchemaEditor";

// Mock useCustomFields hook and related exports
vi.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: () => ({
    data: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "First field",
        field_type: "text",
        config: {},
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Second field",
        field_type: "rating",
        config: { max_rating: 5 },
      },
    ],
    isLoading: false,
  }),
  useCheckDuplicateField: () => ({
    data: { exists: false, field: null },
    isLoading: false,
  }),
  useCreateCustomField: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe("SchemaEditor", () => {
  let queryClient: QueryClient;
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderSchemaEditor = (props: {
    listId: string;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    initialData?: any;
  }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <SchemaEditor {...props} />
      </QueryClientProvider>
    );

  it("renders schema metadata fields", () => {
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    expect(screen.getByLabelText(/schema-name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/beschreibung/i)).toBeInTheDocument();
  });

  it("shows validation error for empty schema name", async () => {
    const user = userEvent.setup();
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    await user.click(screen.getByRole("button", { name: /schema erstellen/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/schema-name ist erforderlich/i)
      ).toBeInTheDocument();
    });
  });

  it("shows validation error for whitespace-only schema name", async () => {
    const user = userEvent.setup();
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    await user.type(screen.getByLabelText(/schema-name/i), "   ");
    await user.click(screen.getByRole("button", { name: /schema erstellen/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/darf nicht nur aus leerzeichen bestehen/i)
      ).toBeInTheDocument();
    });
  });

  it("shows validation error for too long schema name", async () => {
    const user = userEvent.setup();
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    const longName = "a".repeat(256); // 256 characters
    await user.type(screen.getByLabelText(/schema-name/i), longName);
    await user.click(screen.getByRole("button", { name: /schema erstellen/i }));

    await waitFor(() => {
      expect(screen.getByText(/maximal 255 zeichen/i)).toBeInTheDocument();
    });
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    await user.click(screen.getByRole("button", { name: /abbrechen/i }));

    expect(mockOnCancel).toHaveBeenCalledOnce();
  });

  it('shows new field form when "Neues Feld" clicked', async () => {
    const user = userEvent.setup();
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    await user.click(screen.getByRole("button", { name: /neues feld/i }));

    expect(screen.getByLabelText(/field name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Field/i })
    ).toBeInTheDocument();
  });

  it("hides new field form when close button clicked", async () => {
    const user = userEvent.setup();
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    // Open form
    await user.click(screen.getByRole("button", { name: /neues feld/i }));
    expect(screen.getByLabelText(/field name/i)).toBeInTheDocument();

    // Close form
    const closeButton = screen.getByRole("button", { name: /^Cancel$/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByLabelText(/field name/i)).not.toBeInTheDocument();
    });
  });

  it("shows empty state when no fields added", () => {
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    expect(screen.getByText(/noch keine felder/i)).toBeInTheDocument();
    expect(screen.getByText(/felder \(0\)/i)).toBeInTheDocument();
  });

  it("shows field count in header", () => {
    const initialData = {
      fields: [
        {
          field_id: "11111111-1111-4111-8111-111111111111",
          display_order: 0,
          show_on_card: false,
        },
        {
          field_id: "22222222-2222-4222-8222-222222222222",
          display_order: 1,
          show_on_card: true,
        },
      ],
    };

    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      initialData,
    });

    expect(screen.getByText(/felder \(2\)/i)).toBeInTheDocument();
  });

  it("renders field placeholders for initial data", () => {
    const initialData = {
      name: "Test Schema",
      description: "Test Description",
      fields: [
        {
          field_id: "11111111-1111-4111-8111-111111111111",
          display_order: 0,
          show_on_card: false,
        },
        {
          field_id: "22222222-2222-4222-8222-222222222222",
          display_order: 1,
          show_on_card: true,
        },
      ],
    };

    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      initialData,
    });

    expect(screen.getByText("First field")).toBeInTheDocument();
    expect(screen.getByText("Second field")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Schema")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Description")).toBeInTheDocument();
  });

  it("allows removing fields via remove button", async () => {
    const user = userEvent.setup();
    const initialData = {
      fields: [
        {
          field_id: "11111111-1111-4111-8111-111111111111",
          display_order: 0,
          show_on_card: false,
        },
      ],
    };

    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
      initialData,
    });

    expect(screen.getByText("First field")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /entfernen/i }));

    await waitFor(() => {
      expect(screen.queryByText("First field")).not.toBeInTheDocument();
      expect(screen.getByText(/noch keine felder/i)).toBeInTheDocument();
    });
  });

  it("shows loading state during form submission", async () => {
    const user = userEvent.setup();
    let _resolvePromise: () => void;
    const slowOnSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          _resolvePromise = resolve;
        })
    );

    // Render with initial data that already has a field
    renderSchemaEditor({
      listId: "list-1",
      onSave: slowOnSave,
      onCancel: mockOnCancel,
      initialData: {
        name: "Test Schema",
        fields: [
          {
            field_id: "11111111-1111-4111-8111-111111111111",
            display_order: 0,
            show_on_card: false,
          },
        ],
      },
    });

    const submitButton = screen.getByRole("button", {
      name: /schema erstellen/i,
    });

    // Start submission (don't await yet)
    user.click(submitButton);

    // Check for loading state immediately
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /wird gespeichert/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /wird gespeichert/i })
      ).toBeDisabled();
    });
  });

  it("shows validation error when submitting without fields", async () => {
    const user = userEvent.setup();
    renderSchemaEditor({
      listId: "list-1",
      onSave: mockOnSave,
      onCancel: mockOnCancel,
    });

    await user.type(screen.getByLabelText(/schema-name/i), "Test Schema");
    await user.click(screen.getByRole("button", { name: /schema erstellen/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/mindestens ein feld ist erforderlich/i)
      ).toBeInTheDocument();
    });
  });

  it("handles 409 conflict error from backend", async () => {
    const user = userEvent.setup();
    const errorOnSave = vi.fn().mockRejectedValue({
      response: { status: 409 },
    });

    renderSchemaEditor({
      listId: "list-1",
      onSave: errorOnSave,
      onCancel: mockOnCancel,
      initialData: {
        fields: [
          {
            field_id: "11111111-1111-4111-8111-111111111111",
            display_order: 0,
            show_on_card: false,
          },
        ],
      },
    });

    await user.type(screen.getByLabelText(/schema-name/i), "Duplicate Schema");
    await user.click(screen.getByRole("button", { name: /schema erstellen/i }));

    await waitFor(
      () => {
        expect(
          screen.getByText(/schema mit diesem namen existiert bereits/i)
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("handles 422 validation error from backend", async () => {
    const user = userEvent.setup();
    const errorOnSave = vi.fn().mockRejectedValue({
      response: {
        status: 422,
        data: { detail: "Invalid schema configuration" },
      },
    });

    renderSchemaEditor({
      listId: "list-1",
      onSave: errorOnSave,
      onCancel: mockOnCancel,
      initialData: {
        fields: [
          {
            field_id: "11111111-1111-4111-8111-111111111111",
            display_order: 0,
            show_on_card: false,
          },
        ],
      },
    });

    await user.type(screen.getByLabelText(/schema-name/i), "Test Schema");
    await user.click(screen.getByRole("button", { name: /schema erstellen/i }));

    await waitFor(
      () => {
        expect(
          screen.getByText(/invalid schema configuration/i)
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("handles generic network error", async () => {
    const user = userEvent.setup();
    const errorOnSave = vi.fn().mockRejectedValue(new Error("Network error"));

    renderSchemaEditor({
      listId: "list-1",
      onSave: errorOnSave,
      onCancel: mockOnCancel,
      initialData: {
        fields: [
          {
            field_id: "11111111-1111-4111-8111-111111111111",
            display_order: 0,
            show_on_card: false,
          },
        ],
      },
    });

    await user.type(screen.getByLabelText(/schema-name/i), "Test Schema");
    await user.click(screen.getByRole("button", { name: /schema erstellen/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/fehler beim speichern/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
