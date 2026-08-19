// init-payment — patient starts paying the consultation fee for an accepted
// request. Looks up the doctor's fee server-side (never trusts a
// client-supplied amount), creates a Paystack transaction, records a
// 'pending' payments row, returns the checkout URL.
//
// PAYSTACK_SECRET_KEY lives only in this function's environment (Supabase
// Edge Function secrets) — never in apps/patient, apps/doctor, or
// apps/admin. This function keeps the default verify_jwt = true (unlike
// verify-payment): only a signed-in patient may call it.

import { createClient } from "npm:@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  // Identify the caller from their own session — request_id alone isn't
  // enough to know who's paying, and we never trust a client-supplied
  // patient_id.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Not authenticated" }, 401);
  }
  const patientId = userData.user.id;

  let body: { request_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const requestId = body.request_id;
  if (!requestId) {
    return json({ error: "request_id is required" }, 400);
  }

  // Service-role client for the privileged reads/writes below — payments
  // has no client-facing insert policy at all, by design.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: request, error: requestError } = await admin
    .from("consultation_requests")
    .select("id, patient_id, doctor_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request) {
    return json({ error: "Request not found" }, 404);
  }
  if (request.patient_id !== patientId) {
    return json({ error: "This request does not belong to you" }, 403);
  }
  if (request.status !== "accepted") {
    return json({ error: "Request must be accepted before payment" }, 409);
  }

  const { data: existing } = await admin
    .from("payments")
    .select("status")
    .eq("request_id", requestId)
    .in("status", ["pending", "verified"])
    .maybeSingle();

  if (existing?.status === "verified") {
    return json({ error: "This request is already paid for" }, 409);
  }
  if (existing?.status === "pending") {
    return json(
      { error: "A payment is already in progress for this request — finish or wait for it to expire." },
      409,
    );
  }

  const { data: doctorProfile, error: doctorError } = await admin
    .from("doctor_profiles")
    .select("consultation_fee")
    .eq("id", request.doctor_id)
    .maybeSingle();

  if (doctorError || doctorProfile?.consultation_fee == null) {
    return json({ error: "Doctor has no consultation fee set" }, 422);
  }
  const amount = doctorProfile.consultation_fee;

  const { data: patientProfile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", patientId)
    .maybeSingle();

  const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: patientProfile?.email ?? userData.user.email,
      // Paystack amounts are in kobo (smallest currency unit).
      amount: Math.round(Number(amount) * 100),
      metadata: {
        request_id: requestId,
        patient_id: patientId,
        doctor_id: request.doctor_id,
      },
    }),
  });

  const paystackData = await paystackResponse.json();
  if (!paystackResponse.ok || !paystackData.status) {
    return json({ error: "Could not start payment", detail: paystackData }, 502);
  }

  const reference: string = paystackData.data.reference;
  const authorizationUrl: string = paystackData.data.authorization_url;

  const { error: insertError } = await admin.from("payments").insert({
    request_id: requestId,
    patient_id: patientId,
    doctor_id: request.doctor_id,
    amount,
    provider_reference: reference,
    status: "pending",
  });

  if (insertError) {
    return json({ error: "Could not record payment", detail: insertError.message }, 500);
  }

  return json({ authorization_url: authorizationUrl, reference, amount });
});
