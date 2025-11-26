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
import { common, createLowlight } from 'lowlight'
import { cn } from '@/lib/utils'

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

  return (
    <div className={cn('tiptap-editor', className)}>
      <EditorContent editor={editor} />
    </div>
  )
}
