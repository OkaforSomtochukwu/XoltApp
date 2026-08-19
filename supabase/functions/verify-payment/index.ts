// verify-payment — the one place that ever marks a payment 'verified'.
// Called two ways, both handled here:
//   1. GET ?reference=... — the app, right after the patient returns from
//      Paystack checkout (WebBrowser closes).
//   2. POST (Paystack webhook, "charge.success") — the durable path; the
//      app-return call above is just for a fast UI update, this is what
//      actually can't be skipped, since the app-return call may never fire
//      (browser closed early, app backgrounded, network drop).
//
// Trusts neither caller: always re-verifies the reference against
// Paystack's own /transaction/verify endpoint, checking both status AND
// amount before writing anything. The webhook path additionally verifies
// Paystack's HMAC-SHA512 signature — that's the actual security boundary
// for that path, since this function has verify_jwt = false (see
// supabase/config.toml) so it carries no Supabase auth at all. Being
// unauthenticated is fine for the GET path too: it doesn't trust the
// caller's claims either way, it only ever writes what Paystack itself says
// about that specific reference.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPaystackSignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get("x-paystack-signature");
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return toHex(digest) === signature;
}

async function verifyAndRecord(admin: SupabaseClient, reference: string) {
  const { data: payment } = await admin
    .from("payments")
    .select("id, amount, status")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (!payment) {
    return { ok: false, reason: "No matching payment record for this reference" };
  }
  if (payment.status === "verified") {
    return { ok: true, alreadyVerified: true };
  }

  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
  );
  const verifyPayload = await verifyResponse.json();

  const paystackStatus = verifyPayload?.data?.status;
  const paystackAmountKobo = verifyPayload?.data?.amount;
  const expectedAmountKobo = Math.round(Number(payment.amount) * 100);

  const success =
    verifyResponse.ok &&
    verifyPayload?.status === true &&
    paystackStatus === "success" &&
    paystackAmountKobo === expectedAmountKobo;

  const { error } = await admin
    .from("payments")
    .update({
      status: success ? "verified" : "failed",
      verified_at: success ? new Date().toISOString() : null,
    })
    .eq("id", payment.id);

  if (error) {
    return { ok: false, reason: error.message };
  }
  return success
    ? { ok: true }
    : { ok: false, reason: `Paystack status/amount mismatch (status=${paystackStatus})` };
}

Deno.serve(async (req) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === "POST") {
    const rawBody = await req.text();
    if (!(await verifyPaystackSignature(req, rawBody))) {
      return json({ error: "Invalid signature" }, 401);
    }

    let event: { event?: string; data?: { reference?: string } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (event.event !== "charge.success" || !event.data?.reference) {
      // Not an event this function acts on — 200 so Paystack doesn't retry.
      return json({ ignored: true });
    }

    const result = await verifyAndRecord(admin, event.data.reference);
    return json(result, result.ok ? 200 : 422);
  }

  if (req.method === "GET") {
    const reference = new URL(req.url).searchParams.get("reference");
    if (!reference) {
      return json({ error: "reference query param is required" }, 400);
    }
    const result = await verifyAndRecord(admin, reference);
    return json(result, result.ok ? 200 : 422);
  }

  return json({ error: "Method not allowed" }, 405);
});
