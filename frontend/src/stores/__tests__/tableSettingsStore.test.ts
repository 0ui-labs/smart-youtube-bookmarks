/**
 * Tests for tableSettingsStore - Zustand store for video table preferences
 *
 * Covers: thumbnail size, column visibility, view mode, grid columns, video details view
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSettingsStore } from '../tableSettingsStore';

describe('tableSettingsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useTableSettingsStore());
    act(() => {
      // Clear localStorage for clean test state
      localStorage.clear();
    });
  });

  describe('Initial State', () => {
    it('should have default thumbnail size of "small"', () => {
      const { result } = renderHook(() => useTableSettingsStore());
      expect(result.current.thumbnailSize).toBe('small');
    });

    it('should have all columns visible by default', () => {
      const { result } = renderHook(() => useTableSettingsStore());
      expect(result.current.visibleColumns).toEqual({
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      });
    });

    it('should have default view mode of "list"', () => {
      const { result } = renderHook(() => useTableSettingsStore());
      expect(result.current.viewMode).toBe('list');
    });

    it('should have default grid columns of 3', () => {
      const { result } = renderHook(() => useTableSettingsStore());
      expect(result.current.gridColumns).toBe(3);
    });
  });

  describe('videoDetailsView - Task #131', () => {
    it('should have default videoDetailsView of "page"', () => {
      const { result } = renderHook(() => useTableSettingsStore());
      expect(result.current.videoDetailsView).toBe('page');
    });

    it('should update videoDetailsView to "modal"', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setVideoDetailsView('modal');
      });

      expect(result.current.videoDetailsView).toBe('modal');
    });

    it('should update videoDetailsView back to "page"', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setVideoDetailsView('modal');
      });
      expect(result.current.videoDetailsView).toBe('modal');

      act(() => {
        result.current.setVideoDetailsView('page');
      });
      expect(result.current.videoDetailsView).toBe('page');
    });

    it('should persist videoDetailsView to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setVideoDetailsView('modal');
      });

      const stored = localStorage.getItem('video-table-settings');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.videoDetailsView).toBe('modal');
    });

    it('should restore videoDetailsView from localStorage on new instance', () => {
      // First instance: set to modal
      const { result: result1 } = renderHook(() => useTableSettingsStore());
      act(() => {
        result1.current.setVideoDetailsView('modal');
      });
      expect(result1.current.videoDetailsView).toBe('modal');

      // Simulate store being recreated (like page reload)
      // Zustand's persist middleware should restore from localStorage
      const { result: result2 } = renderHook(() => useTableSettingsStore());
      expect(result2.current.videoDetailsView).toBe('modal');
    });
  });

  describe('setThumbnailSize', () => {
    it('should update thumbnail size', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('large');
      });

      expect(result.current.thumbnailSize).toBe('large');
    });

    it('should persist thumbnail size to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('xlarge');
      });

      const stored = localStorage.getItem('video-table-settings');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.thumbnailSize).toBe('xlarge');
    });
  });

  describe('toggleColumn', () => {
    it('should toggle column visibility', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('duration');
      });

      expect(result.current.visibleColumns.duration).toBe(false);
    });

    it('should toggle back to visible', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('duration');
      });
      expect(result.current.visibleColumns.duration).toBe(false);

      act(() => {
        result.current.toggleColumn('duration');
      });
      expect(result.current.visibleColumns.duration).toBe(true);
    });

    it('should not affect other columns when toggling', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('duration');
      });

      expect(result.current.visibleColumns.thumbnail).toBe(true);
      expect(result.current.visibleColumns.title).toBe(true);
      expect(result.current.visibleColumns.actions).toBe(true);
      expect(result.current.visibleColumns.duration).toBe(false);
    });
  });

  describe('setViewMode', () => {
    it('should update view mode', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setViewMode('grid');
      });

      expect(result.current.viewMode).toBe('grid');
    });

    it('should persist view mode to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setViewMode('grid');
      });

      const stored = localStorage.getItem('video-table-settings');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.viewMode).toBe('grid');
    });
  });

  describe('setGridColumns', () => {
    it('should update grid column count', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setGridColumns(5);
      });

      expect(result.current.gridColumns).toBe(5);
    });

    it('should persist grid columns to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setGridColumns(4);
      });

      const stored = localStorage.getItem('video-table-settings');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.gridColumns).toBe(4);
    });
  });

  describe('Multiple settings updates', () => {
    it('should maintain all settings after multiple updates', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('large');
        result.current.setViewMode('grid');
        result.current.setGridColumns(4);
        result.current.setVideoDetailsView('modal');
      });

      expect(result.current.thumbnailSize).toBe('large');
      expect(result.current.viewMode).toBe('grid');
      expect(result.current.gridColumns).toBe(4);
      expect(result.current.videoDetailsView).toBe('modal');
    });

    it('should persist all settings to localStorage correctly', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('medium');
        result.current.setViewMode('grid');
        result.current.setGridColumns(2);
        result.current.setVideoDetailsView('modal');
        result.current.toggleColumn('duration');
      });

      const stored = localStorage.getItem('video-table-settings');
      const parsed = JSON.parse(stored!);

      expect(parsed.state.thumbnailSize).toBe('medium');
      expect(parsed.state.viewMode).toBe('grid');
      expect(parsed.state.gridColumns).toBe(2);
      expect(parsed.state.videoDetailsView).toBe('modal');
      expect(parsed.state.visibleColumns.duration).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should only accept valid VideoDetailsView types', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      // Valid types
      act(() => {
        result.current.setVideoDetailsView('page');
      });
      expect(result.current.videoDetailsView).toBe('page');

      act(() => {
        result.current.setVideoDetailsView('modal');
      });
      expect(result.current.videoDetailsView).toBe('modal');

      // TypeScript would catch invalid types at compile time
      // This test documents the valid options
    });

    it('should only accept valid ViewMode types', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setViewMode('list');
      });
      expect(result.current.viewMode).toBe('list');

      act(() => {
        result.current.setViewMode('grid');
      });
      expect(result.current.viewMode).toBe('grid');
    });

    it('should only accept valid GridColumnCount types', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      const validCounts = [2, 3, 4, 5] as const;

      validCounts.forEach((count) => {
        act(() => {
          result.current.setGridColumns(count);
        });
        expect(result.current.gridColumns).toBe(count);
      });
    });

    it('should only accept valid ThumbnailSize types', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      const validSizes = ['small', 'medium', 'large', 'xlarge'] as const;

      validSizes.forEach((size) => {
        act(() => {
          result.current.setThumbnailSize(size);
        });
        expect(result.current.thumbnailSize).toBe(size);
      });
    });
  });
});
