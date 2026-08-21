// video-token — mints a short-lived Stream Video user token so a patient or
// doctor can join the call tied to their consultation request.
//
// STREAM_API_SECRET lives only in this function's environment (Supabase
// Edge Function secrets) — never in apps/patient or apps/doctor. Those apps
// only ever see STREAM_API_KEY (public, identifies the Stream app) plus the
// token this function hands back. Keeps the default verify_jwt = true: only
// a signed-in participant may call this.
//
// The call id is just the request id — one call per consultation request,
// no separate calls table needed. Gating is done here (must be a party to
// the request, must be in_progress) rather than via Stream's own call_cids
// token scoping, matching how every other privileged action in this app is
// gated: server-side membership checks, not provider-side trust.

import { createClient } from "npm:@supabase/supabase-js@2";

const STREAM_API_KEY = Deno.env.get("STREAM_API_KEY")!;
const STREAM_API_SECRET = Deno.env.get("STREAM_API_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS — see init-payment's header comment for how this was found (every
// prior test used native fetch or a Node script, neither subject to it).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createStreamUserToken(userId: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    user_id: userId,
    iat: nowSeconds,
    // Stream tokens are per-session, not stored — a fresh call to this
    // function gets a fresh one, so a short lifetime is fine.
    exp: nowSeconds + 60 * 60,
  };

  const encoder = new TextEncoder();
  const headerPart = base64url(encoder.encode(JSON.stringify(header)));
  const payloadPart = base64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(STREAM_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  const signaturePart = base64url(new Uint8Array(signature));

  return `${signingInput}.${signaturePart}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Not authenticated" }, 401);
  }
  const callerId = userData.user.id;

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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: request, error: requestError } = await admin
    .from("consultation_requests")
    .select("id, patient_id, doctor_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request) {
    return json({ error: "Request not found" }, 404);
  }
  if (request.patient_id !== callerId && request.doctor_id !== callerId) {
    return json({ error: "This request does not belong to you" }, 403);
  }
  if (request.status !== "in_progress") {
    return json({ error: "This consultation is not in progress" }, 409);
  }

  const token = await createStreamUserToken(callerId);

  return json({
    token,
    apiKey: STREAM_API_KEY,
    userId: callerId,
    callId: requestId,
  });
});
