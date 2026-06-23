## Summary

<!--
Describe what this PR does and why. Link any related issues.
Fixes #<issue_number>
-->

## Type of change

- [ ] Bug fix (`fix/*` → `main`)
- [ ] New feature (`feat/*` → `develop`)
- [ ] Refactor / cleanup
- [ ] Documentation only
- [ ] CI / tooling
- [ ] Release (`release/*` → `main`)

## What changed

<!--
A brief bullet list of what was added, modified, or removed.
- Added ...
- Changed ...
- Removed ...
-->

## How to test

<!--
Steps for reviewers to verify the change manually, if applicable.
1. Run `pnpm dev`
2. Navigate to ...
3. Verify ...
-->

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (add/update tests for new logic)
- [ ] `pnpm lint` and `pnpm format:check` pass
- [ ] New env vars added to `.env.example` and documented
- [ ] Schema changes are a new migration file; `pnpm db:types` re-run
- [ ] No secrets or real credentials committed
