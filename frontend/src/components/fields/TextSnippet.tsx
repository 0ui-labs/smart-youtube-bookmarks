/**
 * TextSnippet Component - Rich Text Field Display with Truncation
 *
 * Features:
 * - Read-only mode: Displays formatted HTML with truncation and expand button
 * - Editable mode: Tiptap rich text editor with bubble menu
 * - Backward compatibility: Plain text is wrapped in paragraph tags
 * - Null/undefined handling: Displays em dash (—)
 *
 * Props:
 * - value: string | null | undefined - Text or HTML content to display
 * - truncateAt: number - Character limit for display truncation (read-only)
 * - readOnly?: boolean - Toggle between read-only and editable modes
 * - onChange?: (value: string) => void - Callback on input change (returns HTML)
 * - onExpand?: () => void - Callback when expand button clicked
 * - maxLength?: number - Max characters for input field (editable mode)
 * - placeholder?: string - Placeholder text for editable mode
 * - className?: string - Custom Tailwind classes
 */

import { ChevronRight } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TiptapEditor } from "./TiptapEditor";

export interface TextSnippetProps {
  /** Text or HTML content to display */
  value: string | null | undefined;
  /** Character limit for display truncation (read-only mode) */
  truncateAt: number;
  /** Toggle between read-only and editable modes (default: true) */
  readOnly?: boolean;
  /** Callback when input value changes (editable mode) - returns HTML */
  onChange?: (value: string) => void;
  /** Callback when expand button clicked */
  onExpand?: () => void;
  /** Max characters for input field (editable mode) */
  maxLength?: number;
  /** Placeholder text for editable mode */
  placeholder?: string;
  /** Custom Tailwind classes */
  className?: string;
}

/**
 * Normalize content: wrap plain text in paragraph tags.
 * HTML content (starting with <) is returned as-is.
 */
function normalizeContent(value: string | null | undefined): string {
  if (!value) return "";
  // Already HTML? Return as-is
  if (value.trim().startsWith("<")) return value;
  // Plain text → wrap in paragraph, escape HTML entities
  return `<p>${value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
}

/**
 * Strip HTML tags to get plain text content for truncation check.
 */
function getTextContent(html: string): string {
  // Use DOMParser for accurate text extraction
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }
  // Fallback: simple regex strip
  return html.replace(/<[^>]*>/g, "");
}

export const TextSnippet = React.forwardRef<HTMLDivElement, TextSnippetProps>(
  (
    {
      value,
      truncateAt,
      readOnly = true,
      onChange,
      onExpand,
      maxLength,
      placeholder = "Notizen eingeben...",
      className,
    },
    ref
  ) => {
    const normalizedValue = normalizeContent(value);
    const textContent = getTextContent(normalizedValue);
    const isTruncated = textContent.length > truncateAt;

    if (readOnly) {
      // Read-only mode: Render formatted HTML
      return (
        <div
          className={cn("inline-flex items-start gap-2 text-sm", className)}
          ref={ref}
        >
          {textContent ? (
            <div
              className="tiptap-prose"
              dangerouslySetInnerHTML={{
                __html: isTruncated
                  ? `${getTextContent(normalizedValue).slice(0, truncateAt)}...`
                  : normalizedValue,
              }}
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {isTruncated && onExpand && (
            <Button
              aria-label="Text erweitern"
              className="h-5 w-5 shrink-0 p-0"
              onClick={onExpand}
              size="icon"
              variant="ghost"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }

    // Edit mode: Tiptap Editor
    return (
      <TiptapEditor
        className={className}
        content={normalizedValue}
        maxLength={maxLength}
        onChange={(html) => onChange?.(html)}
        placeholder={placeholder}
      />
    );
  }
);

TextSnippet.displayName = "TextSnippet";
