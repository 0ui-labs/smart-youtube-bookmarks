import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportPreviewModal } from "./ImportPreviewModal";

// Mock the useTags hook
vi.mock("@/hooks/useTags", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", name: "Tutorial", is_video_type: true },
      { id: "cat-2", name: "Review", is_video_type: true },
    ],
    isLoading: false,
  }),
}));

describe("ImportPreviewModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    urls: [
      "https://youtube.com/watch?v=abc12345678",
      "https://youtube.com/watch?v=def12345678",
    ],
    onImport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic rendering (Step 15)", () => {
    it("renders when open=true", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("does not render when open=false", () => {
      render(<ImportPreviewModal {...defaultProps} open={false} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("displays URL count in title", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      expect(screen.getByText(/2 Videos/i)).toBeInTheDocument();
    });

    it("displays all URLs in the list", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      expect(screen.getByText(/abc12345678/)).toBeInTheDocument();
      expect(screen.getByText(/def12345678/)).toBeInTheDocument();
    });

    it("has import button", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /importieren/i })
      ).toBeInTheDocument();
    });

    it("has cancel button", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /abbrechen/i })
      ).toBeInTheDocument();
    });
  });

  describe("URL validation display (Step 16)", () => {
    it("marks valid URLs with check icon", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      const validIcons = screen.getAllByTestId("valid-url-icon");
      expect(validIcons).toHaveLength(2);
    });

    it("marks invalid URLs with X icon", () => {
      const propsWithInvalid = {
        ...defaultProps,
        urls: [
          "https://youtube.com/watch?v=abc12345678",
          "https://invalid-url.com",
        ],
      };
      render(<ImportPreviewModal {...propsWithInvalid} />);
      expect(screen.getByTestId("invalid-url-icon")).toBeInTheDocument();
    });

    it("shows invalid URL with destructive styling", () => {
      const propsWithInvalid = {
        ...defaultProps,
        urls: ["https://invalid-url.com"],
      };
      render(<ImportPreviewModal {...propsWithInvalid} />);
      const urlItem = screen.getByTestId("url-item-0");
      expect(urlItem).toHaveClass("text-destructive");
    });
  });

  describe("duplicate detection (Step 17)", () => {
    it("marks duplicate URLs with warning icon", () => {
      const propsWithDuplicates = {
        ...defaultProps,
        existingVideoIds: ["abc12345678"],
      };
      render(<ImportPreviewModal {...propsWithDuplicates} />);
      expect(screen.getByTestId("duplicate-url-icon")).toBeInTheDocument();
    });

    it("shows duplicate count in footer", () => {
      const propsWithDuplicates = {
        ...defaultProps,
        existingVideoIds: ["abc12345678"],
      };
      render(<ImportPreviewModal {...propsWithDuplicates} />);
      expect(screen.getByText(/1 Duplikat/i)).toBeInTheDocument();
    });
  });

  describe("category selection (Step 18)", () => {
    it("renders category selector", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it('shows "Keine Kategorie" as default option', () => {
      render(<ImportPreviewModal {...defaultProps} />);
      expect(screen.getByText(/Keine Kategorie/i)).toBeInTheDocument();
    });

    it("uses preselected category when provided", () => {
      render(
        <ImportPreviewModal {...defaultProps} preselectedCategoryId="cat-1" />
      );
      expect(screen.getByText("Tutorial")).toBeInTheDocument();
    });
  });

  describe("import action", () => {
    it("calls onImport with valid URLs when clicking import", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /importieren/i }));
      expect(defaultProps.onImport).toHaveBeenCalledWith(
        defaultProps.urls,
        undefined
      );
    });

    it("calls onImport with selected category", () => {
      render(
        <ImportPreviewModal {...defaultProps} preselectedCategoryId="cat-1" />
      );
      fireEvent.click(screen.getByRole("button", { name: /importieren/i }));
      expect(defaultProps.onImport).toHaveBeenCalledWith(
        defaultProps.urls,
        "cat-1"
      );
    });

    it("filters out invalid URLs from import", () => {
      const propsWithInvalid = {
        ...defaultProps,
        urls: [
          "https://youtube.com/watch?v=abc12345678",
          "https://invalid-url.com",
        ],
      };
      render(<ImportPreviewModal {...propsWithInvalid} />);
      fireEvent.click(screen.getByRole("button", { name: /importieren/i }));
      expect(defaultProps.onImport).toHaveBeenCalledWith(
        ["https://youtube.com/watch?v=abc12345678"],
        undefined
      );
    });

    it("disables import button when no valid URLs", () => {
      const propsWithOnlyInvalid = {
        ...defaultProps,
        urls: ["https://invalid-url.com"],
      };
      render(<ImportPreviewModal {...propsWithOnlyInvalid} />);
      expect(
        screen.getByRole("button", { name: /importieren/i })
      ).toBeDisabled();
    });
  });

  describe("cancel action", () => {
    it("calls onOpenChange(false) when clicking cancel", () => {
      render(<ImportPreviewModal {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /abbrechen/i }));
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
