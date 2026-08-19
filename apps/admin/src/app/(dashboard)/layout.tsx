import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "./sign-out-action";

// Middleware already guarantees an admin session reaches this layout — no
// role check here, this is just the shell (nav + sign-out).
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="stack" style={{ minHeight: "100%" }}>
      <header
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-3) var(--space-4)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <nav className="row" style={{ gap: "var(--space-4)", alignItems: "center" }}>
          <strong>Xolt Admin</strong>
          <Link href="/">Activity</Link>
          <Link href="/verifications">Verification queue</Link>
          <Link href="/users">Users</Link>
        </nav>
        <div className="row" style={{ gap: "var(--space-3)", alignItems: "center" }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>{user?.email}</span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main style={{ flex: 1, padding: "var(--space-4)" }}>{children}</main>
    </div>
  );
}
