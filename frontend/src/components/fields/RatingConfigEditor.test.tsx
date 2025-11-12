import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatingConfigEditor } from './RatingConfigEditor'

describe('RatingConfigEditor', () => {
  const mockOnChange = vi.fn()

  describe('Rendering', () => {
    it('renders max rating input with current value', () => {
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      const input = screen.getByLabelText(/maximale bewertung/i)
      expect(input).toHaveValue(5)
    })

    it('displays star range preview', () => {
      render(
        <RatingConfigEditor
          config={{ max_rating: 7 }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText(/1-7 sterne/i)).toBeInTheDocument()
    })

    it('shows helper text when no error exists', () => {
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText(/geben sie die maximale anzahl/i)).toBeInTheDocument()
    })
  })

  describe('Validation', () => {
    it('shows error when value is below 1', async () => {
      const user = userEvent.setup()
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      const input = screen.getByLabelText(/maximale bewertung/i)
      await user.clear(input)
      await user.type(input, '0')

      await waitFor(() => {
        expect(screen.getByText(/muss zwischen 1 und 10 liegen/i)).toBeInTheDocument()
      })
    })

    it('shows error when value is above 10', async () => {
      const user = userEvent.setup()
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      const input = screen.getByLabelText(/maximale bewertung/i)
      await user.clear(input)
      await user.type(input, '15')

      await waitFor(() => {
        expect(screen.getByText(/muss zwischen 1 und 10 liegen/i)).toBeInTheDocument()
      })
    })

    it('accepts valid rating values within range', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      // Update with new value
      rerender(
        <RatingConfigEditor
          config={{ max_rating: 7 }}
          onChange={mockOnChange}
        />
      )

      const input = screen.getByLabelText(/maximale bewertung/i)
      expect(input).toHaveValue(7)
    })

    it('shows error when input is cleared', async () => {
      const user = userEvent.setup()
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      const input = screen.getByLabelText(/maximale bewertung/i)
      await user.clear(input)

      await waitFor(() => {
        expect(screen.getByText(/bitte geben sie eine zahl zwischen 1 und 10 ein/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('marks input as invalid when error exists', async () => {
      const user = userEvent.setup()
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      const input = screen.getByLabelText(/maximale bewertung/i)
      await user.clear(input)
      await user.type(input, '15')

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('associates error with input via aria-describedby', async () => {
      const user = userEvent.setup()
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
        />
      )

      const input = screen.getByLabelText(/maximale bewertung/i)
      await user.clear(input)
      await user.type(input, '0')

      await waitFor(() => {
        const describedBy = input.getAttribute('aria-describedby')
        expect(describedBy).toContain('rating-error')
        expect(describedBy).toContain('rating-description')
      })
    })

    it('displays external error when provided', () => {
      const externalError = 'External validation error'
      render(
        <RatingConfigEditor
          config={{ max_rating: 5 }}
          onChange={mockOnChange}
          error={externalError}
        />
      )

      expect(screen.getByText(externalError)).toBeInTheDocument()
    })
  })
})
