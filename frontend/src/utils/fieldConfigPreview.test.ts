import { afterEach, describe, expect, it, vi } from "vitest";
import { formatConfigPreview } from "./fieldConfigPreview";

describe("formatConfigPreview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("select field type", () => {
    it("formats select config with options", () => {
      const result = formatConfigPreview("select", {
        options: ["bad", "good", "great"],
      });
      expect(result).toBe("Options: bad, good, great");
    });

    it("does not truncate long option lists (CSS handles display)", () => {
      const result = formatConfigPreview("select", {
        options: [
          "option1",
          "option2",
          "option3",
          "option4",
          "option5",
          "option6",
        ],
      });
      // Should return full string - CSS will handle truncation
      expect(result).toBe(
        "Options: option1, option2, option3, option4, option5, option6"
      );
      expect(result).not.toContain("...");
    });

    it("handles empty options array", () => {
      const result = formatConfigPreview("select", { options: [] });
      expect(result).toBe("No options");
    });

    it("handles missing options key", () => {
      const result = formatConfigPreview("select", {});
      expect(result).toBe("No options");
    });
  });

  describe("rating field type", () => {
    it("formats rating config with max_rating", () => {
      const result = formatConfigPreview("rating", { max_rating: 5 });
      expect(result).toBe("Max: 5 stars");
    });

    it("handles missing max_rating", () => {
      const result = formatConfigPreview("rating", {});
      expect(result).toBe("No max rating");
    });
  });

  describe("text field type", () => {
    it("formats text config with max_length", () => {
      const result = formatConfigPreview("text", { max_length: 500 });
      expect(result).toBe("Max length: 500");
    });

    it("handles missing max_length", () => {
      const result = formatConfigPreview("text", {});
      expect(result).toBe("No length limit");
    });
  });

  describe("boolean field type", () => {
    it("formats boolean config", () => {
      const result = formatConfigPreview("boolean", {});
      expect(result).toBe("Yes/No");
    });
  });
});
