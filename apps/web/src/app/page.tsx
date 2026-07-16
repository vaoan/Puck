import { redirect } from "next/navigation";

import { routing } from "@/shared/infrastructure/i18n";

// The bare root (no locale) sends users to the default-locale entry, which then
// resolves to /account or /login. Mirrors CandyStore's app/page.tsx.
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
