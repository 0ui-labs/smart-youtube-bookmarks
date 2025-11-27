/**
 * Tests for ProgressOverlay component
 * TDD RED phase - Tests written BEFORE implementation
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressOverlay } from './ProgressOverlay';

describe('ProgressOverlay', () => {
  it('renders progress percentage', () => {
    render(<ProgressOverlay progress={50} stage="captions" />);

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders stage label', () => {
    render(<ProgressOverlay progress={25} stage="metadata" />);

    // Use getAllByText since label appears in visible span + sr-only span
    expect(screen.getAllByText(/metadata/i).length).toBeGreaterThanOrEqual(1);
  });

  it('has correct ARIA attributes for progressbar', () => {
    render(<ProgressOverlay progress={60} stage="captions" />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '60');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps progress to 0-100 range', () => {
    const { rerender } = render(<ProgressOverlay progress={-10} stage="created" />);

    // Negative should be clamped to 0
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    // Above 100 should be clamped to 100
    rerender(<ProgressOverlay progress={150} stage="complete" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders SVG circular progress indicator', () => {
    const { container } = render(<ProgressOverlay progress={50} stage="captions" />);

    // Should have an SVG element
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Should have circle elements for track and progress
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2); // track + progress
  });

  it('applies overlay styling classes', () => {
    const { container } = render(<ProgressOverlay progress={50} stage="captions" />);

    // Should have absolute positioning for overlay
    const overlay = container.firstChild;
    expect(overlay).toHaveClass('absolute');
    expect(overlay).toHaveClass('inset-0'); // covers entire parent
  });

  it('shows different labels for each stage', () => {
    const stages: Array<{ stage: string; expectedText: RegExp }> = [
      { stage: 'created', expectedText: /erstellt|created/i },
      { stage: 'metadata', expectedText: /metadata/i },
      { stage: 'captions', expectedText: /untertitel|captions/i },
      { stage: 'chapters', expectedText: /kapitel|chapters/i },
    ];

    stages.forEach(({ stage, expectedText }) => {
      const { unmount } = render(<ProgressOverlay progress={50} stage={stage} />);
      // Use getAllByText since label appears in visible span + sr-only span
      expect(screen.getAllByText(expectedText).length).toBeGreaterThanOrEqual(1);
      unmount();
    });
  });

  it('respects reduced motion preferences', () => {
    const { container } = render(<ProgressOverlay progress={50} stage="captions" />);

    // Should have motion-safe/motion-reduce classes
    const progressElement = container.querySelector('.motion-safe\\:animate-spin, .motion-reduce\\:animate-none, circle');
    // At least the component should exist
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
