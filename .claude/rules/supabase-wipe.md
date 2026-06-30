# Supabase Full Wipe & Re-Migration Procedure

> **Use this when the user asks for a "full wipe" of Puck's Supabase dev or prod.**

---

## Safety Warning

> **Puck has its own Supabase project — separate from CandyStore's production DB.**
> Never use CandyStore credentials in Puck's `.env`/`.secrets`, and never point
> `SUPABASE_URL` at CandyStore's project. CandyStore is in production — never
> run anything against its database.

---

## Tokens and Projects

| Environment | Project ID               | PAT Variable                 | PAT Location |
| ----------- | ------------------------ | ---------------------------- | ------------ |
| Dev         | `<PUCK_DEV_PROJECT_ID>`  | `DEV_SUPABASE_ACCESS_TOKEN`  | `.secrets`   |
| Prod        | `<PUCK_PROD_PROJECT_ID>` | `PROD_SUPABASE_ACCESS_TOKEN` | `.secrets`   |

The PATs are Personal Access Tokens for the Supabase Management API. They are stored in `.secrets` under:

```
# ─── Supabase Management API (Personal Access Tokens) ───────────
DEV_SUPABASE_ACCESS_TOKEN=sbp_...
PROD_SUPABASE_ACCESS_TOKEN=sbp_...
```

> **Note:** Direct port 5432 (Postgres) connections are blocked on Supabase Cloud from outside AWS. All DB operations must go through the Management API REST endpoint.

---

## Step 1: Drop and Recreate the Public Schema

This wipes all tables, types, functions, policies, and triggers in the `public` schema.

```bash
TOKEN="<DEV_SUPABASE_ACCESS_TOKEN or PROD_SUPABASE_ACCESS_TOKEN>"
PROJECT="<PUCK_DEV_PROJECT_ID or PUCK_PROD_PROJECT_ID>"

DROP_SQL="DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO anon; GRANT ALL ON SCHEMA public TO authenticated; GRANT ALL ON SCHEMA public TO service_role;"

payload=$(python3 -c "import json; print(json.dumps({'query': '$DROP_SQL'}))")

curl -s -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT}/database/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload"
```

Expected response: `[]` with HTTP 201.

> **Note:** This does NOT delete auth users. The `auth` schema is managed by Supabase and not touched by this command. If you also need to delete auth users, use the Supabase REST API with the service role key to list and delete users via `DELETE /auth/v1/admin/users/{id}`.

---

## Step 2: Apply All Migrations

Run all migration files in order using the Management API:

```bash
TOKEN="<DEV_SUPABASE_ACCESS_TOKEN or PROD_SUPABASE_ACCESS_TOKEN>"
PROJECT="<PUCK_DEV_PROJECT_ID or PUCK_PROD_PROJECT_ID>"

run_migration() {
  local file="$1"
  local payload
  payload=$(python3 -c "import json,sys; print(json.dumps({'query':open(sys.argv[1]).read()}))" "$file")

  local tmpfile
  tmpfile=$(mktemp)
  local http_code
  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" -X POST \
    "https://api.supabase.com/v1/projects/${PROJECT}/database/query" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload")

  local body
  body=$(cat "$tmpfile")
  rm -f "$tmpfile"

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "OK [$http_code] $(basename $file)"
  else
    echo "FAIL [$http_code] $(basename $file)"
    echo "   $body"
  fi
}

for f in supabase/migrations/*.sql; do
  run_migration "$f"
done
```

All files in `supabase/migrations/` should return OK.

---

## Known Issues and Fixes

### `audit.logged_actions` already exists (42P07)

Supabase Cloud provides a built-in `audit` schema with `logged_actions`. Audit migrations should use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` so they are idempotent.

### Table filter for data-only wipe

If you only need to wipe data (not schema), use these filters per table type:

- Tables with UUID primary keys: `?created_at=gte.2000-01-01`
- Tables without `created_at`: query on another indexed column

---

## Auth Users Wipe (if needed)

```bash
SERVICE_KEY="<DEV_SUPABASE_SERVICE_ROLE_KEY or PROD_SUPABASE_SERVICE_ROLE_KEY>"
SUPABASE_URL="<DEV_SUPABASE_URL or PROD_SUPABASE_URL>"

# List all users
users=$(curl -s "${SUPABASE_URL}/auth/v1/admin/users?per_page=1000" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}")

# Delete each user
echo "$users" | python3 -c "
import json, sys, subprocess
data = json.load(sys.stdin)
users = data.get('users', [])
for u in users:
    uid = u['id']
    subprocess.run(['curl', '-s', '-X', 'DELETE',
        '${SUPABASE_URL}/auth/v1/admin/users/' + uid,
        '-H', 'apikey: ${SERVICE_KEY}',
        '-H', 'Authorization: Bearer ${SERVICE_KEY}'])
    print(f'Deleted: {uid}')
"
```

---

## Verify Schema After Migration

```bash
TOKEN="<token>"
PROJECT="<project_id>"

CHECK_SQL="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
payload=$(python3 -c "import json,sys; print(json.dumps({'query': sys.argv[1]}))" "$CHECK_SQL")

curl -s -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT}/database/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload"
```

Expected tables after foundation migration: `events`, `sessions`, `occurrences`, `subscriptions`, `notifications`, `user_profiles`, `permissions`.
(Exact list grows as sub-projects are built — update this section after each migration batch.)

---

## Related

- `.secrets` — PATs and service role keys
- `supabase/migrations/` — All migration files
- [Git Safety](.claude/rules/git-safety.md) — Never commit secrets
