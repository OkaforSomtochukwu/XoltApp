import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { XoltSupabaseClient } from "./supabase-client";

export type PaymentStatus = "pending" | "verified" | "failed";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export type InitPaymentResult = {
  authorization_url: string;
  reference: string;
  amount: number;
};

export type VerifyPaymentResult = {
  ok: boolean;
  alreadyVerified?: boolean;
  reason?: string;
};

/**
 * Starts a Paystack checkout for an accepted request's consultation fee.
 * Server-side (init-payment Edge Function) looks up the doctor's fee itself
 * — this never sends an amount from the client. Throws on any failure
 * (including "already paid" / "not accepted yet" — check `error.message`).
 */
export async function initPayment(
  client: XoltSupabaseClient,
  requestId: string,
): Promise<InitPaymentResult> {
  const { data, error } = await client.functions.invoke<InitPaymentResult>("init-payment", {
    body: { request_id: requestId },
  });
  if (error) throw error;
  if (!data) throw new Error("init-payment returned no data.");
  return data;
}

/**
 * Asks verify-payment to re-check a specific reference against Paystack
 * right now — for a fast UI update immediately after checkout closes. The
 * Paystack webhook hitting the same function is the durable path; this call
 * is a courtesy, not the only way verification happens.
 */
export async function verifyPayment(
  client: XoltSupabaseClient,
  supabaseUrl: string,
  supabaseAnonKey: string,
  reference: string,
): Promise<VerifyPaymentResult> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/verify-payment?reference=${encodeURIComponent(reference)}`,
    { method: "GET", headers: { apikey: supabaseAnonKey } },
  );
  return (await response.json()) as VerifyPaymentResult;
}

/** One-off fetch of the active (pending/verified) payment for a request, if any. */
export async function getPaymentForRequest(
  client: XoltSupabaseClient,
  requestId: string,
): Promise<PaymentRow | null> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Realtime subscription for a request's payment row(s) — returns an unsubscribe function. */
export function subscribeToPayments(
  client: XoltSupabaseClient,
  requestId: string,
  onChange: (payload: RealtimePostgresChangesPayload<PaymentRow>) => void,
): () => void {
  // Unique suffix per call — reusing a channel name lets client.channel()
  // hand back an already-subscribed channel, and calling .on() on that
  // throws "cannot add postgres_changes callbacks... after subscribe()".
  // Happens for real under React's mount->cleanup->mount dev-mode
  // double-invoke, not just a theoretical race.
  const channel = client
    .channel(`payments:request_id:${requestId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "payments", filter: `request_id=eq.${requestId}` },
      onChange,
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
