import { defineConfig } from "orval";

/**
 * Orval Configuration
 *
 * Generates TypeScript types and React Query hooks from the backend OpenAPI spec.
 * Uses the existing Axios instance from @/lib/api.ts for HTTP requests.
 *
 * Usage:
 *   npm run generate-api     # Generate API client
 *
 * Output:
 *   src/api/generated/       # Generated hooks and types
 *   src/api/generated/model/ # Generated TypeScript interfaces
 */
export default defineConfig({
  api: {
    input: {
      // Backend OpenAPI spec (requires backend to be running)
      target: "http://localhost:8000/openapi.json",
    },
    output: {
      // Output directory for generated files
      target: "./src/api/generated/endpoints.ts",
      schemas: "./src/api/generated/model",

      // Generate React Query hooks
      client: "react-query",

      // Use existing Axios instance
      override: {
        mutator: {
          path: "./src/lib/axios-instance.ts",
          name: "customInstance",
        },
      },

      // Split by OpenAPI tags (lists, videos, tags, etc.)
      mode: "tags-split",

      // Clean output directory before generating
      clean: true,

      // Generate barrel exports
      indexFiles: true,

      // Use baseUrl from axios instance (not hardcoded)
      baseUrl: "",
    },
  },
});
