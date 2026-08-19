import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { DEFAULT_SEARCH_RADIUS_KM } from "./constants";
import type { CurrentLocation } from "./location";
import type { XoltSupabaseClient } from "./supabase-client";
import type { Database } from "./database.types";

export type ConsultationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "in_progress"
  | "completed"
  | "cancelled";

/** Human-readable label per status, for both apps' status screens. */
export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  pending: "Waiting for doctor",
  accepted: "Accepted",
  declined: "Declined",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type ConsultationRequestRow =
  Database["public"]["Tables"]["consultation_requests"]["Row"];

export type AvailableDoctor =
  Database["public"]["Functions"]["get_available_doctors"]["Returns"][number];

export type DoctorProfileDetail =
  Database["public"]["Functions"]["get_doctor_profile"]["Returns"][number];

/** Nearest verified + online doctors within radiusKm, sorted nearest first. */
export async function getAvailableDoctors(
  client: XoltSupabaseClient,
  lat: number,
  lng: number,
  radiusKm: number = DEFAULT_SEARCH_RADIUS_KM,
): Promise<AvailableDoctor[]> {
  const { data, error } = await client.rpc("get_available_doctors", {
    p_patient_lat: lat,
    p_patient_lng: lng,
    p_radius_km: radiusKm,
  });
  if (error) throw error;
  return data ?? [];
}

/** Public-safe detail for one doctor (bio/clinic info beyond the list row) — null if not found/not verified. */
export async function getDoctorProfile(
  client: XoltSupabaseClient,
  doctorId: string,
): Promise<DoctorProfileDetail | null> {
  const { data, error } = await client.rpc("get_doctor_profile", { p_doctor_id: doctorId });
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Patient requests a specific doctor. patient_id is derived from the caller's own session, never passed in. */
export async function createConsultationRequest(
  client: XoltSupabaseClient,
  params: { doctorId: string; location: CurrentLocation },
): Promise<ConsultationRequestRow> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Not signed in.");
  }

  const { data, error } = await client
    .from("consultation_requests")
    .insert({
      patient_id: userData.user.id,
      doctor_id: params.doctorId,
      patient_location: params.location,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Doctor accepts or declines a request they've been assigned — RLS only allows this from 'pending'. */
export async function respondToConsultationRequest(
  client: XoltSupabaseClient,
  requestId: string,
  decision: Extract<ConsultationStatus, "accepted" | "declined">,
): Promise<ConsultationRequestRow> {
  const { data, error } = await client
    .from("consultation_requests")
    .update({ status: decision })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Either party ends an in_progress consultation — RLS only allows this transition, the trigger rejects any other. */
export async function completeConsultationRequest(
  client: XoltSupabaseClient,
  requestId: string,
): Promise<ConsultationRequestRow> {
  const { data, error } = await client
    .from("consultation_requests")
    .update({ status: "completed" })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export type ConsultationRequestsFilter = { patientId: string } | { doctorId: string };

/**
 * Realtime subscription for a patient's or doctor's own consultation_requests
 * rows — Realtime enforces RLS using the connecting session, so the filter
 * here is a query-efficiency narrowing, not the actual access control.
 * Returns an unsubscribe function (call from a useEffect cleanup).
 */
export function subscribeToConsultationRequests(
  client: XoltSupabaseClient,
  filter: ConsultationRequestsFilter,
  onChange: (payload: RealtimePostgresChangesPayload<ConsultationRequestRow>) => void,
): () => void {
  const [column, value] =
    "patientId" in filter ? (["patient_id", filter.patientId] as const) : (["doctor_id", filter.doctorId] as const);

  // A unique suffix per call, not just per requestId/column/value — reusing
  // a channel name lets client.channel() hand back an already-subscribed
  // channel, and calling .on() on that throws "cannot add postgres_changes
  // callbacks... after subscribe()". Happens for real under React's
  // mount->cleanup->mount dev-mode double-invoke, not just a theoretical race.
  const channel = client
    .channel(`consultation_requests:${column}:${value}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "consultation_requests", filter: `${column}=eq.${value}` },
      onChange,
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Realtime subscription for one specific request by id — used by the
 * patient's request-status screen and the doctor's mirrored active-request
 * screen, both of which watch a single row rather than a whole list.
 * Returns an unsubscribe function (call from a useEffect cleanup).
 */
export function subscribeToConsultationRequest(
  client: XoltSupabaseClient,
  requestId: string,
  onChange: (payload: RealtimePostgresChangesPayload<ConsultationRequestRow>) => void,
): () => void {
  // Unique suffix per call — see subscribeToConsultationRequests for why.
  const channel = client
    .channel(`consultation_requests:id:${requestId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "consultation_requests", filter: `id=eq.${requestId}` },
      onChange,
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/** One-off fetch of a single request by id (RLS scopes it to a participant). */
export async function getConsultationRequest(
  client: XoltSupabaseClient,
  requestId: string,
): Promise<ConsultationRequestRow | null> {
  const { data, error } = await client
    .from("consultation_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type IncomingConsultationRequest = ConsultationRequestRow & {
  patient: { full_name: string; phone: string | null } | null;
};

/**
 * Doctor's incoming (still-pending) requests, newest first, with the
 * requesting patient's name embedded — needs
 * profiles_select_consultation_counterpart RLS (20260818060000) or the
 * embed silently comes back null.
 */
export async function getIncomingConsultationRequests(
  client: XoltSupabaseClient,
  doctorId: string,
): Promise<IncomingConsultationRequest[]> {
  const { data, error } = await client
    .from("consultation_requests")
    .select("*, patient:profiles!consultation_requests_patient_id_fkey(full_name, phone)")
    .eq("doctor_id", doctorId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IncomingConsultationRequest[];
}
