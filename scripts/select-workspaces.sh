#!/usr/bin/env bash
# select-workspaces.sh — Map per-app change flags to pnpm filter targets.
# Usage: bash scripts/select-workspaces.sh WEB API WORKER BOT PACKAGES TOOLING
#
# Positional arguments (all optional, default false):
#   $1  WEB_CHANGED      — apps/web changed
#   $2  API_CHANGED      — apps/api changed
#   $3  WORKER_CHANGED   — apps/worker changed
#   $4  BOT_CHANGED      — apps/bot changed
#   $5  PACKAGES_CHANGED — packages/** changed
#   $6  TOOLING_CHANGED  — root tooling files changed
#
# Outputs (stdout, one per line):
#   RUN_ALL=true|false      — true when packages or tooling changed (all workspaces affected)
#   APPS=<space-list>       — pnpm --filter names for changed apps (empty when none)
#   LINT_TARGETS=<space-list> — src paths for scoped eslint runs (empty when none)

set -euo pipefail

WEB_CHANGED="${1:-false}"
API_CHANGED="${2:-false}"
WORKER_CHANGED="${3:-false}"
BOT_CHANGED="${4:-false}"
PACKAGES_CHANGED="${5:-false}"
TOOLING_CHANGED="${6:-false}"

RUN_ALL="false"
if [ "$PACKAGES_CHANGED" = "true" ] || [ "$TOOLING_CHANGED" = "true" ]; then
  RUN_ALL="true"
fi

APPS=""
LINT_TARGETS=""

# append_app <pnpm-filter-name> <src-path> [<app-dir>]
# Only adds the entry if the directory actually exists on disk — safe on empty workspace.
append_app() {
  local app_name="$1"
  local src_path="$2"
  local app_dir="${3:-apps/${app_name}}"

  if [ -d "${app_dir}" ]; then
    APPS="${APPS} ${app_name}"
  fi

  if [ -d "${src_path}" ]; then
    LINT_TARGETS="${LINT_TARGETS} ${src_path}"
  fi
}

if [ "$RUN_ALL" = "true" ]; then
  # Include every app that actually exists on disk (glob-driven, no hardcoding).
  if [ -d "apps" ]; then
    while IFS= read -r -d '' dir; do
      app_name="$(basename "$dir")"
      append_app "$app_name" "apps/${app_name}/src"
    done < <(find apps -maxdepth 1 -mindepth 1 -type d -print0 2>/dev/null || true)
  fi
else
  # Selective: only include apps whose change flag was passed as true.
  [ "$WEB_CHANGED"    = "true" ] && append_app "web"    "apps/web/src"
  [ "$API_CHANGED"    = "true" ] && append_app "api"    "apps/api/src"
  [ "$WORKER_CHANGED" = "true" ] && append_app "worker" "apps/worker/src"
  [ "$BOT_CHANGED"    = "true" ] && append_app "bot"    "apps/bot/src"
fi

# Trim leading/trailing whitespace
APPS="$(echo "$APPS" | xargs 2>/dev/null || echo "")"
LINT_TARGETS="$(echo "$LINT_TARGETS" | xargs 2>/dev/null || echo "")"

echo "RUN_ALL=$RUN_ALL"
echo "APPS=$APPS"
echo "LINT_TARGETS=$LINT_TARGETS"
