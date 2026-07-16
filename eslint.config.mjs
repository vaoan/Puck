// @ts-check
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import tsParser from "@typescript-eslint/parser";
import i18next from "eslint-plugin-i18next";
import jsa11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import security from "eslint-plugin-security";
import boundaries from "eslint-plugin-boundaries";
import sonarjs from "eslint-plugin-sonarjs";
import testingLibrary from "eslint-plugin-testing-library";
import vitest from "@vitest/eslint-plugin";
import tanstackQuery from "@tanstack/eslint-plugin-query";
import unicorn from "eslint-plugin-unicorn";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";

// Monorepo paths
const APP_SRC = "apps/*/src";
const PKG_SRC = "packages/*/src";

const sonarRules = sonarjs.configs.recommended.rules;
const unicornRules = unicorn.configs["flat/recommended"].rules;

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  i18next.configs["flat/recommended"],
  ...tanstackQuery.configs["flat/recommended"].map((config) => ({
    ...config,
    files: [
      `${APP_SRC}/**/*.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.{ts,tsx,js,jsx}`,
    ],
  })),
  // Generic ignores — valid with zero workspaces.
  globalIgnores([
    "**/dist/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/coverage/**",
    "**/node_modules/**",
    "**/*.config.{js,mjs,ts,cjs}",
    "**/next-env.d.ts",
    "**/generated/**",
    "**/*.generated.ts",
    "**/database.types.ts",
    ".claude/**",
    "**/public/mockServiceWorker.js",
  ]),
  // Accessibility (jsx-a11y) — WCAG AA compliance
  {
    files: [`${APP_SRC}/**/*.{tsx,jsx}`, `${PKG_SRC}/**/*.{tsx,jsx}`],
    plugins: { "jsx-a11y": jsa11y },
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
    },
  },
  // E2E Tests - Playwright specific rules
  // Prevent testing specific translation text - only test element existence
  // See: Translation-agnostic E2E tests principle
  {
    files: ["**/e2e/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
          message:
            "Use getByTestId instead of getByRole in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
          message:
            "Use getByTestId instead of role-based queries in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
          message:
            "Use getByTestId instead of getByText in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
          message:
            "Use getByTestId instead of text-based queries in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]",
          message:
            "Use getByTestId instead of label-based selectors in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByLabel|getByLabelText|getAllByLabel|getAllByLabelText|queryByLabel|queryByLabelText|queryAllByLabel|queryAllByLabelText|findByLabel|findByLabelText|findAllByLabel|findAllByLabelText)$/]",
          message:
            "Use getByTestId instead of label-based selectors in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]",
          message:
            "Use getByTestId instead of placeholder-based selectors in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByPlaceholder|getByPlaceholderText|getAllByPlaceholder|getAllByPlaceholderText|queryByPlaceholder|queryByPlaceholderText|queryAllByPlaceholder|queryAllByPlaceholderText|findByPlaceholder|findByPlaceholderText|findAllByPlaceholder|findAllByPlaceholderText)$/]",
          message:
            "Use getByTestId instead of placeholder-based selectors in E2E tests. Add {...tid('element-name')} to your component.",
        },
        {
          selector: "CallExpression[callee.property.name='toContainText']",
          message:
            "Don't assert specific translation text in E2E tests. Use toBeVisible() or not.toBeEmpty() instead to keep tests translation-agnostic.",
        },
        {
          selector: "CallExpression[callee.property.name='toHaveText']",
          message:
            "Don't assert specific translation text in E2E tests. Use toBeVisible() or not.toBeEmpty() instead to keep tests translation-agnostic.",
        },
        {
          selector:
            "CallExpression[callee.property.name='locator'] Literal[value=/data-testid/]",
          message:
            "Use page.getByTestId('id') instead of page.locator('[data-testid=\"id\"]'). getByTestId is cleaner and more maintainable.",
        },
      ],
    },
  },
  // Enforce one React component per file
  {
    files: [`${APP_SRC}/**/*.tsx`, `${PKG_SRC}/**/*.tsx`],
    ignores: [
      "**/shared/presentation/components/ui/**",
      "packages/ui/src/**",
      "**/*.test.tsx",
      "**/*.spec.tsx",
    ],
    rules: {
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
    },
  },
  // Testing rules for Vitest + Testing Library (unit tests only)
  {
    files: [
      `${APP_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${APP_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
    ],
    ignores: [
      `${APP_SRC}/**/components/ui/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/components/ui/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/components/*.test.{ts,tsx,js,jsx}`,
    ],
    ...testingLibrary.configs["flat/react"],
    rules: {
      ...testingLibrary.configs["flat/react"].rules,
      "testing-library/no-container": "off",
      "testing-library/prefer-screen-queries": "off",
      "testing-library/render-result-naming-convention": "off",
      // Enforce getByTestId only - prefer test IDs for stability
      // See: data-testid enforcement policy
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
          message:
            "Use getByTestId instead of getByRole. Test IDs are more stable across UI changes. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByRole|getAllByRole|queryByRole|queryAllByRole|findByRole|findAllByRole)$/]",
          message:
            "Use getByTestId instead of role-based queries. Test IDs are more stable across UI changes. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
          message:
            "Use getByTestId instead of getByText. Test IDs are more stable across text/i18n changes. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByText|getAllByText|queryByText|queryAllByText|findByText|findAllByText)$/]",
          message:
            "Use getByTestId instead of text-based queries. Test IDs are more stable across text/i18n changes. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByLabelText|getAllByLabelText|queryByLabelText|queryAllByLabelText|findByLabelText|findAllByLabelText)$/]",
          message:
            "Use getByTestId instead of getByLabelText. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByLabelText|getAllByLabelText|queryByLabelText|queryAllByLabelText|findByLabelText|findAllByLabelText)$/]",
          message:
            "Use getByTestId instead of label-based queries. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByPlaceholderText|getAllByPlaceholderText|queryByPlaceholderText|queryAllByPlaceholderText|findByPlaceholderText|findAllByPlaceholderText)$/]",
          message:
            "Use getByTestId instead of getByPlaceholderText. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByPlaceholderText|getAllByPlaceholderText|queryByPlaceholderText|queryAllByPlaceholderText|findByPlaceholderText|findAllByPlaceholderText)$/]",
          message:
            "Use getByTestId instead of placeholder-based queries. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByAltText|getAllByAltText|queryByAltText|queryAllByAltText|findByAltText|findAllByAltText)$/]",
          message:
            "Use getByTestId instead of getByAltText. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByAltText|getAllByAltText|queryByAltText|queryAllByAltText|findByAltText|findAllByAltText)$/]",
          message:
            "Use getByTestId instead of alt-text queries. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByTitle|getAllByTitle|queryByTitle|queryAllByTitle|findByTitle|findAllByTitle)$/]",
          message:
            "Use getByTestId instead of getByTitle. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByTitle|getAllByTitle|queryByTitle|queryAllByTitle|findByTitle|findAllByTitle)$/]",
          message:
            "Use getByTestId instead of title-based queries. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getByDisplayValue|getAllByDisplayValue|queryByDisplayValue|queryAllByDisplayValue|findByDisplayValue|findAllByDisplayValue)$/]",
          message:
            "Use getByTestId instead of getByDisplayValue. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
        {
          selector:
            "CallExpression[callee.name=/^(getByDisplayValue|getAllByDisplayValue|queryByDisplayValue|queryAllByDisplayValue|findByDisplayValue|findAllByDisplayValue)$/]",
          message:
            "Use getByTestId instead of display-value queries. Test IDs are more stable. Add {...tid('element-name')} to your component.",
        },
      ],
    },
  },
  // Enforce stable negative assertions with test IDs (no queryByText in unit tests)
  {
    files: [
      `${APP_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${APP_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
    ],
    ignores: [
      `${APP_SRC}/**/components/ui/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/components/ui/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/components/*.test.{ts,tsx,js,jsx}`,
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='queryByText']",
          message:
            "Use queryByTestId (or role-based test id wrappers) instead of queryByText to avoid text/i18n-coupled assertions.",
        },
        {
          selector: "CallExpression[callee.name='queryByText']",
          message:
            "Use queryByTestId (or role-based test id wrappers) instead of queryByText to avoid text/i18n-coupled assertions.",
        },
      ],
    },
  },
  {
    files: [
      `${APP_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${APP_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
    ],
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,
      // Prevent skipped/disabled tests from being committed
      "vitest/no-disabled-tests": "error",
      // Prevent focused tests from being committed (would skip other tests in CI)
      "vitest/no-focused-tests": "error",
    },
  },
  {
    files: [
      `${APP_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${APP_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
    ],
    ...vitest.configs.env,
  },
  // General JS/TS linting enhancements
  {
    files: [
      `${APP_SRC}/**/*.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.{ts,tsx,js,jsx}`,
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
      import: importPlugin,
      security,
      boundaries,
      sonarjs,
      unicorn,
    },
    rules: {
      ...sonarRules,
      ...unicornRules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // Introduced by newer plugin versions and currently too noisy for existing code;
      // keep runtime/toolchain upgrades decoupled from broad behavioral refactors.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "@tanstack/query/exhaustive-deps": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "import/no-duplicates": "error",
      "import/order": [
        "error",
        {
          "newlines-between": "always",
          pathGroups: [
            {
              pattern: "@/**",
              group: "internal",
              position: "after",
            },
            {
              pattern: "@puck/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // --- Security ---
      // Catches dangerouslySetInnerHTML usage (XSS risk)
      "react/no-danger": "error",

      // Catches non-null assertions (user!.name) which mask potential null bugs
      "@typescript-eslint/no-non-null-assertion": "error",

      // Enforce `import type` for type-only imports (smaller bundles, clearer intent)
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // --- Naming Conventions ---
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["PascalCase", "UPPER_CASE"],
        },
        {
          selector: "property",
          format: ["camelCase", "UPPER_CASE", "PascalCase", "snake_case"],
          leadingUnderscore: "allow",
        },
        {
          selector: "property",
          modifiers: ["requiresQuotes"],
          format: null,
        },
        {
          selector: "property",
          filter: { regex: "^__html$", match: true },
          format: null,
        },
        {
          selector: "variable",
          modifiers: ["destructured"],
          format: ["camelCase", "UPPER_CASE", "PascalCase", "snake_case"],
        },
        {
          selector: "classicAccessor",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
        {
          selector: "import",
          format: null,
        },
      ],

      // --- Performance ---
      "react/jsx-no-constructed-context-values": "error",
      "react/no-unstable-nested-components": "error",

      // --- Bug Prevention ---
      "react/button-has-type": "error",
      "react/no-array-index-key": "error",

      "no-restricted-properties": [
        "error",
        {
          object: "document",
          property: "querySelector",
          message:
            "Avoid document.querySelector — use React refs or Radix UI primitives.",
        },
        {
          object: "document",
          property: "querySelectorAll",
          message:
            "Avoid document.querySelectorAll — use React refs or Radix UI primitives.",
        },
      ],

      "no-console": ["error", { allow: ["warn", "error"] }],

      "security/detect-object-injection": "off",
      "unicorn/prefer-query-selector": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-array-sort": "off",
      "unicorn/no-await-expression-member": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/prefer-single-call": "off",

      // ==========================================
      // STRICT SONARJS RULES
      // Enforces SOLID, DRY, KISS principles
      // ==========================================

      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/cyclomatic-complexity": ["error", { threshold: 15 }],
      "sonarjs/max-lines-per-function": ["error", { maximum: 100 }],
      "sonarjs/max-lines": ["error", { maximum: 400 }],
      "sonarjs/nested-control-flow": ["error", { maximumNestingLevel: 4 }],
      "sonarjs/no-nested-conditional": "error",
      "sonarjs/expression-complexity": ["error", { max: 4 }],
      "sonarjs/no-duplicate-string": [
        "error",
        {
          threshold: 2,
          ignoreStrings:
            "var\\(--[a-zA-Z0-9-]+\\)|text-[a-z-]+|bg-[a-z-]+|common\\.[a-zA-Z]+",
        },
      ],
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      "sonarjs/no-identical-functions": ["error", 3],
      "sonarjs/no-collapsible-if": "error",
      "sonarjs/prefer-immediate-return": "error",
      "sonarjs/no-nested-switch": "error",
      "sonarjs/strings-comparison": "error",
      "sonarjs/todo-tag": "warn",
      "sonarjs/fixme-tag": "warn",
      "boundaries/no-unknown": "error",
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: { type: "shared" },
              allow: { to: { type: ["shared"] } },
            },
            {
              from: { type: "shared-layouts" },
              allow: { to: { type: ["shared", "feature"] } },
            },
            {
              from: { type: "feature" },
              allow: { to: { type: ["shared", "feature", "mocks"] } },
            },
            {
              from: { type: "app" },
              allow: { to: { type: ["shared", "shared-layouts", "feature"] } },
            },
            {
              from: { type: "test" },
              allow: { to: { type: ["shared", "feature", "app", "test"] } },
            },
            {
              from: { type: "mocks" },
              allow: {
                to: { type: ["shared", "feature", "app", "test", "mocks"] },
              },
            },
            {
              from: { type: "root" },
              allow: { to: { type: ["shared", "feature", "app", "mocks"] } },
            },
          ],
        },
      ],
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
      },
      "boundaries/elements": [
        {
          type: "shared-layouts",
          pattern: [
            "apps/*/src/shared/presentation/layouts/**",
            "packages/*/src/presentation/layouts/**",
          ],
        },
        {
          type: "shared",
          pattern: ["apps/*/src/shared/**", "packages/*/src/**"],
        },
        { type: "feature", pattern: "apps/*/src/features/**" },
        { type: "app", pattern: "apps/*/src/app/**" },
        { type: "test", pattern: "apps/*/src/test/**" },
        { type: "mocks", pattern: "apps/*/src/mocks/**" },
        { type: "root", pattern: "apps/*/src/proxy.ts", mode: "file" },
      ],
    },
  },
  // Unicorn overrides for existing code patterns
  {
    rules: {
      "unicorn/filename-case": "off",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/prefer-top-level-await": "off",
      "unicorn/prefer-module": "off",
    },
  },
  // Boundaries: relax rules for unit tests and test utilities
  {
    files: [
      `${APP_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${APP_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
      `${APP_SRC}/test/**/*.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.test.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.spec.{ts,tsx,js,jsx}`,
    ],
    rules: {
      "boundaries/dependencies": "off",
      "boundaries/no-unknown": "off",
      "boundaries/no-unknown-files": "off",
      "sonarjs/assertions-in-tests": "off",
      "sonarjs/pseudo-random": "off",
      "sonarjs/max-lines": "off",
      "sonarjs/max-lines-per-function": "off",
      "sonarjs/no-duplicate-string": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/naming-convention": "off",
      "no-console": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/cyclomatic-complexity": "off",
    },
  },
  {
    files: [`${APP_SRC}/mocks/**/*.{ts,tsx,js,jsx}`],
    rules: {
      "sonarjs/pseudo-random": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/max-lines": "off",
      "sonarjs/cognitive-complexity": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/naming-convention": "off",
      "no-console": "off",
    },
  },
  // Constants files define magic numbers and semantic strings
  {
    files: [
      `${APP_SRC}/**/constants/*.ts`,
      `${APP_SRC}/**/constants.ts`,
      `${APP_SRC}/**/domain/constants.ts`,
      `${APP_SRC}/**/theme/constants.ts`,
      `${PKG_SRC}/**/constants/*.ts`,
      `${PKG_SRC}/**/constants.ts`,
    ],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },
  // UI package components have standard default prop values (shadcn/ui patterns)
  {
    files: [
      `${PKG_SRC}/components/**/*.tsx`,
      `${APP_SRC}/**/components/ui/**/*.tsx`,
    ],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },
  // Strict i18n: Disallow ALL hardcoded user-facing strings
  {
    files: [`${APP_SRC}/**/*.{ts,tsx,js,jsx}`],
    ignores: ["**/*.test.*", "**/*.spec.*", "**/test/**", "**/mocks/**"],
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "all",
          "should-validate-template": true,
          "jsx-attributes": {
            include: [
              "alt",
              "aria-description",
              "aria-label",
              "aria-labelledby",
              "aria-valuetext",
              "label",
              "placeholder",
              "title",
            ],
          },
          ignoreAttribute: [
            "className",
            "class",
            "id",
            "name",
            "type",
            "href",
            "src",
            "srcSet",
            "data-testid",
            "data-state",
            "data-collapsed",
            "data-side",
            "data-align",
            "role",
            "htmlFor",
            "target",
            "rel",
            "method",
            "action",
            "encType",
            "autoComplete",
            "inputMode",
            "pattern",
            "accept",
            "xmlns",
            "viewBox",
            "fill",
            "stroke",
            "strokeWidth",
            "strokeLinecap",
            "strokeLinejoin",
            "d",
            "cx",
            "cy",
            "r",
            "x",
            "y",
            "x1",
            "x2",
            "y1",
            "y2",
            "width",
            "height",
            "transform",
            "clipPath",
            "clipRule",
            "fillRule",
            "variant",
            "size",
            "align",
            "side",
            "orientation",
            "direction",
            "position",
            "layout",
            "mode",
            "theme",
            "color",
            "severity",
            "status",
            "priority",
            "asChild",
            "sideOffset",
            "alignOffset",
            "collisionPadding",
            "locale",
            "prefetch",
            "scroll",
            "shallow",
            "replace",
            "passHref",
            "legacyBehavior",
            "defaultValue",
            "defaultChecked",
            "dataKey",
            "tickFormatter",
            "domain",
            "ticks",
            "tickLine",
            "axisLine",
            "strokeDasharray",
            "animationDuration",
            "animationEasing",
            "connectNulls",
            "dot",
            "activeDot",
            "legendType",
            "stackId",
            "initial",
            "animate",
            "exit",
            "transition",
            "whileHover",
            "whileTap",
            "whileFocus",
            "whileInView",
            "tid",
          ],
          words: {
            exclude: [
              /^"?use (client|server)"?$/,
              /^[0-9]+(%|px|em|rem|vh|vw|ch|ex|cm|mm|in|pt|pc|deg|rad|grad|turn|s|ms)?$/,
              /^[0-9]+\.?[0-9]*$/,
              /^#[0-9a-fA-F]{3,8}$/,
              /^(rgb|rgba|hsl|hsla|oklch)\(.+\)$/,
              /^var\(--[a-zA-Z0-9-]+\)$/,
              /^var\(--[a-zA-Z0-9-]+,\s*var\(--[a-zA-Z0-9-]+\)\)$/,
              /^--[a-zA-Z0-9-]+$/,
              /^[a-z][a-z0-9-/:[\]()_]*$/,
              /^[a-z][a-z0-9-/:[\]()_\s]*$/,
              /^(https?:\/\/|\/|\.\/|\.\.\/)/,
              /^(NEXT_PUBLIC_|NODE_ENV)/,
              /^[A-Z][A-Z0-9_]+$/,
              /^[a-z]+[A-Z][a-zA-Z]+$/,
              /^[a-z]+\.[a-z]+/,
              /^--font-[a-z-]+$/,
              /^variable:\s*"--[a-z-]+"$/,
              /^.?$/,
              /^[YMDHhmsaAzZ\-\/\.\:\s]+$/,
              /^(2-digit|numeric|long|short|narrow)$/,
              /^[a-z]{2}(-[A-Z]{2})?$/,
              /^key:\s*"[a-zA-Z]+"$/,
              /^(sans-serif|serif|monospace|cursive|fantasy|system-ui)$/,
              /^\(prefers-[a-z-]+:\s*[a-z]+\)$/,
              /^\.(json|csv|xlsx?|pdf|txt|md)$/,
              /^\\uFEFF$/,
              /^""$/,
              /^[+-]?[0-9]+%$/,
              /^\([0-9.]+%\)$/,
              /Stage$/,
              /^Point\s+\d+$/,
              /^(text|application|image|audio|video)\/[a-zA-Z0-9.+-]+;?.*$/,
              /^[MLCZHVSQTAmlczhvsqta0-9,.\s-]+$/,
              /^\[.+\]\s*\[.+\]/,
              /\[REDACTED\]/,
              /\[truncated\]/,
              /\[params-redacted\]/,
            ],
          },
          callees: {
            exclude: [
              /^t$/,
              /^t[A-Z]/,
              "useTranslations",
              "getTranslations",
              "tid",
              "console.log",
              "console.warn",
              "console.error",
              "console.info",
              "console.debug",
              /^logger\./,
              "Error",
              "TypeError",
              "RangeError",
              "throw",
              "require",
              "import",
              "document.getElementById",
              "document.querySelector",
              "document.querySelectorAll",
              "localStorage.getItem",
              "localStorage.setItem",
              "sessionStorage.getItem",
              "sessionStorage.setItem",
              "JSON.parse",
              "JSON.stringify",
              "Object.keys",
              "Object.values",
              "Object.entries",
              "Array.from",
              "Set",
              "Map",
              "URLSearchParams",
              "encodeURIComponent",
              "decodeURIComponent",
              "replaceAll",
              "replace",
              "split",
              "join",
              "match",
              "matchAll",
              "startsWith",
              "endsWith",
              "includes",
              "padStart",
              "padEnd",
              "matchMedia",
              "globalThis.matchMedia",
              "window.matchMedia",
              "router.push",
              "router.replace",
              "router.prefetch",
              "useRouter",
              "usePathname",
              "useSearchParams",
              "redirect",
              "getStaticProps",
              "getServerSideProps",
              "generateStaticParams",
              "generateMetadata",
              "cookies",
              "headers",
              "useRecommendationSelection",
              "useState",
              "useQuery",
              "useMutation",
              "queryClient.invalidateQueries",
              "queryClient.setQueryData",
              "cn",
              "clsx",
              "cva",
              "twMerge",
              "toLocaleString",
              "toLocaleDateString",
              "toLocaleTimeString",
              "Intl.DateTimeFormat",
              "Intl.NumberFormat",
              "Intl.RelativeTimeFormat",
              "describe",
              "it",
              "test",
              "expect",
              "vi.mock",
              "vi.fn",
              "vi.spyOn",
              "beforeEach",
              "afterEach",
              "beforeAll",
              "afterAll",
            ],
          },
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx,js,jsx}", "**/*.spec.{ts,tsx,js,jsx}"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  // Tailwind CSS quality — catch deprecated, duplicate, and conflicting classes
  // All sub-rules disabled until an app with globals.css exists.
  {
    ...betterTailwindcss.configs["recommended"],
    files: [
      `${APP_SRC}/**/*.{ts,tsx,js,jsx}`,
      `${PKG_SRC}/**/*.{ts,tsx,js,jsx}`,
    ],
    rules: {
      ...betterTailwindcss.configs["recommended"].rules,
      "better-tailwindcss/no-deprecated-classes": "off",
      "better-tailwindcss/enforce-canonical-classes": "off",
      "better-tailwindcss/no-duplicate-classes": "off",
      "better-tailwindcss/no-conflicting-classes": "off",
      "better-tailwindcss/no-unnecessary-whitespace": "off",
      "better-tailwindcss/no-unknown-classes": "off",
      "better-tailwindcss/enforce-consistent-class-order": "off",
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
    },
  },
  // Node.js scripts and docker helpers — grant Node globals (process, __dirname, etc.)
  {
    files: ["scripts/**/*.{js,mjs,cjs}", "docker/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Avoid deep relative imports
  {
    files: [`${APP_SRC}/**/*.{ts,tsx}`, `${PKG_SRC}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../../*"],
              message:
                "Avoid deep relative imports. Use absolute imports with @/ alias.",
            },
          ],
        },
      ],
    },
  },
  // Enforce tid() utility for test IDs in apps and packages (stripped in production)
  {
    files: [`${APP_SRC}/**/*.{ts,tsx}`, "packages/*/src/**/*.{ts,tsx}"],
    ignores: [
      `${APP_SRC}/**/*.test.{ts,tsx}`,
      `${APP_SRC}/**/*.spec.{ts,tsx}`,
      "packages/*/src/**/*.test.{ts,tsx}",
      "packages/*/src/**/*.spec.{ts,tsx}",
      `${APP_SRC}/**/infrastructure/config/**`,
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='data-testid']",
          message:
            "Use the tid() utility from '@/shared/infrastructure/config/tid' instead of data-testid literals so test IDs are stripped in production.",
        },
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env']",
          message:
            "Access process.env only from centralized config files. Import runtimeEnv from your app's environment config instead.",
        },
      ],
    },
  },
  prettier,
]);

export default eslintConfig;
