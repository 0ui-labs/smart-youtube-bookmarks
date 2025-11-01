import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollapsibleSidebar } from './CollapsibleSidebar'
import { vi } from 'vitest'

describe('CollapsibleSidebar', () => {
  // Mock window.innerWidth for mobile/desktop tests
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop by default
    })
    // Dispatch resize event to trigger component's resize listener
    window.dispatchEvent(new Event('resize'))
  })

  // Clean up and reset to desktop after each test
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    window.dispatchEvent(new Event('resize'))
  })

  it('renders sidebar content on desktop', () => {
    render(
      <CollapsibleSidebar>
        <div>Sidebar Navigation</div>
      </CollapsibleSidebar>
    )

    expect(screen.getByText('Sidebar Navigation')).toBeInTheDocument()
  })

  it('sidebar is visible by default on desktop', () => {
    render(
      <CollapsibleSidebar>
        <nav>Navigation</nav>
      </CollapsibleSidebar>
    )

    const sidebar = screen.getByRole('navigation')
    expect(sidebar).toBeVisible()
  })

  it('renders toggle button on mobile', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    window.dispatchEvent(new Event('resize'))

    render(
      <CollapsibleSidebar>
        <div>Navigation</div>
      </CollapsibleSidebar>
    )

    expect(screen.getByLabelText(/navigation/i)).toBeInTheDocument()
  })

  it('toggles sidebar on mobile when button clicked', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    window.dispatchEvent(new Event('resize'))
    const user = userEvent.setup()

    render(
      <CollapsibleSidebar>
        <div>Mobile Nav</div>
      </CollapsibleSidebar>
    )

    // Initially closed on mobile
    expect(screen.queryByText('Mobile Nav')).not.toBeInTheDocument()

    // Click toggle
    const toggleButton = screen.getByLabelText(/open navigation/i)
    await user.click(toggleButton)

    // Should be visible after animation
    await waitFor(() => {
      expect(screen.getByText('Mobile Nav')).toBeVisible()
    })
  })

  it('closes mobile sidebar when backdrop clicked', async () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    window.dispatchEvent(new Event('resize'))
    const user = userEvent.setup()

    render(
      <CollapsibleSidebar>
        <div>Mobile Nav</div>
      </CollapsibleSidebar>
    )

    // Open sidebar
    await user.click(screen.getByLabelText(/open navigation/i))

    // Wait for content to appear
    await waitFor(() => {
      expect(screen.getByText('Mobile Nav')).toBeInTheDocument()
    })

    // Click backdrop
    const backdrop = document.querySelector('.fixed.inset-0')
    expect(backdrop).toBeInTheDocument()

    await user.click(backdrop as HTMLElement)

    // Sidebar should close
    await waitFor(() => {
      expect(screen.queryByText('Mobile Nav')).not.toBeInTheDocument()
    })
  })

  it('has proper ARIA attributes', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    window.dispatchEvent(new Event('resize'))

    render(
      <CollapsibleSidebar>
        <div>Navigation</div>
      </CollapsibleSidebar>
    )

    const toggleButton = screen.getByRole('button')

    // Should have aria-label
    expect(toggleButton).toHaveAttribute('aria-label')

    // aria-label should describe action
    expect(
      toggleButton.getAttribute('aria-label')
    ).toMatch(/navigation/i)
  })
})
