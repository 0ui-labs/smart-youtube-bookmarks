# Phase 9: Testing Strategy

## Test-Übersicht

| Test-Typ | Scope | Tools |
|----------|-------|-------|
| Unit Tests | Komponenten | Vitest, Testing Library |
| Integration Tests | Feature Flow | Vitest, Testing Library |
| Regression Tests | Bestehende Features | Bestehende Test Suite |

## Unit Tests

### TiptapEditor.test.tsx

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TiptapEditor } from './TiptapEditor'

describe('TiptapEditor', () => {
  // Rendering
  it('renders empty editor with placeholder', () => {
    render(<TiptapEditor content="" onChange={vi.fn()} />)
    expect(screen.getByText('Notizen eingeben...')).toBeInTheDocument()
  })

  it('renders with initial content', () => {
    render(<TiptapEditor content="<p>Hello World</p>" onChange={vi.fn()} />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders formatted content correctly', () => {
    render(
      <TiptapEditor
        content="<p><strong>Bold</strong> and <em>italic</em></p>"
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('Bold')).toHaveStyle({ fontWeight: 'bold' })
  })

  // Interaction
  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    render(<TiptapEditor content="" onChange={onChange} />)

    const editor = screen.getByRole('textbox')
    await userEvent.type(editor, 'Hello')

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('Hello'))
    })
  })

  it('respects disabled prop', () => {
    render(<TiptapEditor content="" onChange={vi.fn()} disabled />)
    const editor = screen.getByRole('textbox')
    expect(editor).toHaveAttribute('contenteditable', 'false')
  })

  // Character Count
  it('shows character count when maxLength provided', () => {
    render(<TiptapEditor content="Hello" onChange={vi.fn()} maxLength={100} />)
    expect(screen.getByText('5 / 100')).toBeInTheDocument()
  })

  // Content Sync
  it('syncs external content changes', async () => {
    const { rerender } = render(
      <TiptapEditor content="<p>Initial</p>" onChange={vi.fn()} />
    )
    expect(screen.getByText('Initial')).toBeInTheDocument()

    rerender(<TiptapEditor content="<p>Updated</p>" onChange={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })
  })
})
```

### TiptapBubbleMenu.test.tsx

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TiptapBubbleMenu } from './TiptapBubbleMenu'

// Test wrapper with actual editor
const TestEditor = ({ initialContent = '<p>Test content</p>' }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
  })

  if (!editor) return null

  return (
    <div>
      <TiptapBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

describe('TiptapBubbleMenu', () => {
  // Visibility
  it('does not show menu without selection', () => {
    render(<TestEditor />)
    expect(screen.queryByLabelText('Fett')).not.toBeVisible()
  })

  it('shows menu when text is selected', async () => {
    render(<TestEditor />)

    // Select text programmatically
    const editor = screen.getByRole('textbox')
    await userEvent.tripleClick(editor) // Select all

    await waitFor(() => {
      expect(screen.getByLabelText('Fett')).toBeVisible()
    })
  })

  // Formatting Actions
  it('applies bold formatting', async () => {
    render(<TestEditor />)

    const editor = screen.getByRole('textbox')
    await userEvent.tripleClick(editor)

    await waitFor(() => {
      const boldButton = screen.getByLabelText('Fett')
      fireEvent.click(boldButton)
    })

    expect(editor.innerHTML).toContain('<strong>')
  })

  it('applies italic formatting', async () => {
    render(<TestEditor />)

    const editor = screen.getByRole('textbox')
    await userEvent.tripleClick(editor)

    await waitFor(() => {
      const italicButton = screen.getByLabelText('Kursiv')
      fireEvent.click(italicButton)
    })

    expect(editor.innerHTML).toContain('<em>')
  })

  // Toggle Behavior
  it('toggles formatting on and off', async () => {
    render(<TestEditor />)

    const editor = screen.getByRole('textbox')
    await userEvent.tripleClick(editor)

    await waitFor(async () => {
      const boldButton = screen.getByLabelText('Fett')

      // Apply
      fireEvent.click(boldButton)
      expect(editor.innerHTML).toContain('<strong>')

      // Remove
      await userEvent.tripleClick(editor)
      fireEvent.click(boldButton)
      expect(editor.innerHTML).not.toContain('<strong>')
    })
  })

  // Link Popover
  it('opens link popover on click', async () => {
    render(<TestEditor />)

    const editor = screen.getByRole('textbox')
    await userEvent.tripleClick(editor)

    await waitFor(() => {
      const linkButton = screen.getByLabelText('Link')
      fireEvent.click(linkButton)
    })

    expect(screen.getByLabelText('Link URL')).toBeInTheDocument()
  })

  it('creates link with valid URL', async () => {
    render(<TestEditor />)

    const editor = screen.getByRole('textbox')
    await userEvent.tripleClick(editor)

    await waitFor(async () => {
      fireEvent.click(screen.getByLabelText('Link'))

      const input = screen.getByLabelText('Link URL')
      await userEvent.type(input, 'https://example.com')

      fireEvent.click(screen.getByText('Speichern'))
    })

    expect(editor.innerHTML).toContain('href="https://example.com"')
  })
})
```

