import { execSync } from "node:child_process";

export default function setup(): void {
  const json = execSync("supabase status -o json", { encoding: "utf8" });
  const s = JSON.parse(json) as Record<string, string>;
  process.env.SUPABASE_URL = s.API_URL;
  process.env.SUPABASE_ANON_KEY = s.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = s.SERVICE_ROLE_KEY;
}
