// frontend/src/components/TableSettingsDropdown.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  describe('Thumbnail Size Selection', () => {
    it('shows thumbnail size options when opened', async () => {
      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /einstellungen/i });
      await user.click(trigger);

      // Verify thumbnail size section exists
      expect(screen.getByText('Thumbnail-Größe')).toBeInTheDocument();

      // Verify 3 size options
      expect(screen.getByRole('menuitemradio', { name: /klein/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /mittel/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /groß/i })).toBeInTheDocument();
    });

    it('calls setThumbnailSize when size option clicked', async () => {
      const setThumbnailSize = vi.fn();
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'small',
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize,
        toggleColumn: vi.fn(),
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown and click "Mittel"
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));
      await user.click(screen.getByRole('menuitemradio', { name: /mittel/i }));

      // Verify store action was called with correct value
      expect(setThumbnailSize).toHaveBeenCalledWith('medium');
    });

    it('shows current thumbnail size as selected', async () => {
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'large', // Set to large
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        toggleColumn: vi.fn(),
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Verify "Groß" is checked
      const largeOption = screen.getByRole('menuitemradio', { name: /groß/i });
      expect(largeOption).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Column Visibility', () => {
    it('shows column visibility checkboxes when opened', async () => {
      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Verify section label
      expect(screen.getByText('Sichtbare Spalten')).toBeInTheDocument();

      // Verify 4 column checkboxes exist
      expect(screen.getByRole('menuitemcheckbox', { name: /thumbnail/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: /titel/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: /dauer/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: /aktionen/i })).toBeInTheDocument();
    });

    it('calls toggleColumn when checkbox clicked', async () => {
      const toggleColumn = vi.fn();
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'small',
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        toggleColumn,
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: /dauer/i }));

      expect(toggleColumn).toHaveBeenCalledWith('duration');
    });

    it('shows current column visibility state', async () => {
      vi.mocked(useTableSettingsStore).mockReturnValue({
        thumbnailSize: 'small',
        visibleColumns: {
          thumbnail: true,
          title: false, // Hidden
          duration: true,
          actions: true
        },
        setThumbnailSize: vi.fn(),
        toggleColumn: vi.fn(),
      });

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Verify title checkbox is unchecked
      const titleCheckbox = screen.getByRole('menuitemcheckbox', { name: /titel/i });
      expect(titleCheckbox).toHaveAttribute('aria-checked', 'false');

      // Verify thumbnail checkbox is checked
      const thumbnailCheckbox = screen.getByRole('menuitemcheckbox', { name: /thumbnail/i });
      expect(thumbnailCheckbox).toHaveAttribute('aria-checked', 'true');
    });
  });
});
