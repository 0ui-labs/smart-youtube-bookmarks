import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaEditor } from "./SchemaEditor";

// Mock the hooks
vi.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: () => ({
    data: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Existing Field",
        field_type: "select",
        config: { options: ["option1", "option2"] },
        list_id: "list-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Another Field",
        field_type: "rating",
        config: { max_rating: 5 },
        list_id: "list-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useCheckFieldDuplicate: () => ({
    data: null,
    refetch: vi.fn(),
  }),
  useCreateField: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

/**
 * Integration tests deferred to Task #83f due to JSDOM portal limitations
 *
 * These tests require interaction with Radix UI Popover/Command components
 * which render in portals that don't appear in JSDOM test queries.
 * Should be tested in E2E tests (Task #96) instead.
 */
describe("SchemaEditor Integration Tests", () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("creates schema with new field end-to-end", async () => {
    const user = userEvent.setup();

    // Mock successful save
    mockOnSave.mockResolvedValueOnce(undefined);

    render(
      <SchemaEditor
        listId="list-1"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
      { wrapper }
    );

    // Step 1: Enter schema name
    const nameInput = screen.getByLabelText(/schema-name/i);
    await user.type(nameInput, "My Test Schema");
    expect(nameInput).toHaveValue("My Test Schema");

    // Step 2: Open FieldSelector and select a field
    const fieldSelectorButton = screen.getByRole("combobox", {
      name: /vorhandene felder/i,
    });
    await user.click(fieldSelectorButton);

    // Wait for popover to open and select "Existing Field"
    await waitFor(() => {
      expect(screen.getByText("Existing Field")).toBeInTheDocument();
    });

    const existingFieldOption = screen.getByText("Existing Field");
    await user.click(existingFieldOption);

    // Verify field appears in form (via placeholder text)
    await waitFor(() => {
      expect(screen.getAllByText("Existing Field").length).toBeGreaterThan(0);
    });

    // Step 3: Submit schema
    const submitButton = screen.getByRole("button", {
      name: /schema erstellen/i,
    });
    await user.click(submitButton);

    // Verify onSave was called with correct structure
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Test Schema",
          description: "",
          fields: expect.arrayContaining([
            expect.objectContaining({
              field_id: "11111111-1111-4111-8111-111111111111",
              display_order: 0,
              show_on_card: false,
            }),
          ]),
        })
      );
    });
  });

  it("rejects more than three card fields before saving", async () => {
    const fields = [1, 2, 3, 4].map((number) => ({
      field_id: `${String(number).repeat(8)}-1111-4111-8111-111111111111`,
      display_order: number - 1,
      show_on_card: true,
    }));
    render(
      <SchemaEditor
        initialData={{ name: "Schema", fields }}
        listId="list-1"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
      { wrapper }
    );
    await userEvent.click(
      screen.getByRole("button", { name: /schema erstellen/i })
    );
    expect(
      await screen.findByText(
        /maximal 3 felder können auf der karte angezeigt werden/i
      )
    ).toBeVisible();
    expect(mockOnSave).not.toHaveBeenCalled();
  });
  it("keeps the selection unique and supports deselection", async () => {
    render(
      <SchemaEditor
        initialData={{ name: "Schema" }}
        listId="list-1"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
      { wrapper }
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: /vorhandene felder/i })
    );
    await userEvent.click(
      screen.getByRole("option", { name: /Existing Field/i })
    );
    await userEvent.click(
      screen.getByRole("option", { name: /Another Field/i })
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("Felder (2)")).toBeVisible();
    await userEvent.click(
      screen.getByRole("combobox", { name: /vorhandene felder/i })
    );
    await userEvent.click(
      screen.getByRole("option", { name: /Existing Field/i })
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("Felder (1)")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: /schema erstellen/i })
    );
    await waitFor(() =>
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: [
            {
              field_id: "22222222-2222-4222-8222-222222222222",
              display_order: 0,
              show_on_card: false,
            },
          ],
        })
      )
    );
  });
});
