import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DropZoneOverlay } from './DropZoneOverlay'

describe('DropZoneOverlay', () => {
  describe('basic rendering', () => {
    it('renders with default message', () => {
      render(<DropZoneOverlay />)
      expect(screen.getByText(/Videos hier ablegen/i)).toBeInTheDocument()
    })

    it('renders custom message', () => {
      render(<DropZoneOverlay message="Custom drop message" />)
      expect(screen.getByText('Custom drop message')).toBeInTheDocument()
    })

    it('renders download icon', () => {
      render(<DropZoneOverlay />)
      expect(screen.getByTestId('drop-zone-icon')).toBeInTheDocument()
    })
  })

  describe('valid/invalid states', () => {
    it('shows valid state styling by default', () => {
      render(<DropZoneOverlay />)
      const container = screen.getByTestId('drop-zone-overlay')
      expect(container).toHaveClass('border-primary')
    })

    it('shows invalid state styling when isValid=false', () => {
      render(<DropZoneOverlay isValid={false} />)
      const container = screen.getByTestId('drop-zone-overlay')
      expect(container).toHaveClass('border-destructive')
    })

    it('shows valid state styling when isValid=true', () => {
      render(<DropZoneOverlay isValid={true} />)
      const container = screen.getByTestId('drop-zone-overlay')
      expect(container).toHaveClass('border-primary')
    })
  })

  describe('accessibility', () => {
    it('has role="region"', () => {
      render(<DropZoneOverlay />)
      expect(screen.getByRole('region')).toBeInTheDocument()
    })

    it('has aria-label', () => {
      render(<DropZoneOverlay />)
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-label')
    })
  })

  describe('animation wrapper', () => {
    it('renders with AnimatePresence wrapper', () => {
      const { container } = render(<DropZoneOverlay />)
      // Component should render (AnimatePresence is internal)
      expect(container.firstChild).toBeInTheDocument()
    })
  })
})
