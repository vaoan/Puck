import type { ReactNode } from "react";

import { Nav } from "./Nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Nav />
      <main className="mx-auto max-w-3xl p-4 md:p-6">{children}</main>
    </div>
  );
}
