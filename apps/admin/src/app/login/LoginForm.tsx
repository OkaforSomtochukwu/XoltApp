"use client";

import { Button, Card, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const notAuthorized = searchParams.get("error") === "not_authorized";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    // A hard navigation, not router.push — this has to be a real request so
    // the proxy (middleware) actually runs and can redirect straight back
    // here with ?error=not_authorized if the account isn't an admin. A
    // client-side push previously left this component's `submitting` state
    // stuck true across that redirect, permanently disabling the button.
    window.location.href = "/";
  }

  return (
    <Card>
      <Card.Kicker>Xolt Admin</Card.Kicker>
      <Card.Title>Sign in</Card.Title>
      <Card.Body>
        Admin accounts aren&apos;t self-serve — if you don&apos;t have one, ask someone who already does
        to create it in the Supabase dashboard.
      </Card.Body>

      {notAuthorized && <Card.Body>This account doesn&apos;t have admin access.</Card.Body>}

      <form onSubmit={handleSubmit} className="stack">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        {error && <Card.Body>{error}</Card.Body>}
      </form>
    </Card>
  );
}
