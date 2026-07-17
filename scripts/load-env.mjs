/**
 * Minimal env loader with $secret: resolution.
 *
 * Loads .env.{TARGET_ENV} (default: dev) and resolves $secret:KEY references
 * against a flat .secrets file (locally) or process.env (CI).
 *
 * Usage (from other scripts):
 *   import { resolveEnv } from './load-env.mjs';
 *   // pure — no I/O; pass raw text and a secrets map, get resolved vars back
 *
 * CLI usage (run directly):
 *   node scripts/load-env.mjs [dev|staging|prod|...]
 *   Writes resolved vars into process.env and prints export lines to stdout.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Parse KEY=VALUE text, skipping blank lines and # comments. */
function parseEnvText(text) {
  /** @type {Record<string, string>} */
  const vars = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    vars[key] = val;
  }

  return vars;
}

const SECRET_RE = /\$secret:([A-Z][A-Z0-9_]*)/g;

/**
 * Pure resolver: substitutes every whole-value `$secret:NAME` token with the
 * matching entry from `secrets`. Throws if a referenced secret is absent.
 *
 * @param {string} envText   Raw contents of an env file (KEY=VALUE lines).
 * @param {Record<string, string>} secrets  Map of secret names → values.
 * @returns {Record<string, string>} Resolved env vars.
 */
export function resolveEnv(envText, secrets) {
  const vars = parseEnvText(envText);
  for (const [key, val] of Object.entries(vars)) {
    if (!val.includes("$secret:")) continue;
    vars[key] = val.replace(SECRET_RE, (_, name) => {
      if (!(name in secrets)) throw new Error(`Missing secret: ${name}`);
      return secrets[name];
    });
  }

  return vars;
}

/**
 * Build the secret map for resolving an env file's `$secret:` references.
 * In CI (`CI=true`), secrets already live in `process.env`, so referenced
 * names are collected from there (absent ones resolve to `""`). Locally, they
 * come from the flat `.secrets` file, or `{}` if it is absent.
 *
 * @param {string} envText   Raw env-file text (used to discover referenced names in CI).
 * @param {string} rootDir   Repo root, where `.secrets` is looked up.
 * @returns {Record<string, string>} Secret name → value map for `resolveEnv`.
 */
export function collectSecrets(envText, rootDir) {
  if (process.env.CI === "true") {
    /** @type {Record<string, string>} */
    const secrets = {};
    for (const [, name] of envText.matchAll(SECRET_RE)) {
      secrets[name] = process.env[name] ?? "";
    }
    return secrets;
  }
  const secretsPath = resolve(rootDir, ".secrets");
  return existsSync(secretsPath)
    ? parseEnvText(readFileSync(secretsPath, "utf-8"))
    : {};
}

/**
 * Load `.env.<env>` into `process.env`, resolving `$secret:` references
 * CI-awarely (see {@link collectSecrets}). Existing `process.env` values win.
 *
 * @param {string} env      Env name (e.g. "dev", "ci") → `.env.<env>`.
 * @param {string} rootDir  Repo root.
 * @returns {Record<string, string>} The resolved vars.
 */
export function loadEnvFile(env, rootDir) {
  const envPath = resolve(rootDir, `.env.${env}`);
  if (!existsSync(envPath)) {
    throw new Error(`Env file not found: .env.${env}`);
  }
  const envText = readFileSync(envPath, "utf-8");
  const resolved = resolveEnv(envText, collectSecrets(envText, rootDir));
  for (const [key, val] of Object.entries(resolved)) {
    if (!(key in process.env)) process.env[key] = val;
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// CLI entry point — guarded so importing this module for tests is side-effect-free
// ---------------------------------------------------------------------------

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`;

if (isMain) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = resolve(__dirname, "..");

  const ALLOWED_ENVS = [
    "dev",
    "staging",
    "e2e",
    "prod",
    "production",
    "test",
    "ci",
  ];

  /** @param {string} env */
  function envFileName(env) {
    switch (env) {
      case "dev":
        return ".env.dev";
      case "staging":
        return ".env.staging";
      case "e2e":
        return ".env.e2e";
      case "prod":
        return ".env.prod";
      case "production":
        return ".env.production";
      case "test":
        return ".env.test";
      case "ci":
        return ".env.ci";
      default:
        return null;
    }
  }

  const targetEnv = process.argv[2] ?? process.env.TARGET_ENV ?? "dev";

  if (!ALLOWED_ENVS.includes(targetEnv)) {
    process.stderr.write(
      `[load-env] Invalid environment: "${targetEnv}". Allowed: ${ALLOWED_ENVS.join(", ")}\n`,
    );
    process.exit(1);
  }

  const filename = envFileName(targetEnv);
  const envPath = filename ? resolve(rootDir, filename) : null;

  if (!envPath || !existsSync(envPath)) {
    process.stderr.write(`[load-env] Env file not found: .env.${targetEnv}\n`);
    process.exit(1);
  }

  const envText = readFileSync(envPath, "utf-8");

  const resolved = resolveEnv(envText, collectSecrets(envText, rootDir));

  for (const [key, val] of Object.entries(resolved)) {
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }

  process.env.TARGET_ENV = targetEnv;

  // Print export lines so callers can eval the output if needed
  for (const [key, val] of Object.entries(resolved)) {
    process.stdout.write(`export ${key}=${val}\n`);
  }
}
