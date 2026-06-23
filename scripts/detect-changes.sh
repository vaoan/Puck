#!/usr/bin/env bash
# detect-changes.sh — Emit change flags for all apps/* and packages/* in this repo.
# Usage: bash scripts/detect-changes.sh [BASE_REF [HEAD_REF]]
#
# Outputs (stdout, one per line):
#   DEPLOY_CHANGED=true|false   — Dockerfile / docker/ / .dockerignore changed
#   PACKAGES_CHANGED=true|false — packages/** changed
#   TOOLING_CHANGED=true|false  — root package.json, lockfile, tsconfig, eslint, prettier changed
#   CODE_CHANGED=true|false     — any .ts/.tsx/.js/.jsx file changed
#   DOCS_ONLY=true|false        — no code/tooling/deploy changes (docs/config only)
#   APP_<NAME>=true|false       — one flag per discovered app in apps/*

set -euo pipefail

BASE_REF="${1:-origin/develop}"
HEAD_REF="${2:-HEAD}"

if ! git rev-parse --verify "$BASE_REF" > /dev/null 2>&1; then
  BASE_REF="@{upstream}"
fi

BASE_SHA="$(git merge-base "$HEAD_REF" "$BASE_REF" 2>/dev/null || true)"

if [ -n "$BASE_SHA" ]; then
  CHANGED_FILES="$(git diff --name-only "${BASE_SHA}..${HEAD_REF}" || true)"
else
  CHANGED_FILES="$(git diff --name-only "${BASE_REF}..${HEAD_REF}" 2>/dev/null || true)"
fi

is_changed() {
  local pattern="$1"
  echo "$CHANGED_FILES" | grep -Eq "$pattern" 2>/dev/null || return 1
}

DEPLOY_CHANGED=false
PACKAGES_CHANGED=false
TOOLING_CHANGED=false
CODE_CHANGED=false

is_changed '^(Dockerfile|docker/|\.dockerignore)' && DEPLOY_CHANGED=true
is_changed '^packages/'                            && PACKAGES_CHANGED=true
is_changed '^(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|eslint\.config\..*|prettier\.config\..*)' && TOOLING_CHANGED=true
is_changed '\.(ts|tsx|js|jsx|mjs|cjs)$'           && CODE_CHANGED=true

echo "DEPLOY_CHANGED=$DEPLOY_CHANGED"
echo "PACKAGES_CHANGED=$PACKAGES_CHANGED"
echo "TOOLING_CHANGED=$TOOLING_CHANGED"
echo "CODE_CHANGED=$CODE_CHANGED"

# Emit APP_<NAME>=true|false for each app directory that currently exists.
# On an empty workspace this loop simply produces no output lines — safe.
DOCS_ONLY=true
if [ "$DEPLOY_CHANGED" = true ] || [ "$PACKAGES_CHANGED" = true ] || [ "$TOOLING_CHANGED" = true ]; then
  DOCS_ONLY=false
fi

# Glob apps/* — nullglob-safe: the shopt is applied in a subshell to avoid
# leaking into the caller's shell session.
APP_DIRS=()
if [ -d "apps" ]; then
  while IFS= read -r -d '' dir; do
    APP_DIRS+=("$dir")
  done < <(find apps -maxdepth 1 -mindepth 1 -type d -print0 2>/dev/null || true)
fi

for app_dir in "${APP_DIRS[@]+"${APP_DIRS[@]}"}"; do
  app_name="$(basename "$app_dir")"
  # Convert hyphens to underscores for valid env-var-style names
  var_name="APP_$(echo "$app_name" | tr '[:lower:]-' '[:upper:]_')"
  app_changed=false
  is_changed "^apps/${app_name}/" && app_changed=true
  if [ "$app_changed" = true ]; then
    DOCS_ONLY=false
  fi
  echo "${var_name}=${app_changed}"
done

echo "DOCS_ONLY=$DOCS_ONLY"
