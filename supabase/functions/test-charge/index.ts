// TEMPORARY verification-only function. Drives a real Paystack test-mode
// charge server-side so the secret key never leaves this environment. Not
// part of the app — delete after use.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const body = await req.json();
  const action = body.action as "charge" | "submit_pin" | "submit_otp";

  let paystackPath = "";
  let paystackBody: Record<string, unknown> = {};

  if (action === "charge") {
    const reference = `TESTCHG-${Date.now()}`;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: request, error: reqErr } = await admin
      .from("consultation_requests")
      .select("id, patient_id, doctor_id, status")
      .eq("id", body.request_id)
      .single();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "request not found" }), { status: 404 });
    }
    if (request.patient_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "not your request" }), { status: 403 });
    }

    await admin
      .from("payments")
      .update({ status: "failed" })
      .eq("request_id", request.id)
      .eq("status", "pending");

    const { error: insertErr } = await admin.from("payments").insert({
      request_id: request.id,
      patient_id: request.patient_id,
      doctor_id: request.doctor_id,
      amount: body.amount,
      provider_reference: reference,
      status: "pending",
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
    }

    paystackPath = "/charge";
    paystackBody = {
      email: body.email,
      amount: Math.round(Number(body.amount) * 100),
      reference,
      card: {
        number: "4084084084084081",
        cvv: "408",
        expiry_month: "12",
        expiry_year: "30",
      },
    };
    const res = await fetch(`https://api.paystack.co${paystackPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackBody),
    });
    const json = await res.json();
    return new Response(JSON.stringify({ ...json, __reference: reference }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } else if (action === "submit_pin") {
    paystackPath = "/charge/submit_pin";
    paystackBody = { pin: "0000", reference: body.reference };
  } else if (action === "submit_otp") {
    paystackPath = "/charge/submit_otp";
    paystackBody = { otp: "123456", reference: body.reference };
  } else {
    return new Response(JSON.stringify({ error: "bad action" }), { status: 400 });
  }

  const res = await fetch(`https://api.paystack.co${paystackPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paystackBody),
  });
  const json = await res.json();
  return new Response(JSON.stringify(json), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
