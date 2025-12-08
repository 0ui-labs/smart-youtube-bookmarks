import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 500));
    expect(result.current).toBe("initial");
  });

  it("debounces value updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 500 } }
    );

    expect(result.current).toBe("initial");

    // Update value
    rerender({ value: "updated", delay: 500 });

    // Value should not update immediately
    expect(result.current).toBe("initial");

    // Advance timers by 499ms (just before delay)
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe("initial");

    // Advance timers by 1ms (total 500ms)
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("updated");
  });

  it("resets debounce timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    rerender({ value: "abcd" });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Value should still be initial (timer keeps resetting)
    expect(result.current).toBe("a");

    // After full delay from last change
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe("abcd");
  });

  it("cleans up timeout on unmount", () => {
    const { unmount } = renderHook(() => useDebounce("test", 500));

    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
