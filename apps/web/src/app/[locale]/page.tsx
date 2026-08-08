import { redirect } from "@/shared/infrastructure/i18n";

// Interim landing: the home route sends users into the app at /account.
// It becomes the real authoring dashboard (events list) in a later slice —
// mirroring Libra admin's Dashboard-at-root. Unauthenticated visitors are
// bounced to /login by the middleware protection on the (app) group.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/account", locale });
}
