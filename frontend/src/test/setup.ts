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
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

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

// Polyfill for Radix UI components (hasPointerCapture, setPointerCapture, releasePointerCapture, scrollIntoView)
// JSDOM doesn't implement these methods, but Radix UI requires them
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function() {
    return false;
  };
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function() {
    // No-op for JSDOM
  };
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function() {
    // No-op for JSDOM
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function() {
    // No-op for JSDOM
  };
}

// Polyfill for ResizeObserver (required by Radix UI Slider)
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}
