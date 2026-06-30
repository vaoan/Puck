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

  /** @type {Record<string, string>} */
  let secrets = {};
  const secretsPath = resolve(rootDir, ".secrets");

  if (process.env.CI === "true") {
    // CI: real secrets already in process.env — collect them from there
    const needed = [...envText.matchAll(SECRET_RE)].map((m) => m[1]);
    for (const name of needed) {
      secrets[name] = process.env[name] ?? "";
    }
  } else if (existsSync(secretsPath)) {
    secrets = parseEnvText(readFileSync(secretsPath, "utf-8"));
  } else {
    process.stderr.write(
      "[load-env] Warning: .secrets file not found. Secret references may fail.\n",
    );
  }

  const resolved = resolveEnv(envText, secrets);

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
