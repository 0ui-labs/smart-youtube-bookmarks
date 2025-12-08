/**
 * Unit Tests for CategorySelector Component
 * Phase 5 Step 5.1-5.3 (TDD)
 *
 * Tests the CategorySelector dropdown that allows users to:
 * - Select a category for a video
 * - Clear the category selection
 * - See loading states during data fetch or mutations
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategorySelector } from "./CategorySelector";

// Mock useCategories hook
const mockCategories = [
  {
    id: "cat-1",
    name: "Keto Rezepte",
    color: "#FF5722",
    schema_id: null,
    is_video_type: true,
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "cat-2",
    name: "Vegan",
    color: "#4CAF50",
    schema_id: null,
    is_video_type: true,
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

// We'll set this in beforeEach to control the mock per test
let mockUseCategoriesReturn = {
  data: mockCategories,
  isLoading: false,
  error: null,
};

vi.mock("@/hooks/useTags", () => ({
  useCategories: vi.fn(() => mockUseCategoriesReturn),
}));

// Test wrapper with QueryClient
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("CategorySelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to default state
    mockUseCategoriesReturn = {
      data: mockCategories,
      isLoading: false,
      error: null,
    };
  });

  // Step 5.1: Skeleton tests
  describe("Skeleton (Step 5.1)", () => {
    it('renders with "Keine Kategorie" placeholder when value is null', () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId={null}
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("Keine Kategorie")).toBeInTheDocument();
    });

    it("renders dropdown trigger with category label", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId={null}
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      expect(screen.getByLabelText("Kategorie auswählen")).toBeInTheDocument();
    });

    it("shows selected category name when currentCategoryId is set", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      expect(screen.getByRole("combobox")).toBeInTheDocument();
      // Selected value should show the category name
      expect(screen.getByText("Keto Rezepte")).toBeInTheDocument();
    });

    it("shows color indicator for selected category", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      // Color dot should be visible
      const colorDot = screen.getByTestId("category-color-dot");
      expect(colorDot).toHaveStyle({ backgroundColor: "#FF5722" });
    });
  });

  // Step 5.2: Clear Button tests
  describe("Clear Button (Step 5.2)", () => {
    it("shows clear button when category is selected", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      expect(
        screen.getByRole("button", { name: /kategorie entfernen/i })
      ).toBeInTheDocument();
    });

    it("does not show clear button when no category is selected", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId={null}
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      expect(
        screen.queryByRole("button", { name: /kategorie entfernen/i })
      ).not.toBeInTheDocument();
    });

    it("shows warning dialog when clear button is clicked (onCategoryChange called after confirm)", async () => {
      const user = userEvent.setup();
      const onCategoryChange = vi.fn();

      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={onCategoryChange}
          videoId="video-1"
        />
      );

      const clearButton = screen.getByRole("button", {
        name: /kategorie entfernen/i,
      });
      await user.click(clearButton);

      // Warning dialog should appear (not direct call)
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(onCategoryChange).not.toHaveBeenCalled();

      // Confirm to actually remove
      const confirmButton = screen.getByRole("button", {
        name: /kategorie entfernen/i,
      });
      await user.click(confirmButton);

      expect(onCategoryChange).toHaveBeenCalledWith(null, false);
    });
  });

  // Step 5.3: Loading and Disabled States
  describe("Loading and Disabled States (Step 5.3)", () => {
    it("shows loading spinner when categories are loading", () => {
      // Override mock for this test
      mockUseCategoriesReturn = {
        data: [],
        isLoading: true,
        error: null,
      };

      renderWithProviders(
        <CategorySelector
          currentCategoryId={null}
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      expect(screen.getByText("Lade Kategorien...")).toBeInTheDocument();
    });

    it("disables selector when disabled prop is true", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId={null}
          disabled={true}
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      const combobox = screen.getByRole("combobox");
      expect(combobox).toHaveAttribute("data-disabled", "");
    });

    it("shows loading state during mutation", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId={null}
          isMutating={true}
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      expect(screen.getByText("Ändere Kategorie...")).toBeInTheDocument();
    });

    it("disables clear button when disabled", () => {
      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          disabled={true}
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      const clearButton = screen.getByRole("button", {
        name: /kategorie entfernen/i,
      });
      expect(clearButton).toBeDisabled();
    });
  });

  // Step 5.7: Integration with Warning Dialog
  describe("Warning Dialog Integration (Step 5.7)", () => {
    it("shows warning dialog when changing from one category to another", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      // Open dropdown and select different category
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      // Select "Vegan" category
      const veganOption = screen.getByRole("option", { name: /vegan/i });
      await user.click(veganOption);

      // Warning dialog should appear
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /kategorie ändern/i })
      ).toBeInTheDocument();
    });

    it("shows warning dialog when removing category", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={vi.fn()}
          videoId="video-1"
        />
      );

      // Click clear button
      const clearButton = screen.getByRole("button", {
        name: /kategorie entfernen/i,
      });
      await user.click(clearButton);

      // Warning dialog should appear
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /kategorie entfernen/i })
      ).toBeInTheDocument();
    });

    it("does not show warning when assigning first category", async () => {
      const user = userEvent.setup();
      const onCategoryChange = vi.fn();

      renderWithProviders(
        <CategorySelector
          currentCategoryId={null}
          onCategoryChange={onCategoryChange}
          videoId="video-1"
        />
      );

      // Open dropdown and select category
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      const ketoOption = screen.getByRole("option", { name: /keto/i });
      await user.click(ketoOption);

      // No warning dialog - direct assignment
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onCategoryChange).toHaveBeenCalledWith("cat-1");
    });

    it("calls onCategoryChange when warning is confirmed", async () => {
      const user = userEvent.setup();
      const onCategoryChange = vi.fn();

      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={onCategoryChange}
          videoId="video-1"
        />
      );

      // Open dropdown and select different category
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      const veganOption = screen.getByRole("option", { name: /vegan/i });
      await user.click(veganOption);

      // Confirm in warning dialog
      const confirmButton = screen.getByRole("button", {
        name: /kategorie ändern/i,
      });
      await user.click(confirmButton);

      expect(onCategoryChange).toHaveBeenCalledWith("cat-2", false);
    });

    it("does not call onCategoryChange when warning is cancelled", async () => {
      const user = userEvent.setup();
      const onCategoryChange = vi.fn();

      renderWithProviders(
        <CategorySelector
          currentCategoryId="cat-1"
          onCategoryChange={onCategoryChange}
          videoId="video-1"
        />
      );

      // Open dropdown and select different category
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      const veganOption = screen.getByRole("option", { name: /vegan/i });
      await user.click(veganOption);

      // Cancel in warning dialog
      const cancelButton = screen.getByRole("button", { name: /abbrechen/i });
      await user.click(cancelButton);

      expect(onCategoryChange).not.toHaveBeenCalled();
      // Dialog should be closed
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
