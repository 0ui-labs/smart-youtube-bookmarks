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

    // Setup default mock implementation with selector pattern
    const mockStore = {
      thumbnailSize: 'small',
      viewMode: 'list',
      gridColumns: 3,
      videoDetailsView: 'page', // Task #131: Default to page
      visibleColumns: {
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      },
      setThumbnailSize: vi.fn(),
      setViewMode: vi.fn(),
      setGridColumns: vi.fn(),
      setVideoDetailsView: vi.fn(), // Task #131
      toggleColumn: vi.fn(),
    };

    // Mock to handle selector calls
    vi.mocked(useTableSettingsStore).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStore);
      }
      return mockStore;
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
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'list',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize,
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown and click "Mittel"
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));
      await user.click(screen.getByRole('menuitemradio', { name: /mittel/i }));

      // Verify store action was called with correct value
      expect(setThumbnailSize).toHaveBeenCalledWith('medium');
    });

    it('shows current thumbnail size as selected', async () => {
      const mockStore = {
        thumbnailSize: 'large', // Set to large
        viewMode: 'list',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

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
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'list',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn,
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      await user.click(screen.getByRole('button', { name: /einstellungen/i }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: /dauer/i }));

      expect(toggleColumn).toHaveBeenCalledWith('duration');
    });

    it('shows current column visibility state', async () => {
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'list',
        gridColumns: 3,
        visibleColumns: {
          thumbnail: true,
          title: false, // Hidden
          duration: true,
          actions: true
        },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

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

  describe('Keyboard Navigation (Accessibility)', () => {
    // REF MCP Improvement #6: Test keyboard navigation
    it('supports keyboard navigation with Enter and Arrow keys', async () => {
      const setThumbnailSize = vi.fn();
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'list',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize,
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      const trigger = screen.getByRole('button', { name: /einstellungen/i });

      // Open dropdown with keyboard
      trigger.focus();
      await user.keyboard('{Enter}');

      // Verify dropdown opened
      expect(screen.getByText('Thumbnail-Größe')).toBeInTheDocument();

      // Navigate with Arrow keys (Radix handles focus automatically)
      await user.keyboard('{ArrowDown}');

      // Select with Space (on first radio item "Klein")
      await user.keyboard(' ');

      // Close with Escape
      await user.keyboard('{Escape}');

      // Verify dropdown closed
      expect(screen.queryByText('Thumbnail-Größe')).not.toBeInTheDocument();
    });

    it('closes dropdown with Escape key', async () => {
      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /einstellungen/i });
      await user.click(trigger);

      expect(screen.getByText('Thumbnail-Größe')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Verify dropdown closed
      expect(screen.queryByText('Thumbnail-Größe')).not.toBeInTheDocument();
    });
  });

  describe('Grid Column Control (Task #34)', () => {
    it('does not show grid column control when viewMode is list', async () => {
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'list',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /einstellungen/i });
      await user.click(trigger);

      // Should NOT show Spaltenanzahl section
      expect(screen.queryByText('Spaltenanzahl')).not.toBeInTheDocument();
      expect(screen.queryByText('2 Spalten (Breit)')).not.toBeInTheDocument();
    });

    it('shows grid column control when viewMode is grid', async () => {
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'grid',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /einstellungen/i });
      await user.click(trigger);

      // Should show Spaltenanzahl section with 4 options
      expect(screen.getByText('Spaltenanzahl')).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /2 Spalten \(Breit\)/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /3 Spalten \(Standard\)/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /4 Spalten \(Kompakt\)/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', { name: /5 Spalten \(Dicht\)/i })).toBeInTheDocument();
    });

    it('calls setGridColumns with number when option clicked', async () => {
      const setGridColumns = vi.fn();
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'grid',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns,
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Click 5 columns option
      const option5 = screen.getByRole('menuitemradio', { name: /5 Spalten \(Dicht\)/i });
      await user.click(option5);

      // Verify store was updated with number 5 (not string "5")
      expect(setGridColumns).toHaveBeenCalledWith(5);
      expect(setGridColumns).toHaveBeenCalledTimes(1);
    });

    it('shows current gridColumns value as checked', async () => {
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'grid',
        gridColumns: 4, // Current value is 4
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Find radio item for 4 columns
      const option4 = screen.getByRole('menuitemradio', { name: /4 Spalten \(Kompakt\)/i });

      // Should have checked state
      expect(option4).toHaveAttribute('aria-checked', 'true');
    });

    it('has accessible aria-label on RadioGroup', async () => {
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'grid',
        gridColumns: 3,
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // RadioGroup should have aria-label
      const radioGroup = screen.getByRole('group', { name: /spaltenanzahl für grid-ansicht/i });
      expect(radioGroup).toBeInTheDocument();
    });
  });

  // Task #131 Step 5: Video Details View Tests
  describe('Video Details View (Task #131)', () => {
    it('renders Video Details RadioGroup with correct default ("page")', async () => {
      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      const trigger = screen.getByRole('button', { name: /einstellungen/i });
      await user.click(trigger);

      // Should show Video Details section
      expect(screen.getByText('Video Details')).toBeInTheDocument();

      // Should show 2 options
      expect(screen.getByLabelText('Eigene Seite (Standard)')).toBeInTheDocument();
      expect(screen.getByLabelText('Modal Dialog')).toBeInTheDocument();

      // "page" option should be checked by default
      const pageRadio = screen.getByRole('radio', { name: /eigene seite/i });
      expect(pageRadio).toBeChecked();
    });

    it('updates store when "modal" option selected', async () => {
      const setVideoDetailsView = vi.fn();
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'list',
        gridColumns: 3,
        videoDetailsView: 'page',
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        setVideoDetailsView,
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Click "Modal Dialog" option
      const modalRadio = screen.getByLabelText('Modal Dialog');
      await user.click(modalRadio);

      // Verify store was updated with 'modal'
      expect(setVideoDetailsView).toHaveBeenCalledWith('modal');
    });

    it('updates store when "page" option selected', async () => {
      const setVideoDetailsView = vi.fn();
      const mockStore = {
        thumbnailSize: 'small',
        viewMode: 'list',
        gridColumns: 3,
        videoDetailsView: 'modal', // Start with modal
        visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
        setThumbnailSize: vi.fn(),
        setViewMode: vi.fn(),
        setGridColumns: vi.fn(),
        setVideoDetailsView,
        toggleColumn: vi.fn(),
      };
      vi.mocked(useTableSettingsStore).mockImplementation((selector: any) =>
        typeof selector === 'function' ? selector(mockStore) : mockStore
      );

      const user = userEvent.setup();
      render(<TableSettingsDropdown />);

      // Open dropdown
      await user.click(screen.getByRole('button', { name: /einstellungen/i }));

      // Modal should be checked initially
      const modalRadio = screen.getByRole('radio', { name: /modal dialog/i });
      expect(modalRadio).toBeChecked();

      // Click "Eigene Seite" option
      const pageRadio = screen.getByLabelText('Eigene Seite (Standard)');
      await user.click(pageRadio);

      // Verify store was updated with 'page'
      expect(setVideoDetailsView).toHaveBeenCalledWith('page');
    });
  });
});
