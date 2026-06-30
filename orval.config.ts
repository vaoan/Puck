import { defineConfig } from "orval";

// wire when an OpenAPI source exists:
//   Set PUCK_OPENAPI_URL in .env.dev (or .env.local) to point at the live spec,
//   or drop specs/openapi.yaml for offline development.
//   Then run: pnpm codegen

const openApiTarget = process.env.PUCK_OPENAPI_URL ?? "specs/openapi.yaml";

/**
 * Orval configuration — REST API codegen template.
 *
 * Generates type-safe React Query hooks and TypeScript types from an OpenAPI spec.
 *
 * Usage (once wired):
 *   pnpm codegen        — generate all API clients
 *
 * @see https://orval.dev/reference/configuration/overview
 */
export default defineConfig({
  api: {
    input: {
      // OpenAPI spec: URL from PUCK_OPENAPI_URL env var or local file fallback.
      target: openApiTarget,
      validation: false,
    },
    output: {
      // Output mode: 'tags-split' creates one file per API tag.
      mode: "tags-split",
      // Generated hooks land in packages/api once that package exists.
      target: "./packages/api/src/rest/generated",
      schemas: "./packages/api/src/rest/types/generated",
      client: "react-query",
      httpClient: "axios",
      mock: false,
      clean: true,
      indexFiles: true,
      baseUrl: "",
      override: {
        // Swap in a custom fetch wrapper (auth, case-conversion, etc.) when ready.
        // mutator: {
        //   path: "./packages/api/src/rest/mutator/custom-fetch.ts",
        //   name: "customFetch",
        // },
        query: {
          useQuery: true,
          useMutation: true,
          useInfinite: false,
          useSuspenseQuery: true,
          useSuspenseInfiniteQuery: false,
          signal: true,
        },
        header: (info) => [
          "/**",
          " * AUTO-GENERATED FILE — DO NOT EDIT",
          " *",
          ` * Generated from: ${info.title} v${info.version}`,
          " *",
          " * @see https://orval.dev",
          " */",
          "",
        ],
      },
    },
    hooks: {
      afterAllFilesWrite:
        'prettier --write "packages/api/src/rest/**/*.{ts,tsx}"',
    },
  },
});
