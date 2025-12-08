import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomField } from "@/types/customField";
import { FieldEditor } from "./FieldEditor";

// Create mock state that persists across re-renders
const mockState = {
  mutate: vi.fn(),
  isPending: false,
};

// Mock the hook module - return the object directly (not with getters)
vi.mock("@/hooks/useVideoFieldValues", () => ({
  useUpdateVideoFieldValues: vi.fn(() => mockState),
}));

// Mock parseValidationError from useVideos
vi.mock("@/hooks/useVideos", () => ({
  useVideos: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useCreateVideo: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteVideo: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useBulkUploadVideos: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  exportVideosCSV: vi.fn(),
  useAssignTags: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useUpdateVideoFieldValues: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  parseValidationError: vi.fn((err: any) => {
    if (
      err?.response?.status === 422 &&
      err?.response?.data?.detail?.errors?.length > 0
    ) {
      return err.response.data.detail.errors[0].error;
    }
    return "Validation failed";
  }),
  videoKeys: {
    all: ["videos"],
    lists: () => ["videos", "list"],
    list: (listId: string) => ["videos", "list", listId],
    filtered: (listId: string, tagNames: string[]) => [
      "videos",
      "list",
      listId,
      { tags: tagNames.sort() },
    ],
    withOptions: (listId: string, options: any) => [
      "videos",
      "list",
      listId,
      options,
    ],
    fieldValues: () => ["videos", "field-values"],
    videoFieldValues: (videoId: string) => ["videos", "field-values", videoId],
  },
}));

