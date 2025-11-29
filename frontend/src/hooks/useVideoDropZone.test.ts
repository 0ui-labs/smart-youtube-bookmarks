import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVideoDropZone } from "./useVideoDropZone";

describe("useVideoDropZone", () => {
  const mockOnVideosDetected = vi.fn();

  describe("initialization", () => {
    it("initializes with isDragging=false", () => {
      const { result } = renderHook(() =>
        useVideoDropZone({ onVideosDetected: mockOnVideosDetected })
      );
      expect(result.current.isDragging).toBe(false);
    });

    it("returns getRootProps function", () => {
      const { result } = renderHook(() =>
        useVideoDropZone({ onVideosDetected: mockOnVideosDetected })
      );
      expect(typeof result.current.getRootProps).toBe("function");
    });

    it("returns getInputProps function", () => {
      const { result } = renderHook(() =>
        useVideoDropZone({ onVideosDetected: mockOnVideosDetected })
      );
      expect(typeof result.current.getInputProps).toBe("function");
    });
  });

  describe("getRootProps", () => {
    it("returns object with drag event handlers", () => {
      const { result } = renderHook(() =>
        useVideoDropZone({ onVideosDetected: mockOnVideosDetected })
      );

      const rootProps = result.current.getRootProps();

      expect(rootProps.onDragEnter).toBeDefined();
      expect(rootProps.onDragOver).toBeDefined();
      expect(rootProps.onDragLeave).toBeDefined();
      expect(rootProps.onDrop).toBeDefined();
    });
  });

  describe("disabled state", () => {
    it("still returns props when disabled", () => {
      const { result } = renderHook(() =>
        useVideoDropZone({
          onVideosDetected: mockOnVideosDetected,
          disabled: true,
        })
      );

      // Hook should still return functions even when disabled
      expect(typeof result.current.getRootProps).toBe("function");
      expect(typeof result.current.getInputProps).toBe("function");
    });
  });

  describe("getInputProps", () => {
    it("returns input props for hidden file input", () => {
      const { result } = renderHook(() =>
        useVideoDropZone({ onVideosDetected: mockOnVideosDetected })
      );

      const inputProps = result.current.getInputProps();

      expect(inputProps.type).toBe("file");
      expect(inputProps.style).toBeDefined();
    });
  });
});
