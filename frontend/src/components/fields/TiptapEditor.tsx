/**
 * TiptapEditor Component - Rich Text Editor based on Tiptap
 *
 * Features:
 * - Rich text editing with formatting
 * - Bubble menu for text selection
 * - Syntax highlighting for code blocks
 * - Character count display
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import CharacterCount from '@tiptap/extension-character-count'
import { common, createLowlight } from 'lowlight'
import { cn } from '@/lib/utils'
import { TiptapBubbleMenu } from './TiptapBubbleMenu'

const lowlight = createLowlight(common)

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
  disabled?: boolean
}

export const TiptapEditor = ({
  content,
  onChange,
  placeholder = 'Notizen eingeben...',
  maxLength,
  className,
  disabled = false,
}: TiptapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CharacterCount.configure({
        limit: maxLength,
      }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) {
    return null
  }

  const characterCount = editor.storage.characterCount?.characters() ?? 0

  return (
    <div className={cn('tiptap-editor', className)}>
      <TiptapBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
      {maxLength && (
        <div className="text-xs text-muted-foreground text-right mt-1">
          {characterCount} / {maxLength}
        </div>
      )}
    </div>
  )
}
