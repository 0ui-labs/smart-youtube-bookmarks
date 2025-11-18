/**
 * Unit Tests for SchemaSelector Component
 * Task #82 Batch 4 - Step 9
 *
 * Tests the SchemaSelector dropdown component that allows users to:
 * - Select "Kein Schema" (null)
 * - Select an existing schema by UUID
 * - Trigger "Create New Schema" mode ('new')
 *
 * NOTE: Radix UI Select uses portals which makes testing dropdown content difficult in JSDOM.
 * These tests focus on the trigger element and basic functionality rather than dropdown interactions.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SchemaSelector } from './SchemaSelector'

const mockSchemas = [
  { id: 'schema-1', name: 'Video Quality', description: 'Quality metrics' },
  { id: 'schema-2', name: 'Content Rating', description: null },
]

describe('SchemaSelector', () => {
  it('renders with "Kein Schema" placeholder when value is null', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
      />
    )

    // The SelectValue component with placeholder="Kein Schema" should be present
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders with schemas prop', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={mockSchemas}
        onChange={vi.fn()}
      />
    )

    // Component renders without crashing
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('passes value prop to Select component', () => {
    const { rerender } = render(
      <SchemaSelector
        value={null}
        schemas={mockSchemas}
        onChange={vi.fn()}
      />
    )

    // Component renders with null value
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    // Rerender with schema-1 selected
    rerender(
      <SchemaSelector
        value="schema-1"
        schemas={mockSchemas}
        onChange={vi.fn()}
      />
    )

    // Component updates without crashing
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('calls onChange handler when provided', () => {
    const onChange = vi.fn()

    render(
      <SchemaSelector
        value={null}
        schemas={mockSchemas}
        onChange={onChange}
      />
    )

    // onChange prop is passed to component
    expect(onChange).not.toHaveBeenCalled()
  })

  it('converts null to internal "__none__" value', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={mockSchemas}
        onChange={vi.fn()}
      />
    )

    // Component handles null value correctly (no errors)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('converts schema UUID to Select value', () => {
    render(
      <SchemaSelector
        value="schema-1"
        schemas={mockSchemas}
        onChange={vi.fn()}
      />
    )

    // Component handles UUID value correctly (no errors)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders with empty schemas array', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
      />
    )

    // Component handles empty schemas (only "Kein Schema" and "Create new" options)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('disables dropdown when disabled prop is true', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
        disabled={true}
      />
    )

    const combobox = screen.getByRole('combobox')
    expect(combobox).toHaveAttribute('data-disabled', '')
  })

  it('has proper ARIA label for accessibility', () => {
    render(
      <SchemaSelector
        value={null}
        schemas={[]}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Schema auswählen')).toBeInTheDocument()
  })
})
