import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { XoltSupabaseClient } from "./supabase-client";

export type AccessGrantStatus = "granted" | "revoked";
export type AccessHistoryEvent = "requested" | "granted" | "revoked" | "viewed";

export type RecordAccessGrantRow = Database["public"]["Tables"]["record_access_grants"]["Row"];
export type AccessHistoryRow = Database["public"]["Tables"]["access_history"]["Row"];

/**
 * Patient generates a one-time code to read out to the doctor. Throws if
 * the request isn't accepted yet or payment isn't verified — both are
 * enforced inside generate_request_otp itself, not just here.
 */
export async function generateRequestOtp(
  client: XoltSupabaseClient,
  requestId: string,
): Promise<string> {
  const { data, error } = await client.rpc("generate_request_otp", { p_request_id: requestId });
  if (error) throw error;
  return data;
}

/** Doctor submits the code the patient read out. true = access granted and the request moved to in_progress. */
export async function verifyRequestOtp(
  client: XoltSupabaseClient,
  requestId: string,
  code: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("verify_request_otp", {
    p_request_id: requestId,
    p_code: code,
  });
  if (error) throw error;
  return data;
}

export type GrantWithDoctor = RecordAccessGrantRow & {
  doctor: { full_name: string } | null;
};

/**
 * All grants (granted + revoked history) for the signed-in patient, newest
 * first, with the doctor's name embedded — the permissions screen. Needs
 * profiles_select_consultation_counterpart RLS or the embed comes back
 * null (every grant originates from a request, so it's always present).
 */
export async function getGrantsForPatient(
  client: XoltSupabaseClient,
  patientId: string,
): Promise<GrantWithDoctor[]> {
  const { data, error } = await client
    .from("record_access_grants")
    .select("*, doctor:profiles!record_access_grants_doctor_id_fkey(full_name)")
    .eq("patient_id", patientId)
    .order("granted_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as GrantWithDoctor[];
}

/** Patient revokes a currently-granted row — RLS only allows this on their own still-granted rows. */
export async function revokeGrant(client: XoltSupabaseClient, grantId: string): Promise<void> {
  const { error } = await client
    .from("record_access_grants")
    .update({ status: "revoked" })
    .eq("id", grantId);
  if (error) throw error;
}

/** Whether the signed-in doctor currently holds an active grant for this patient. */
export async function hasActiveGrant(
  client: XoltSupabaseClient,
  patientId: string,
  doctorId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("record_access_grants")
    .select("id")
    .eq("patient_id", patientId)
    .eq("doctor_id", doctorId)
    .eq("status", "granted")
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/** Full requested/granted/revoked/viewed timeline for one patient — permissions screen. */
export async function getAccessHistory(
  client: XoltSupabaseClient,
  patientId: string,
): Promise<AccessHistoryRow[]> {
  const { data, error } = await client
    .from("access_history")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Doctor logs that they viewed this patient's records. doctor_id is derived
 * from the caller's own session — RLS only allows this while the grant is
 * still active, so there's no point letting a caller claim a different id.
 */
export async function logRecordViewed(
  client: XoltSupabaseClient,
  patientId: string,
): Promise<void> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Not signed in.");

  const { error } = await client
    .from("access_history")
    .insert({ patient_id: patientId, doctor_id: userData.user.id, event: "viewed" });
  if (error) throw error;
}

/** Realtime subscription for a patient's grants — the permissions screen. Returns an unsubscribe function. */
export function subscribeToGrantsForPatient(
  client: XoltSupabaseClient,
  patientId: string,
  onChange: (payload: RealtimePostgresChangesPayload<RecordAccessGrantRow>) => void,
): () => void {
  // Unique suffix per call — see subscribeToConsultationRequests in
  // consultation.ts for why (a channel-name collision throws when .on() is
  // called on an already-subscribed channel).
  const channel = client
    .channel(`record_access_grants:patient_id:${patientId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "record_access_grants", filter: `patient_id=eq.${patientId}` },
      onChange,
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
