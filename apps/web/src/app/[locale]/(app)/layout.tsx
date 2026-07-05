import { AppShell } from "@/shared/presentation/AppShell";
import { Providers } from "@/shared/presentation/Providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
