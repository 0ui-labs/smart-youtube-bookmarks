/**
 * Zustand mock for Vitest
 * Automatically resets all stores after each test
 * Based on official Zustand testing docs
 */
import { act } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import type * as ZustandExportedTypes from 'zustand';

// Re-export everything from zustand
export * from 'zustand';

// Import actual Zustand functions
const { create: actualCreate, createStore: actualCreateStore } =
  await vi.importActual<typeof ZustandExportedTypes>('zustand');

// Store all reset functions for cleanup
export const storeResetFns = new Set<() => void>();

/**
 * Uncurried version of create that tracks store for auto-reset
 */
const createUncurried = <T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

/**
 * Mocked create function - tracks stores for auto-reset
 */
export const create = (<T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  // Support both curried and uncurried versions
  return typeof stateCreator === 'function'
    ? createUncurried(stateCreator)
    : createUncurried;
}) as typeof ZustandExportedTypes.create;

/**
 * Uncurried version of createStore that tracks store for auto-reset
 */
const createStoreUncurried = <T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  const store = actualCreateStore(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

/**
 * Mocked createStore function - tracks stores for auto-reset
 */
export const createStore = (<T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  // Support both curried and uncurried versions
  return typeof stateCreator === 'function'
    ? createStoreUncurried(stateCreator)
    : createStoreUncurried;
}) as typeof ZustandExportedTypes.createStore;

/**
 * Reset all stores after each test run
 * This ensures test isolation and prevents state leakage between tests
 */
afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => {
      resetFn();
    });
  });
});
