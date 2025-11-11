/**
 * Vitest setup file for test environment configuration
 */

// Import jest-dom custom matchers for toBeInTheDocument, toHaveAttribute, etc.
import '@testing-library/jest-dom/vitest';

// Import vi from vitest for mocking
import { vi, beforeAll, afterEach, afterAll } from 'vitest';

// Import MSW server
import { server } from './mocks/server';

// Auto-mock Zustand for test isolation (uses __mocks__/zustand.ts)
vi.mock('zustand');

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test to prevent state leakage
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());

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
