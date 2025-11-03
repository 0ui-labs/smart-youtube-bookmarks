// frontend/src/components/TableSettingsDropdown.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSettingsDropdown } from './TableSettingsDropdown';
import { useTableSettingsStore } from '@/stores'; // REF MCP: Central import

// Mock the store
vi.mock('@/stores');

describe('TableSettingsDropdown', () => {
  // REF MCP Improvement #4: Test Isolation with beforeEach + afterEach
  beforeEach(() => {
    // Reset ALL mocks before each test
    vi.clearAllMocks();

    // Setup default mock implementation
    vi.mocked(useTableSettingsStore).mockReturnValue({
      thumbnailSize: 'small',
      visibleColumns: {
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      },
      setThumbnailSize: vi.fn(),
      toggleColumn: vi.fn(),
    });
  });

  afterEach(() => {
    // Cleanup after each test
    vi.restoreAllMocks();
  });

  it('renders settings icon trigger button', () => {
    render(<TableSettingsDropdown />);

    // Settings button should be accessible
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    expect(trigger).toBeInTheDocument();
  });
});
