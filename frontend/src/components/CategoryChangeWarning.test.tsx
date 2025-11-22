/**
 * Unit Tests for CategoryChangeWarning Component
 * Phase 5 Step 5.4-5.6 (TDD)
 *
 * Tests the warning dialog that shows when changing a video's category.
 * Features:
 * - Shows fields that will be backed up
 * - Shows fields that will persist (workspace fields)
 * - Offers restore checkbox when previous backup exists
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryChangeWarning } from './CategoryChangeWarning'
import type { Tag } from '@/types/tag'

// Mock categories
const mockOldCategory: Tag = {
  id: 'cat-old',
  name: 'Keto Rezepte',
  color: '#FF5722',
  schema_id: 'schema-1',
  is_video_type: true,
  user_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockNewCategory: Tag = {
  id: 'cat-new',
  name: 'Vegan',
  color: '#4CAF50',
  schema_id: 'schema-2',
  is_video_type: true,
  user_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Mock field values that will be backed up (category-specific)
const mockFieldValuesToBackup = [
  {
    id: 'fv-1',
    field_id: 'field-1',
    value: 500,
    field: { id: 'field-1', name: 'Kalorien', field_type: 'number' as const },
  },
  {
    id: 'fv-2',
    field_id: 'field-2',
    value: 'Lecker',
    field: { id: 'field-2', name: 'Bewertung', field_type: 'text' as const },
  },
]

// Mock field values that will persist (workspace fields)
const mockFieldValuesThatPersist = [
  {
    id: 'fv-3',
    field_id: 'field-3',
    value: 'Notiz zum Video',
    field: { id: 'field-3', name: 'Notizen', field_type: 'text' as const },
  },
]

describe('CategoryChangeWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Step 5.4: Dialog Shell tests
  describe('Dialog Shell (Step 5.4)', () => {
    it('renders dialog when open is true', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // Use heading role to target the title specifically
      expect(screen.getByRole('heading', { name: /kategorie ändern/i })).toBeInTheDocument()
    })

    it('does not render dialog when open is false', () => {
      render(
        <CategoryChangeWarning
          open={false}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows warning icon in dialog title', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      // AlertTriangle icon should be present
      expect(screen.getByTestId('warning-icon')).toBeInTheDocument()
    })

    it('shows category change description', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText(/Keto Rezepte/)).toBeInTheDocument()
      expect(screen.getByText(/Vegan/)).toBeInTheDocument()
    })

    it('calls onCancel when cancel button clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      )

      await user.click(screen.getByRole('button', { name: /abbrechen/i }))
      expect(onCancel).toHaveBeenCalled()
    })

    it('calls onConfirm with false when confirm button clicked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: /kategorie ändern/i }))
      expect(onConfirm).toHaveBeenCalledWith(false)
    })
  })

  // Step 5.5: Fields To Backup Section
  describe('Fields To Backup Section (Step 5.5)', () => {
    it('shows fields that will be backed up', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={mockFieldValuesToBackup}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText(/folgende werte werden gesichert/i)).toBeInTheDocument()
      expect(screen.getByText('Kalorien')).toBeInTheDocument()
      expect(screen.getByText('500')).toBeInTheDocument()
      expect(screen.getByText('Bewertung')).toBeInTheDocument()
      expect(screen.getByText('Lecker')).toBeInTheDocument()
    })

    it('shows fields that will persist (workspace fields)', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={mockFieldValuesThatPersist}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText(/folgenden felder bleiben/i)).toBeInTheDocument()
      expect(screen.getByText('Notizen')).toBeInTheDocument()
      expect(screen.getByText('Notiz zum Video')).toBeInTheDocument()
    })

    it('does not show backup section when no fields to backup', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.queryByText(/folgende werte werden gesichert/i)).not.toBeInTheDocument()
    })

    it('does not show persist section when no fields persist', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={mockFieldValuesToBackup}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.queryByText(/folgenden felder bleiben/i)).not.toBeInTheDocument()
    })
  })

  // Step 5.6: Restore Checkbox
  describe('Restore Checkbox (Step 5.6)', () => {
    it('shows restore option when backup exists', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={true}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByText(/gesicherte werte gefunden/i)).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /gesicherte werte wiederherstellen/i })).toBeInTheDocument()
    })

    it('does not show restore option when no backup exists', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.queryByText(/gesicherte werte gefunden/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('calls onConfirm with true when checkbox is checked and confirm clicked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={true}
          onConfirm={onConfirm}
          onCancel={vi.fn()}
        />
      )

      // Check the restore checkbox
      const checkbox = screen.getByRole('checkbox', { name: /gesicherte werte wiederherstellen/i })
      await user.click(checkbox)

      // Click confirm
      await user.click(screen.getByRole('button', { name: /kategorie ändern/i }))

      expect(onConfirm).toHaveBeenCalledWith(true)
    })

    it('shows category name in restore message', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={true}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      // Message should mention the new category name (appears multiple times, use getAllByText)
      const veganElements = screen.getAllByText(/Vegan/)
      expect(veganElements.length).toBeGreaterThan(0)
    })
  })

  // Edge cases
  describe('Edge Cases', () => {
    it('handles null oldCategory (assigning first category)', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={null}
          newCategory={mockNewCategory}
          fieldValuesToBackup={[]}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('handles null newCategory (removing category)', () => {
      render(
        <CategoryChangeWarning
          open={true}
          onOpenChange={vi.fn()}
          oldCategory={mockOldCategory}
          newCategory={null}
          fieldValuesToBackup={mockFieldValuesToBackup}
          fieldValuesThatPersist={[]}
          hasBackup={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // Use heading role to target the title specifically
      expect(screen.getByRole('heading', { name: /kategorie entfernen/i })).toBeInTheDocument()
    })
  })
})
