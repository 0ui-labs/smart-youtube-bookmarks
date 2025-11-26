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

import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bold, Italic, Strikethrough, Heading, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TiptapBubbleMenuProps {
  editor: Editor
}

interface MenuButtonProps {
  onClick: () => void
  isActive?: boolean
  children: React.ReactNode
  ariaLabel: string
}

export const MenuButton = ({ onClick, isActive, children, ariaLabel }: MenuButtonProps) => (
  <Button
    variant="ghost"
    size="sm"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-pressed={isActive}
    className={cn('h-8 w-8 p-0', isActive && 'bg-accent')}
  >
    {children}
  </Button>
)

export const TiptapBubbleMenu = ({ editor }: TiptapBubbleMenuProps) => {
  return (
    <BubbleMenu
      editor={editor}
      options={{
        offset: 8,
        placement: 'top',
      }}
    >
      <div className="flex items-center gap-0.5 p-1 rounded-lg bg-popover border border-border shadow-lg">
        {/* Text Formatting */}
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          ariaLabel="Fett"
        >
          <Bold className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          ariaLabel="Kursiv"
        >
          <Italic className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          ariaLabel="Durchgestrichen"
        >
          <Strikethrough className="h-4 w-4" />
        </MenuButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2">
              <Heading className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
              Normal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              <span className="text-xl font-bold">Heading 1</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <span className="text-lg font-semibold">Heading 2</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <span className="text-base font-medium">Heading 3</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </BubbleMenu>
  )
}
