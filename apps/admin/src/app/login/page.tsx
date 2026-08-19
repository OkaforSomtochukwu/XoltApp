import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="stack" style={{ maxWidth: 420, margin: "var(--space-8) auto", padding: "0 var(--space-4)" }}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
