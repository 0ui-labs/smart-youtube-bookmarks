import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlphabetSidebar } from "./ChannelsPage";

describe("AlphabetSidebar", () => {
  it("ignores dragging an empty letter list", () => {
    const onLetterClick = vi.fn();
    const { container } = render(
      <AlphabetSidebar
        activeLetter={null}
        letters={[]}
        onLetterClick={onLetterClick}
        onLetterHover={vi.fn()}
      />
    );
    fireEvent.mouseDown(container.firstChild as Element, { clientY: -100 });
    expect(onLetterClick).not.toHaveBeenCalled();
  });
  it("clamps dragging outside the available buttons", () => {
    const onLetterClick = vi.fn();
    const { container } = render(
      <AlphabetSidebar
        activeLetter={null}
        letters={["A", "Z"]}
        onLetterClick={onLetterClick}
        onLetterHover={vi.fn()}
      />
    );
    fireEvent.mouseDown(container.firstChild as Element, { clientY: -100 });
    expect(onLetterClick).toHaveBeenCalledWith("A", true);
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(container.firstChild as Element, { clientY: 100 });
    expect(onLetterClick).toHaveBeenCalledWith("Z", true);
  });
});