### TextSnippet.test.tsx (Updated)

```tsx
import { render, screen } from '@testing-library/react'
import { TextSnippet } from './TextSnippet'

describe('TextSnippet', () => {
  // Read-Only Mode
  describe('readOnly mode', () => {
    it('renders em dash for null value', () => {
      render(<TextSnippet value={null} truncateAt={50} readOnly />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders em dash for empty string', () => {
      render(<TextSnippet value="" truncateAt={50} readOnly />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders plain text wrapped in paragraph', () => {
      render(<TextSnippet value="Hello World" truncateAt={50} readOnly />)
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    it('renders HTML content', () => {
      render(
        <TextSnippet
          value="<p><strong>Bold</strong> text</p>"
          truncateAt={50}
          readOnly
        />
      )
      expect(screen.getByText('Bold')).toBeInTheDocument()
    })

    it('truncates long content', () => {
      const longText = 'A'.repeat(100)
      render(<TextSnippet value={longText} truncateAt={50} readOnly />)
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument()
    })

    it('shows expand button when truncated', () => {
      const longText = 'A'.repeat(100)
      const onExpand = vi.fn()
      render(
        <TextSnippet
          value={longText}
          truncateAt={50}
          readOnly
          onExpand={onExpand}
        />
      )
      expect(screen.getByLabelText('Text erweitern')).toBeInTheDocument()
    })
  })

  // Edit Mode
  describe('edit mode', () => {
    it('renders TiptapEditor', () => {
      render(
        <TextSnippet
          value=""
          truncateAt={50}
          readOnly={false}
          onChange={vi.fn()}
        />
      )
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('passes maxLength to editor', () => {
      render(
        <TextSnippet
          value=""
          truncateAt={50}
          readOnly={false}
          maxLength={100}
          onChange={vi.fn()}
        />
      )
      expect(screen.getByText(/\/ 100/)).toBeInTheDocument()
    })
  })

  // Backward Compatibility
  describe('backward compatibility', () => {
    it('handles legacy plain text', () => {
      render(
        <TextSnippet value="Legacy plain text" truncateAt={50} readOnly />
      )
      expect(screen.getByText('Legacy plain text')).toBeInTheDocument()
    })

    it('handles HTML with XSS attempt', () => {
      render(
        <TextSnippet
          value="<p>Safe</p><script>alert('xss')</script>"
          truncateAt={50}
          readOnly
        />
      )
      expect(screen.getByText('Safe')).toBeInTheDocument()
      expect(screen.queryByText("alert('xss')")).not.toBeInTheDocument()
    })
  })
})
```

## Integration Tests

### CustomFieldsSection with Tiptap

```tsx
describe('CustomFieldsSection with text fields', () => {
  it('renders text field with Tiptap in edit mode', async () => {
    const textField = createMockTextField()
    render(
      <CustomFieldsSection
        availableFields={[textField]}
        fieldValues={[]}
        videoId="123"
        listId="456"
        onFieldChange={vi.fn()}
      />
    )

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('saves formatted content on change', async () => {
    const onFieldChange = vi.fn()
    const textField = createMockTextField()

    render(
      <CustomFieldsSection
        availableFields={[textField]}
        fieldValues={[]}
        videoId="123"
        listId="456"
        onFieldChange={onFieldChange}
      />
    )

    const editor = screen.getByRole('textbox')
    await userEvent.type(editor, 'Hello')

    await waitFor(() => {
      expect(onFieldChange).toHaveBeenCalledWith(
        textField.field_id,
        expect.stringContaining('Hello')
      )
    })
  })
})
```

## Regression Tests

### Bestehende Tests prüfen

- [ ] `FieldDisplay.test.tsx` - Text case still works
- [ ] `CustomFieldsSection.test.tsx` - Integration works
- [ ] `VideoDetailsPage.test.tsx` - Page renders correctly
- [ ] E2E Tests (falls vorhanden) - User flows work

## Test Data

### Mock Text Field

```tsx
const createMockTextField = () => ({
  field_id: 'text-field-123',
  field_name: 'Notes',
  field_type: 'text' as const,
  schema_name: null,
  display_order: 0,
  show_on_card: false,
  config: { max_length: 500 },
})

const createMockTextFieldValue = () => ({
  id: 'value-123',
  video_id: 'video-123',
  field_id: 'text-field-123',
  field_name: 'Notes',
  show_on_card: false,
  field: {
    id: 'text-field-123',
    list_id: 'list-123',
    name: 'Notes',
    field_type: 'text' as const,
    config: { max_length: 500 },
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  value: '<p>Test notes</p>',
  updated_at: '2024-01-01',
})
```

## Test Coverage Goals

| Komponente | Target Coverage |
|------------|-----------------|
| TiptapEditor | 80% |
| TiptapBubbleMenu | 70% |
| TextSnippet | 90% |

## Exit Condition

✅ Testing Strategy vollständig:

> Unit Tests für TiptapEditor, TiptapBubbleMenu, TextSnippet. Integration Tests für CustomFieldsSection. Regression Tests für bestehende Funktionalität. Test Data Mocks definiert.
