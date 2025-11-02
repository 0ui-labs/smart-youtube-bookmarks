/**
 * Vitest setup file for test environment configuration
 */

// Import jest-dom custom matchers for toBeInTheDocument, toHaveAttribute, etc.
import '@testing-library/jest-dom/vitest';

// Import vi from vitest for mocking
import { vi } from 'vitest';

// Auto-mock Zustand for test isolation (uses __mocks__/zustand.ts)
vi.mock('zustand');

// Mock localStorage for tests
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

global.localStorage = new LocalStorageMock() as Storage;
