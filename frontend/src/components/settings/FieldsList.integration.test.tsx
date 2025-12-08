import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomField } from "@/types/customField";
import { FieldsList } from "./FieldsList";

/**
 * FieldsList Integration Tests
 *
 * Tests the FieldsList component with React Query integration.
 * Verifies data flow, loading states, and empty states.
 *
 * Pattern: Component receives fields/isLoading as props
 * (not directly using useCustomFields hook)
 */

// Mock data
const mockFields: CustomField[] = [
  {
    id: "1",
    list_id: "list-1",
    name: "Presentation Quality",
    field_type: "select",
    config: { options: ["bad", "good", "great"] },
    created_at: "2025-11-01T10:00:00Z",
    updated_at: "2025-11-01T10:00:00Z",
  },
  {
    id: "2",
    list_id: "list-1",
    name: "Overall Rating",
    field_type: "rating",
    config: { max_rating: 5 },
    created_at: "2025-11-02T10:00:00Z",
    updated_at: "2025-11-02T10:00:00Z",
  },
];

describe("FieldsList Integration", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("fetches and displays fields from API", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FieldsList fields={mockFields} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Presentation Quality")).toBeInTheDocument();
      expect(screen.getByText("Overall Rating")).toBeInTheDocument();
    });
  });

  it("displays loading state while fetching", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FieldsList fields={[]} isLoading={true} />
      </QueryClientProvider>
    );

    expect(screen.getByText("Loading custom fields...")).toBeInTheDocument();
  });

  it("displays empty state when no fields returned", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FieldsList fields={[]} />
      </QueryClientProvider>
    );

    expect(
      screen.getByText("No custom fields yet. Create your first field!")
    ).toBeInTheDocument();
  });
});
