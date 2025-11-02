/**
 * Test suite for tag store (Zustand)
 * Tests multi-select tag filtering functionality
 *
 * TDD RED phase - Tests written BEFORE implementation
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTagStore } from './tagStore';
import type { Tag } from './tagStore';

describe('useTagStore', () => {
  // Note: Store reset is handled automatically by __mocks__/zustand.ts afterEach

  it('toggles tag selection on and off', () => {
    const { result } = renderHook(() => useTagStore());

    // Add tag to selection
    act(() => {
      result.current.toggleTag('tag-1');
    });

    expect(result.current.selectedTagIds).toEqual(['tag-1']);

    // Remove tag from selection
    act(() => {
      result.current.toggleTag('tag-1');
    });

    expect(result.current.selectedTagIds).toEqual([]);
  });

  it('can select multiple tags', () => {
    const { result } = renderHook(() => useTagStore());

    act(() => {
      result.current.toggleTag('tag-1');
      result.current.toggleTag('tag-2');
      result.current.toggleTag('tag-3');
    });

    expect(result.current.selectedTagIds).toEqual(['tag-1', 'tag-2', 'tag-3']);
  });

  it('clears all selected tags', () => {
    const { result } = renderHook(() => useTagStore());

    // Select multiple tags first
    act(() => {
      result.current.toggleTag('tag-1');
      result.current.toggleTag('tag-2');
    });

    expect(result.current.selectedTagIds).toHaveLength(2);

    // Clear all
    act(() => {
      result.current.clearTags();
    });

    expect(result.current.selectedTagIds).toEqual([]);
  });

  it('sets tags list from API', () => {
    const { result } = renderHook(() => useTagStore());

    const mockTags: Tag[] = [
      {
        id: '1',
        name: 'Python',
        color: '#3B82F6',
        user_id: 'user1',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Tutorial',
        color: '#10B981',
        user_id: 'user1',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ];

    act(() => {
      result.current.setTags(mockTags);
    });

    expect(result.current.tags).toEqual(mockTags);
  });
});