describe("FieldEditor", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockState.mutate = vi.fn();
    mockState.isPending = false;
  });

  afterEach(() => {
    // No need for timer cleanup
  });

  const renderWithQueryClient = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );

  describe("Rating Field Type", () => {
    const ratingField: CustomField = {
      id: "field-1",
      list_id: "list-1",
      name: "Overall Rating",
      field_type: "rating",
      config: { max_rating: 5 },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    it("renders RatingEditor for rating type", () => {
      renderWithQueryClient(
        <FieldEditor field={ratingField} value={3} videoId="video-1" />
      );

      // FieldEditor doesn't render the field name, only the editor component
      expect(
        screen.getByRole("radiogroup", { name: /bewertung/i })
      ).toBeInTheDocument();
      // Should show 5 star buttons
      expect(screen.getAllByRole("radio")).toHaveLength(5);
    });

    it("auto-saves after 500ms debounce when rating changes", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <FieldEditor field={ratingField} value={2} videoId="video-1" />
      );

      const fourthStar = screen.getByLabelText("4 Sterne");
      await user.click(fourthStar);

      // Should not save immediately
      expect(mockState.mutate).not.toHaveBeenCalled();

      // Wait for debounce (500ms) + a bit extra
      await waitFor(
        () => {
          expect(mockState.mutate).toHaveBeenCalledWith(
            [{ field_id: "field-1", value: 4 }],
            expect.any(Object)
          );
        },
        { timeout: 1000 }
      );
    });

    it("debounces multiple rapid changes", async () => {
      const user = userEvent.setup({ delay: 50 });
      renderWithQueryClient(
        <FieldEditor field={ratingField} value={1} videoId="video-1" />
      );

      // Click 3 stars in rapid succession
      await user.click(screen.getByLabelText("2 Sterne"));
      await user.click(screen.getByLabelText("3 Sterne"));
      await user.click(screen.getByLabelText("4 Sterne"));

      // Wait for debounce to complete
      await waitFor(
        () => {
          expect(mockState.mutate).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Should only save once with final value
      expect(mockState.mutate).toHaveBeenCalledTimes(1);
      expect(mockState.mutate).toHaveBeenCalledWith(
        [{ field_id: "field-1", value: 4 }],
        expect.any(Object)
      );
    });
  });

  describe("Select Field Type", () => {
    const selectField: CustomField = {
      id: "field-2",
      list_id: "list-1",
      name: "Quality",
      field_type: "select",
      config: { options: ["bad", "good", "great"] },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    it("renders SelectEditor for select type", () => {
      renderWithQueryClient(
        <FieldEditor field={selectField} value="good" videoId="video-1" />
      );

      // FieldEditor doesn't render field name, check for combobox with current value
      const combobox = screen.getByRole("combobox");
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveTextContent("good");
    });

    it("auto-saves when select option changes", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <FieldEditor field={selectField} value="good" videoId="video-1" />
      );

      const trigger = screen.getByRole("combobox");
      await user.click(trigger);

      const greatOption = screen.getByText("great");
      await user.click(greatOption);

      await waitFor(
        () => {
          expect(mockState.mutate).toHaveBeenCalledWith(
            [{ field_id: "field-2", value: "great" }],
            expect.any(Object)
          );
        },
        { timeout: 1000 }
      );
    });
  });

  describe("Text Field Type", () => {
    const textField: CustomField = {
      id: "field-3",
      list_id: "list-1",
      name: "Notes",
      field_type: "text",
      config: { max_length: 200 },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    it("renders TextEditor for text type", () => {
      renderWithQueryClient(
        <FieldEditor field={textField} value="Initial note" videoId="video-1" />
      );

      // FieldEditor doesn't render field name, check for input with value
      expect(screen.getByDisplayValue("Initial note")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Text eingeben...")
      ).toBeInTheDocument();
    });

    it("auto-saves after typing stops", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <FieldEditor field={textField} value="" videoId="video-1" />
      );

      const input = screen.getByPlaceholderText("Text eingeben...");
      await user.type(input, "New note");

      // Should save after typing stops (500ms debounce)
      await waitFor(
        () => {
          expect(mockState.mutate).toHaveBeenCalledWith(
            [{ field_id: "field-3", value: "New note" }],
            expect.any(Object)
          );
        },
        { timeout: 1000 }
      );
    });
  });

  describe("Boolean Field Type", () => {
    const booleanField: CustomField = {
      id: "field-4",
      list_id: "list-1",
      name: "Completed",
      field_type: "boolean",
      config: {},
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    it("renders BooleanEditor for boolean type", () => {
      renderWithQueryClient(
        <FieldEditor field={booleanField} value={false} videoId="video-1" />
      );

      // BooleanEditor renders the field name as the checkbox label
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: /completed/i })
      ).toBeInTheDocument();
    });

    it("auto-saves when checkbox toggles", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <FieldEditor field={booleanField} value={false} videoId="video-1" />
      );

      const checkbox = screen.getByRole("checkbox", { name: /completed/i });
      await user.click(checkbox);

      await waitFor(
        () => {
          expect(mockState.mutate).toHaveBeenCalledWith(
            [{ field_id: "field-4", value: true }],
            expect.any(Object)
          );
        },
        { timeout: 1000 }
      );
    });
  });

  describe("Loading States", () => {
    const ratingField: CustomField = {
      id: "field-1",
      list_id: "list-1",
      name: "Rating",
      field_type: "rating",
      config: { max_rating: 5 },
      created_at: "",
      updated_at: "",
    };

    it("shows loading spinner during save", async () => {
      mockState.isPending = true;

      const { container } = renderWithQueryClient(
        <FieldEditor field={ratingField} value={3} videoId="video-1" />
      );

      // Wait for component to render with loading state
      await waitFor(() => {
        const spinner = container.querySelector(".animate-spin");
        expect(spinner).toBeTruthy();
      });
    });

    it("disables editor during save", async () => {
      mockState.isPending = true;

      renderWithQueryClient(
        <FieldEditor field={ratingField} value={3} videoId="video-1" />
      );

      // Wait for stars to render
      await waitFor(() => {
        const stars = screen.getAllByRole("radio");
        expect(stars.length).toBeGreaterThan(0);
        stars.forEach((star) => {
          expect(star).toBeDisabled();
        });
      });
    });
  });

  describe("Error Handling", () => {
    const ratingField: CustomField = {
      id: "field-1",
      list_id: "list-1",
      name: "Rating",
      field_type: "rating",
      config: { max_rating: 5 },
      created_at: "",
      updated_at: "",
    };

    it("displays validation error from backend", async () => {
      mockState.mutate.mockImplementation((_, { onError }) => {
        // Simulate backend 422 error
        const error = {
          response: {
            status: 422,
            data: {
              detail: {
                message: "Field value validation failed",
                errors: [
                  {
                    field_id: "field-1",
                    field_name: "Rating",
                    error: "Value must be <= 5",
                  },
                ],
              },
            },
          },
        };
        onError(error);
      });

      renderWithQueryClient(
        <FieldEditor field={ratingField} value={3} videoId="video-1" />
      );

      const user = userEvent.setup();
      const fifthStar = screen.getByLabelText("5 Sterne");
      await user.click(fifthStar);

      await waitFor(
        () => {
          expect(screen.getByText("Value must be <= 5")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it("rolls back value on error", async () => {
      mockState.mutate.mockImplementation((_, { onError }) => {
        const error = {
          response: {
            status: 422,
            data: { detail: { message: "Validation failed", errors: [] } },
          },
        };
        onError(error);
      });

      renderWithQueryClient(
        <FieldEditor field={ratingField} value={3} videoId="video-1" />
      );

      const user = userEvent.setup();
      // Original value: 3 stars
      const fourthStar = screen.getByLabelText("4 Sterne");
      await user.click(fourthStar);

      // Wait for mutation to complete and rollback to happen
      await waitFor(
        () => {
          const thirdStar = screen.getByLabelText("3 Sterne");
          expect(thirdStar).toHaveAttribute("aria-checked", "true");
        },
        { timeout: 1000 }
      );
    });
  });

  describe("Cleanup", () => {
    it("clears debounce timer on unmount", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = renderWithQueryClient(
        <FieldEditor
          field={{
            id: "field-1",
            list_id: "list-1",
            name: "Test",
            field_type: "rating",
            config: { max_rating: 5 },
            created_at: "",
            updated_at: "",
          }}
          value={3}
          videoId="video-1"
        />
      );

      // Trigger a change to create a timer
      const user = userEvent.setup();
      const star = screen.getByLabelText("5 Sterne");
      await user.click(star);

      unmount();

      // clearTimeout should be called when component unmounts
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("clears pending debounce when field prop changes", async () => {
      const ratingFieldA: CustomField = {
        id: "field-a",
        list_id: "list-1",
        name: "Rating A",
        field_type: "rating",
        config: { max_rating: 5 },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      const ratingFieldB: CustomField = {
        id: "field-b",
        list_id: "list-1",
        name: "Rating B",
        field_type: "rating",
        config: { max_rating: 5 },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      const { rerender } = renderWithQueryClient(
        <FieldEditor field={ratingFieldA} value={3} videoId="video-1" />
      );

      const user = userEvent.setup();

      // Click star to trigger debounce
      const fifthStar = screen.getByLabelText("5 Sterne");
      await user.click(fifthStar);

      // Switch to different field immediately before debounce fires
      rerender(
        <QueryClientProvider client={queryClient}>
          <FieldEditor field={ratingFieldB} value={2} videoId="video-1" />
        </QueryClientProvider>
      );

      // Wait a bit longer than debounce time
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Mutation should NOT have been called (timer was cleared)
      expect(mockState.mutate).not.toHaveBeenCalled();
    });
  });
});
