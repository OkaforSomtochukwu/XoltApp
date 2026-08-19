import type { Database, Json } from "./database.types";
import type { XoltSupabaseClient } from "./supabase-client";

export type MedicalRecordType =
  | "consultation_note"
  | "diagnosis"
  | "medication"
  | "diagnostic_result";

export type MedicalRecordRow = Database["public"]["Tables"]["medical_records"]["Row"];

export const MEDICAL_RECORD_TYPE_LABELS: Record<MedicalRecordType, string> = {
  consultation_note: "Consultation note",
  diagnosis: "Diagnosis",
  medication: "Medication",
  diagnostic_result: "Diagnostic result",
};

/** The signed-in patient's own records — always visible to them regardless of any grant. */
export async function getMyMedicalRecords(client: XoltSupabaseClient): Promise<MedicalRecordRow[]> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Not signed in.");

  const { data, error } = await client
    .from("medical_records")
    .select("*")
    .eq("patient_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** A specific patient's records, as a doctor — RLS only returns rows while the doctor holds an active grant for that patient. */
export async function getPatientMedicalRecords(
  client: XoltSupabaseClient,
  patientId: string,
): Promise<MedicalRecordRow[]> {
  const { data, error } = await client
    .from("medical_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Doctor adds a new record. doctor_id is derived from the caller's own
 * session, never passed in — RLS requires an active grant for this patient
 * regardless, but this keeps the caller from even trying to claim a
 * different doctor_id.
 */
export async function addMedicalRecord(
  client: XoltSupabaseClient,
  params: {
    patientId: string;
    requestId: string;
    recordType: MedicalRecordType;
    title?: string;
    content: Record<string, Json>;
  },
): Promise<MedicalRecordRow> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Not signed in.");

  const { data, error } = await client
    .from("medical_records")
    .insert({
      patient_id: params.patientId,
      doctor_id: userData.user.id,
      request_id: params.requestId,
      record_type: params.recordType,
      title: params.title,
      content: params.content,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
