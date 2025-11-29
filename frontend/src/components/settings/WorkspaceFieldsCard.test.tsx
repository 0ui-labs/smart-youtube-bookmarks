import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFieldsCard } from "./WorkspaceFieldsCard";

// Mock useSchema hook
vi.mock("@/hooks/useSchemas", () => ({
  useSchema: vi.fn(),
}));

import { useSchema } from "@/hooks/useSchemas";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockSchemaWithFields = {
  id: "schema-1",
  name: "Workspace Schema",
  schema_fields: [
    {
      id: "sf-1",
      field_id: "field-1",
      display_order: 0,
      field: {
        id: "field-1",
        name: "Bewertung",
        field_type: "rating",
        config: { max_rating: 5 },
        list_id: "list-1",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    },
    {
      id: "sf-2",
      field_id: "field-2",
      display_order: 1,
      field: {
        id: "field-2",
        name: "Notizen",
        field_type: "text",
        config: { max_length: null },
        list_id: "list-1",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    },
  ],
};

describe("WorkspaceFieldsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays workspace name and icon", () => {
    vi.mocked(useSchema).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useSchema>);

    render(
      <WorkspaceFieldsCard
        defaultSchemaId={null}
        listId="list-1"
        onEdit={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Alle Videos")).toBeInTheDocument();
    expect(
      screen.getByText("Diese Felder haben alle Videos")
    ).toBeInTheDocument();
  });

  it("shows field list when schema exists", () => {
    vi.mocked(useSchema).mockReturnValue({
      data: mockSchemaWithFields,
      isLoading: false,
    } as ReturnType<typeof useSchema>);

    render(
      <WorkspaceFieldsCard
        defaultSchemaId="schema-1"
        listId="list-1"
        onEdit={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Bewertung")).toBeInTheDocument();
    expect(screen.getByText("Notizen")).toBeInTheDocument();
    expect(screen.getByText("(2 Felder definiert)")).toBeInTheDocument();
  });

  it("shows empty state when no schema", () => {
    vi.mocked(useSchema).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useSchema>);

    render(
      <WorkspaceFieldsCard
        defaultSchemaId={null}
        listId="list-1"
        onEdit={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Keine Felder definiert")).toBeInTheDocument();
    expect(screen.getByText("(0 Felder definiert)")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useSchema).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useSchema>);

    render(
      <WorkspaceFieldsCard
        defaultSchemaId="schema-1"
        listId="list-1"
        onEdit={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Lade Felder...")).toBeInTheDocument();
  });

  it("calls onEdit when button clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    vi.mocked(useSchema).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useSchema>);

    render(
      <WorkspaceFieldsCard
        defaultSchemaId={null}
        listId="list-1"
        onEdit={onEdit}
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole("button", { name: "Bearbeiten" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("displays field type badges", () => {
    vi.mocked(useSchema).mockReturnValue({
      data: mockSchemaWithFields,
      isLoading: false,
    } as ReturnType<typeof useSchema>);

    render(
      <WorkspaceFieldsCard
        defaultSchemaId="schema-1"
        listId="list-1"
        onEdit={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    // FieldTypeBadge should show type labels
    expect(screen.getByText("Bewertung")).toBeInTheDocument();
    expect(screen.getByText("Notizen")).toBeInTheDocument();
  });

  it('shows singular "Feld" for single field', () => {
    const singleFieldSchema = {
      ...mockSchemaWithFields,
      schema_fields: [mockSchemaWithFields.schema_fields[0]],
    };

    vi.mocked(useSchema).mockReturnValue({
      data: singleFieldSchema,
      isLoading: false,
    } as ReturnType<typeof useSchema>);

    render(
      <WorkspaceFieldsCard
        defaultSchemaId="schema-1"
        listId="list-1"
        onEdit={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("(1 Feld definiert)")).toBeInTheDocument();
  });
});
