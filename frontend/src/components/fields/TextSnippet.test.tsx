/**
 * Tests for TextSnippet Component - Rich Text Field Display with Truncation
 *
 * Tests cover:
 * - Read-only mode with HTML rendering and truncation
 * - Edit mode with Tiptap editor
 * - Null value handling
 * - Expand button behavior
 * - Backward compatibility with plain text
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TextSnippet } from "./TextSnippet";

// Mock TiptapEditor since it requires complex browser APIs
vi.mock("./TiptapEditor", () => ({
  TiptapEditor: ({
    content,
    onChange,
    placeholder,
    className,
  }: {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    maxLength?: number;
    className?: string;
  }) => (
    <div className={className} data-testid="tiptap-editor">
      <textarea
        data-testid="tiptap-textarea"
        onChange={(e) => onChange(`<p>${e.target.value}</p>`)}
        placeholder={placeholder}
        value={content.replace(/<[^>]*>/g, "")}
      />
    </div>
  ),
}));

describe("TextSnippet Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Read-Only Mode - HTML Rendering", () => {
    it("renders short text without truncation", () => {
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={50} value="Hello World" />
      );

      expect(container.textContent).toContain("Hello World");
      expect(container.textContent).not.toContain("...");
    });

    it("renders HTML content correctly", () => {
      const { container } = render(
        <TextSnippet
          readOnly={true}
          truncateAt={100}
          value="<p>Formatted <strong>text</strong></p>"
        />
      );

      // Should render the HTML
      const proseContainer = container.querySelector(".tiptap-prose");
      expect(proseContainer).toBeInTheDocument();
    });

    it("truncates long text with ellipsis", () => {
      const longText =
        "This is a very long text that should be truncated because it exceeds the limit";
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={20} value={longText} />
      );

      expect(container.textContent).toContain("...");
    });

    it("wraps plain text in paragraph for backward compatibility", () => {
      const { container } = render(
        <TextSnippet
          readOnly={true}
          truncateAt={100}
          value="Plain text without HTML"
        />
      );

      // Plain text should be wrapped and rendered via tiptap-prose
      const proseContainer = container.querySelector(".tiptap-prose");
      expect(proseContainer).toBeInTheDocument();
      expect(container.textContent).toContain("Plain text without HTML");
    });

    it("displays null value as em dash placeholder", () => {
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={50} value={null} />
      );

      expect(container.textContent).toContain("—");
    });

    it("displays undefined value as em dash placeholder", () => {
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={50} value={undefined} />
      );

      expect(container.textContent).toContain("—");
    });

    it("displays empty string as em dash placeholder", () => {
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={50} value="" />
      );

      expect(container.textContent).toContain("—");
    });
  });

  describe("Expand Button Behavior", () => {
    it("shows expand button when text is truncated", () => {
      const longText = "This is a long text that will definitely be truncated";
      render(
        <TextSnippet
          onExpand={vi.fn()}
          readOnly={true}
          truncateAt={20}
          value={longText}
        />
      );

      const expandButton = screen.getByRole("button");
      expect(expandButton).toBeInTheDocument();
      expect(expandButton).toHaveAttribute("aria-label", "Text erweitern");
    });

    it("does not show expand button when text is not truncated", () => {
      render(
        <TextSnippet
          onExpand={vi.fn()}
          readOnly={true}
          truncateAt={50}
          value="Short text"
        />
      );

      const buttons = screen.queryAllByRole("button");
      expect(buttons).toHaveLength(0);
    });

    it("calls onExpand callback when expand button clicked", async () => {
      const onExpand = vi.fn();
      const user = userEvent.setup();
      const longText = "This is a long text that will be truncated for testing";

      render(
        <TextSnippet
          onExpand={onExpand}
          readOnly={true}
          truncateAt={20}
          value={longText}
        />
      );

      const expandButton = screen.getByRole("button");
      await user.click(expandButton);

      expect(onExpand).toHaveBeenCalledTimes(1);
    });
  });

  describe("Editable Mode - Tiptap Editor", () => {
    it("renders TiptapEditor in edit mode", () => {
      render(
        <TextSnippet
          onChange={vi.fn()}
          readOnly={false}
          truncateAt={50}
          value="Editable text"
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("passes content to TiptapEditor", () => {
      render(
        <TextSnippet
          onChange={vi.fn()}
          readOnly={false}
          truncateAt={50}
          value="<p>HTML content</p>"
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("calls onChange with HTML when content changes", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(
        <TextSnippet
          onChange={onChange}
          readOnly={false}
          truncateAt={50}
          value=""
        />
      );

      const textarea = screen.getByTestId("tiptap-textarea");
      await user.type(textarea, "New text");

      expect(onChange).toHaveBeenCalled();
      // Should receive HTML wrapped content
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining("<p>"));
    });

    it("handles null value in edit mode", () => {
      render(
        <TextSnippet
          onChange={vi.fn()}
          readOnly={false}
          truncateAt={50}
          value={null}
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className to read-only container", () => {
      const { container } = render(
        <TextSnippet
          className="custom-style"
          readOnly={true}
          truncateAt={50}
          value="Styled text"
        />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("custom-style");
    });

    it("applies custom className to editor in edit mode", () => {
      render(
        <TextSnippet
          className="custom-style"
          onChange={vi.fn()}
          readOnly={false}
          truncateAt={50}
          value="Styled"
        />
      );

      expect(screen.getByTestId("tiptap-editor")).toHaveClass("custom-style");
    });
  });

  describe("Edge Cases", () => {
    it("handles text exactly equal to truncateAt length", () => {
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={10} value="ABCDEFGHIJ" />
      );

      // Should NOT truncate (text equals limit)
      expect(container.textContent).not.toContain("...");
    });

    it("handles text one character over truncateAt length", () => {
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={10} value="ABCDEFGHIJK" />
      );

      // Should truncate
      expect(container.textContent).toContain("...");
    });

    it("handles HTML content with special characters", () => {
      const { container } = render(
        <TextSnippet
          readOnly={true}
          truncateAt={100}
          value="<p>Text with &amp; and &lt;brackets&gt;</p>"
        />
      );

      // Should render HTML entities correctly
      expect(container.querySelector(".tiptap-prose")).toBeInTheDocument();
    });
  });

  describe("Backward Compatibility", () => {
    it("converts plain text to HTML for display", () => {
      const { container } = render(
        <TextSnippet readOnly={true} truncateAt={100} value="Just plain text" />
      );

      // Should be wrapped in tiptap-prose for styling
      expect(container.querySelector(".tiptap-prose")).toBeInTheDocument();
    });

    it("escapes HTML in plain text values", () => {
      const { container } = render(
        <TextSnippet
          readOnly={true}
          truncateAt={100}
          value="Text with <script>alert('xss')</script>"
        />
      );

      // Should escape and display as text, not execute
      expect(container.innerHTML).not.toContain("<script>");
    });
  });

  describe("Accessibility", () => {
    it("provides accessible label for expand button", () => {
      const longText = "This is a long text that needs expanding";
      render(
        <TextSnippet
          onExpand={vi.fn()}
          readOnly={true}
          truncateAt={20}
          value={longText}
        />
      );

      const button = screen.getByRole("button", { name: /text erweitern/i });
      expect(button).toBeInTheDocument();
    });

    it("supports keyboard navigation for expand button", async () => {
      const onExpand = vi.fn();
      const user = userEvent.setup();
      const longText = "This is a long text that needs expanding";

      render(
        <TextSnippet
          onExpand={onExpand}
          readOnly={true}
          truncateAt={20}
          value={longText}
        />
      );

      const button = screen.getByRole("button");
      await user.tab();
      expect(button).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(onExpand).toHaveBeenCalledTimes(1);
    });
  });
});
