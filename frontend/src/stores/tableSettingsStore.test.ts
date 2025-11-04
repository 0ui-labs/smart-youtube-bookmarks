import { renderHook, act } from '@testing-library/react';
import { useTableSettingsStore } from './tableSettingsStore';

describe('useTableSettingsStore', () => {
  // REF MCP #2: Use persist.clearStorage() for proper test isolation
  beforeEach(async () => {
    localStorage.clear();
    // Clear storage via Zustand's persist API (cleaner than manual setState)
    useTableSettingsStore.persist.clearStorage();
    // Rehydrate to get fresh defaults (await to prevent flaky tests)
    await useTableSettingsStore.persist.rehydrate();
  });

  describe('Thumbnail Size', () => {
    it('has default thumbnail size of "small"', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      expect(result.current.thumbnailSize).toBe('small');
    });

    it('changes thumbnail size via setThumbnailSize', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('large');
      });

      expect(result.current.thumbnailSize).toBe('large');
    });

    it('persists thumbnail size to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('medium');
      });

      // Check localStorage directly
      const stored = JSON.parse(localStorage.getItem('video-table-settings') || '{}');
      expect(stored.state.thumbnailSize).toBe('medium');
    });
  });

  describe('Column Visibility', () => {
    it('has all columns visible by default', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      // REF MCP #3: Only 4 columns (thumbnail, title, duration, actions)
      expect(result.current.visibleColumns).toEqual({
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      });
    });

    it('toggles column visibility via toggleColumn', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('duration');
      });

      expect(result.current.visibleColumns.duration).toBe(false);
      expect(result.current.visibleColumns.title).toBe(true); // Others unchanged
    });

    it('toggles column back to visible when called twice', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('thumbnail');
      });
      expect(result.current.visibleColumns.thumbnail).toBe(false);

      act(() => {
        result.current.toggleColumn('thumbnail');
      });
      expect(result.current.visibleColumns.thumbnail).toBe(true);
    });

    it('persists column visibility to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('thumbnail');
        result.current.toggleColumn('actions');
      });

      // Check localStorage
      const stored = JSON.parse(localStorage.getItem('video-table-settings') || '{}');
      expect(stored.state.visibleColumns.thumbnail).toBe(false);
      expect(stored.state.visibleColumns.actions).toBe(false);
      expect(stored.state.visibleColumns.title).toBe(true); // Unchanged
    });
  });

  describe('Persistence & Rehydration', () => {
    it('rehydrates state from localStorage on mount', async () => {
      // Simulate existing localStorage data (Zustand v4 format)
      const existingData = {
        state: {
          thumbnailSize: 'large',
          visibleColumns: {
            thumbnail: true,
            title: false,
            duration: true,
            actions: false,
          },
        },
        version: 0,
      };
      localStorage.setItem('video-table-settings', JSON.stringify(existingData));

      // Trigger rehydration to load the persisted data
      await useTableSettingsStore.persist.rehydrate();

      // Create new hook instance (simulates page reload)
      const { result } = renderHook(() => useTableSettingsStore());

      // Should load persisted values
      expect(result.current.thumbnailSize).toBe('large');
      expect(result.current.visibleColumns.title).toBe(false);
      expect(result.current.visibleColumns.actions).toBe(false);
    });

    it('uses default values when localStorage is empty', () => {
      // Ensure localStorage is empty
      localStorage.clear();

      const { result } = renderHook(() => useTableSettingsStore());

      expect(result.current.thumbnailSize).toBe('small');
      expect(result.current.visibleColumns.thumbnail).toBe(true);
    });

    // REF MCP #5: Test edge case for corrupted localStorage data
    it('handles corrupted localStorage data gracefully', () => {
      // Simulate corrupted/invalid JSON data
      localStorage.setItem('video-table-settings', 'invalid-json-{{{');

      const { result } = renderHook(() => useTableSettingsStore());

      // Should fall back to defaults instead of crashing
      expect(result.current.thumbnailSize).toBe('small');
      expect(result.current.visibleColumns.thumbnail).toBe(true);
      expect(result.current.visibleColumns.title).toBe(true);
      expect(result.current.visibleColumns.duration).toBe(true);
      expect(result.current.visibleColumns.actions).toBe(true);
    });
  });

  describe('Column Names Alignment', () => {
    // REF MCP #3: Verify column names match actual VideosPage table structure
    it('has column names that match VideosPage table structure', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      const columnNames = Object.keys(result.current.visibleColumns);

      // These should match the column IDs used in VideosPage.tsx
      expect(columnNames).toContain('thumbnail'); // matches 'thumbnail' column (id: 'thumbnail')
      expect(columnNames).toContain('title');     // matches 'title' column (id: 'title')
      expect(columnNames).toContain('duration');  // matches 'duration' column (id: 'duration')
      expect(columnNames).toContain('actions');   // matches 'actions' column (id: 'actions')
    });

    it('has exactly 4 columns configured', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      const columnCount = Object.keys(result.current.visibleColumns).length;
      expect(columnCount).toBe(4);
    });

    it('does not have status or created_at columns yet', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      const columnNames = Object.keys(result.current.visibleColumns);

      // These columns will be added in Task #27
      expect(columnNames).not.toContain('status');
      expect(columnNames).not.toContain('created_at');
    });
  });

  // Task #32 - Step 1.1: TDD tests for viewMode state
  describe('View Mode (Task #32)', () => {
    it('defaults to list view', () => {
      const { result } = renderHook(() => useTableSettingsStore())
      expect(result.current.viewMode).toBe('list')
    })

    it('toggles between list and grid view', () => {
      const { result } = renderHook(() => useTableSettingsStore())

      act(() => {
        result.current.setViewMode('grid')
      })

      expect(result.current.viewMode).toBe('grid')

      act(() => {
        result.current.setViewMode('list')
      })

      expect(result.current.viewMode).toBe('list')
    })

    it('persists viewMode to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore())

      act(() => {
        result.current.setViewMode('grid')
      })

      // Unmount and remount to test persistence
      const { result: result2 } = renderHook(() => useTableSettingsStore())
      expect(result2.current.viewMode).toBe('grid')
    })

    it('works independently from thumbnailSize', () => {
      const { result } = renderHook(() => useTableSettingsStore())

      // Set grid view with small thumbnails
      act(() => {
        result.current.setViewMode('grid')
        result.current.setThumbnailSize('small')
      })

      expect(result.current.viewMode).toBe('grid')
      expect(result.current.thumbnailSize).toBe('small')

      // Change to large thumbnails, view stays grid
      act(() => {
        result.current.setThumbnailSize('large')
      })

      expect(result.current.viewMode).toBe('grid')
      expect(result.current.thumbnailSize).toBe('large')
    })
  })

  // Task #33: TDD tests for gridColumns state
  describe('Grid Columns (Task #33)', () => {
    it('defaults to 3 columns (balanced layout)', () => {
      const { result } = renderHook(() => useTableSettingsStore())
      expect(result.current.gridColumns).toBe(3)
    })

    it('changes grid columns via setGridColumns', () => {
      const { result } = renderHook(() => useTableSettingsStore())

      // Test all valid values (2, 3, 4, 5)
      act(() => {
        result.current.setGridColumns(5)
      })
      expect(result.current.gridColumns).toBe(5)

      act(() => {
        result.current.setGridColumns(2)
      })
      expect(result.current.gridColumns).toBe(2)

      act(() => {
        result.current.setGridColumns(4)
      })
      expect(result.current.gridColumns).toBe(4)
    })

    it('persists gridColumns to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore())

      act(() => {
        result.current.setGridColumns(4)
      })

      // Unmount and remount to test persistence (simulates page reload)
      const { result: result2 } = renderHook(() => useTableSettingsStore())
      expect(result2.current.gridColumns).toBe(4)
    })

    it('works independently with all other settings (regression test)', () => {
      const { result } = renderHook(() => useTableSettingsStore())

      // Set multiple fields including gridColumns
      act(() => {
        result.current.setGridColumns(5)
        result.current.setViewMode('grid')
        result.current.setThumbnailSize('large')
        result.current.toggleColumn('duration')
      })

      // Verify ALL fields updated correctly
      expect(result.current.gridColumns).toBe(5)
      expect(result.current.viewMode).toBe('grid')
      expect(result.current.thumbnailSize).toBe('large')
      expect(result.current.visibleColumns.duration).toBe(false)
      expect(result.current.visibleColumns.title).toBe(true) // Unchanged

      // Verify localStorage persisted ALL fields
      const stored = JSON.parse(localStorage.getItem('video-table-settings') || '{}')
      expect(stored.state.gridColumns).toBe(5)
      expect(stored.state.viewMode).toBe('grid')
      expect(stored.state.thumbnailSize).toBe('large')
      expect(stored.state.visibleColumns.duration).toBe(false)
    })
  })
});
