/**
 * TiptapBubbleMenu Component - Floating Toolbar for Text Selection
 *
 * Features:
 * - Appears on text selection
 * - Bold, Italic, Strikethrough formatting
 * - Heading levels dropdown
 * - Lists and blockquote
 * - Code and link buttons
 */

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  ChevronDown,
  Code,
  FileCode,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Unlink,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface TiptapBubbleMenuProps {
  editor: Editor;
}

interface MenuButtonProps {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  ariaLabel: string;
}

export const MenuButton = ({
  onClick,
  isActive,
  children,
  ariaLabel,
}: MenuButtonProps) => (
  <Button
    aria-label={ariaLabel}
    aria-pressed={isActive}
    className={cn("h-8 w-8 p-0", isActive && "bg-accent")}
    onClick={onClick}
    size="sm"
    variant="ghost"
  >
    {children}
  </Button>
);

export const TiptapBubbleMenu = ({ editor }: TiptapBubbleMenuProps) => {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setLinkPopoverOpen(false);
    setLinkUrl("");
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkPopoverOpen(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{
        offset: 8,
        placement: "top",
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg">
        {/* Text Formatting */}
        <MenuButton
          ariaLabel="Fett"
          isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          ariaLabel="Kursiv"
          isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          ariaLabel="Durchgestrichen"
          isActive={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </MenuButton>

        <Separator className="mx-1 h-6" orientation="vertical" />

        {/* Headings Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-8 px-2" size="sm" variant="ghost">
              <Heading className="h-4 w-4" />
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              Normal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              <span className="font-bold text-xl">Heading 1</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <span className="font-semibold text-lg">Heading 2</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              <span className="font-medium text-base">Heading 3</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator className="mx-1 h-6" orientation="vertical" />

        {/* Lists */}
        <MenuButton
          ariaLabel="Aufzählung"
          isActive={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          ariaLabel="Nummerierte Liste"
          isActive={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          ariaLabel="Zitat"
          isActive={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </MenuButton>

        <Separator className="mx-1 h-6" orientation="vertical" />

        {/* Code */}
        <MenuButton
          ariaLabel="Inline Code"
          isActive={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          ariaLabel="Code Block"
          isActive={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <FileCode className="h-4 w-4" />
        </MenuButton>

        <Separator className="mx-1 h-6" orientation="vertical" />

        {/* Link */}
        <Popover onOpenChange={setLinkPopoverOpen} open={linkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label="Link"
              className={cn(
                "h-8 w-8 p-0",
                editor.isActive("link") && "bg-accent"
              )}
              size="sm"
              variant="ghost"
            >
              {editor.isActive("link") ? (
                <Unlink className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <Label htmlFor="link-url">Link URL</Label>
              <Input
                id="link-url"
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setLink()}
                placeholder="https://..."
                value={linkUrl}
              />
              <div className="flex justify-end gap-2">
                {editor.isActive("link") && (
                  <Button onClick={removeLink} size="sm" variant="ghost">
                    Entfernen
                  </Button>
                )}
                <Button onClick={setLink} size="sm">
                  Speichern
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </BubbleMenu>
  );
};
