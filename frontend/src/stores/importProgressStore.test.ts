/**
 * Test suite for import progress store (Zustand)
 * Tests video-level import progress tracking from WebSocket
 *
 * TDD RED phase - Tests written BEFORE implementation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImportProgressStore } from './importProgressStore';
import type { ImportProgress } from './importProgressStore';

describe('useImportProgressStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useImportProgressStore());
    act(() => {
      result.current.clearAllProgress();
    });
  });

  it('sets progress for a video', () => {
    const { result } = renderHook(() => useImportProgressStore());

    act(() => {
      result.current.setProgress('video-1', 25, 'metadata');
    });

    const progress = result.current.progress.get('video-1');
    expect(progress).toBeDefined();
    expect(progress?.progress).toBe(25);
    expect(progress?.stage).toBe('metadata');
  });

  it('updates existing progress', () => {
    const { result } = renderHook(() => useImportProgressStore());

    act(() => {
      result.current.setProgress('video-1', 25, 'metadata');
    });

    act(() => {
      result.current.setProgress('video-1', 60, 'captions');
    });

    const progress = result.current.progress.get('video-1');
    expect(progress?.progress).toBe(60);
    expect(progress?.stage).toBe('captions');
  });

  it('tracks multiple videos independently', () => {
    const { result } = renderHook(() => useImportProgressStore());

    act(() => {
      result.current.setProgress('video-1', 25, 'metadata');
      result.current.setProgress('video-2', 60, 'captions');
      result.current.setProgress('video-3', 100, 'complete');
    });

    expect(result.current.progress.size).toBe(3);
    expect(result.current.progress.get('video-1')?.progress).toBe(25);
    expect(result.current.progress.get('video-2')?.progress).toBe(60);
    expect(result.current.progress.get('video-3')?.progress).toBe(100);
  });

  it('clears progress for a specific video', () => {
    const { result } = renderHook(() => useImportProgressStore());

    act(() => {
      result.current.setProgress('video-1', 25, 'metadata');
      result.current.setProgress('video-2', 60, 'captions');
    });

    act(() => {
      result.current.clearProgress('video-1');
    });

    expect(result.current.progress.has('video-1')).toBe(false);
    expect(result.current.progress.has('video-2')).toBe(true);
  });

  it('clears all progress', () => {
    const { result } = renderHook(() => useImportProgressStore());

    act(() => {
      result.current.setProgress('video-1', 25, 'metadata');
      result.current.setProgress('video-2', 60, 'captions');
      result.current.setProgress('video-3', 100, 'complete');
    });

    act(() => {
      result.current.clearAllProgress();
    });

    expect(result.current.progress.size).toBe(0);
  });

  it('provides getProgress helper', () => {
    const { result } = renderHook(() => useImportProgressStore());

    act(() => {
      result.current.setProgress('video-1', 50, 'captions');
    });

    expect(result.current.getProgress('video-1')).toEqual({
      progress: 50,
      stage: 'captions',
    });
    expect(result.current.getProgress('non-existent')).toBeUndefined();
  });

  it('isImporting returns true for non-complete stages', () => {
    const { result } = renderHook(() => useImportProgressStore());

    act(() => {
      result.current.setProgress('video-1', 25, 'metadata');
      result.current.setProgress('video-2', 100, 'complete');
      result.current.setProgress('video-3', 0, 'error');
    });

    expect(result.current.isImporting('video-1')).toBe(true);
    expect(result.current.isImporting('video-2')).toBe(false);
    expect(result.current.isImporting('video-3')).toBe(false);
    expect(result.current.isImporting('non-existent')).toBe(false);
  });
});
