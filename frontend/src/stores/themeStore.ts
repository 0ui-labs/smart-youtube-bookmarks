/**
 * Theme Store - Zustand state management for dark/light mode
 *
 * Manages theme preference with localStorage persistence and applies
 * the theme class to the document root element.
 *
 * @example
 * ```tsx
 * const { theme, setTheme, toggleTheme } = useThemeStore();
 * ```
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeStore {
  /** Current theme ('light' or 'dark') */
  theme: Theme;
  /** Set theme to specific value */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
}

/**
 * Apply theme class to document root element
 * This function is called whenever the theme changes
 */
const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

/**
 * Theme store hook with localStorage persistence
 *
 * WHY persist middleware with onRehydrateStorage:
 * - User preference persists across page reloads
 * - onRehydrateStorage ensures theme is applied immediately on load
 * - Prevents flash of wrong theme on initial render
 *
 * Storage key: 'theme-settings'
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",

      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },

      toggleTheme: () => {
        const newTheme = get().theme === "light" ? "dark" : "light";
        applyThemeToDocument(newTheme);
        set({ theme: newTheme });
      },
    }),
    {
      name: "theme-settings",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Apply theme immediately when store rehydrates from localStorage
        if (state) {
          applyThemeToDocument(state.theme);
        }
      },
    }
  )
);

/**
 * Initialize theme on app load
 * Call this in App.tsx or main.tsx to ensure theme is applied before first render
 */
export const initializeTheme = () => {
  // Try to read theme from localStorage before Zustand hydration
  try {
    const stored = localStorage.getItem("theme-settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.state?.theme) {
        applyThemeToDocument(parsed.state.theme);
      }
    }
  } catch {
    // Ignore errors, will use default light theme
  }
};
