import type { Database } from "@xolt/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminSupabaseClient = SupabaseClient<Database>;

// The generated Row type widens the check-constrained `status` column to
// `string`, not a literal union — Extract<string, "x"> is `never`, so this
// is spelled out by hand instead of derived from the DB type.
export type VerificationStatus = "pending" | "under_review" | "verified" | "rejected";

export type VerificationQueueRow = Database["public"]["Tables"]["doctor_verifications"]["Row"] & {
  doctor: { full_name: string; email: string } | null;
};

/** Pending + under-review verifications, oldest first — a queue, not a feed. */
export async function getVerificationQueue(client: AdminSupabaseClient): Promise<VerificationQueueRow[]> {
  const { data, error } = await client
    .from("doctor_verifications")
    .select("*, doctor:profiles!doctor_verifications_doctor_id_fkey(full_name, email)")
    .in("status", ["pending", "under_review"])
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as VerificationQueueRow[];
}

export type VerificationDetail = Database["public"]["Tables"]["doctor_verifications"]["Row"] & {
  doctor: { full_name: string; email: string; phone: string | null } | null;
};

export async function getVerificationDetail(
  client: AdminSupabaseClient,
  id: string,
): Promise<VerificationDetail | null> {
  const { data, error } = await client
    .from("doctor_verifications")
    .select("*, doctor:profiles!doctor_verifications_doctor_id_fkey(full_name, email, phone)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as VerificationDetail | null;
}

export type VerificationDocument = Database["public"]["Tables"]["doctor_verification_documents"]["Row"] & {
  signedUrl: string | null;
};

/** Documents for one verification, each with a short-lived signed URL for viewing. */
export async function getVerificationDocuments(
  client: AdminSupabaseClient,
  verificationId: string,
): Promise<VerificationDocument[]> {
  const { data, error } = await client
    .from("doctor_verification_documents")
    .select("*")
    .eq("verification_id", verificationId)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await client.storage
        .from("doctor-verification-documents")
        .createSignedUrl(row.file_path, 60 * 10);
      return { ...row, signedUrl: signed?.signedUrl ?? null };
    }),
  );
  return withUrls;
}

/** Approve/reject/move-to-review — reviewed_at/reviewed_by are set by trigger, never passed in. */
export async function setVerificationStatus(
  client: AdminSupabaseClient,
  id: string,
  status: Extract<VerificationStatus, "under_review" | "verified" | "rejected">,
  rejectionReason?: string,
): Promise<void> {
  const { error } = await client
    .from("doctor_verifications")
    .update({ status, rejection_reason: rejectionReason ?? null })
    .eq("id", id);
  if (error) throw error;
}

export type UserSearchRow = Database["public"]["Tables"]["profiles"]["Row"] & {
  doctor_profile: { specialty: string | null; consultation_fee: number | null } | null;
};

/** Searchable patient + doctor directory, basic info only — name/email/role/phone from profiles. */
export async function searchUsers(client: AdminSupabaseClient, query: string): Promise<UserSearchRow[]> {
  let builder = client
    .from("profiles")
    .select("*, doctor_profile:doctor_profiles(specialty, consultation_fee)")
    .neq("role", "admin")
    .order("created_at", { ascending: false })
    .limit(50);

  if (query.trim()) {
    builder = builder.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  }

  const { data, error } = await builder;
  if (error) throw error;
  return (data ?? []) as unknown as UserSearchRow[];
}

export type RecentRequestRow = Database["public"]["Tables"]["consultation_requests"]["Row"] & {
  patient: { full_name: string } | null;
  doctor: { full_name: string } | null;
};

export async function getRecentRequests(client: AdminSupabaseClient, limit = 20): Promise<RecentRequestRow[]> {
  const { data, error } = await client
    .from("consultation_requests")
    .select(
      "*, patient:profiles!consultation_requests_patient_id_fkey(full_name), doctor:profiles!consultation_requests_doctor_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as RecentRequestRow[];
}

export type RecentPaymentRow = Database["public"]["Tables"]["payments"]["Row"] & {
  patient: { full_name: string } | null;
  doctor: { full_name: string } | null;
};

export async function getRecentPayments(client: AdminSupabaseClient, limit = 20): Promise<RecentPaymentRow[]> {
  const { data, error } = await client
    .from("payments")
    .select(
      "*, patient:profiles!payments_patient_id_fkey(full_name), doctor:profiles!payments_doctor_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as RecentPaymentRow[];
}

// Thresholds are deliberately conservative for a young product with low
// volume — tune once there's real traffic to calibrate against.
const STUCK_PENDING_MINUTES = 30;
const STUCK_ACCEPTED_MINUTES = 60;

export type HealthCheck = {
  stuckPending: RecentRequestRow[];
  stuckAccepted: RecentRequestRow[];
  failedPayments: RecentPaymentRow[];
};

/** Operational view: requests sitting too long unactioned, and payments that failed outright. */
export async function getHealthCheck(client: AdminSupabaseClient): Promise<HealthCheck> {
  const pendingCutoff = new Date(Date.now() - STUCK_PENDING_MINUTES * 60 * 1000).toISOString();
  const acceptedCutoff = new Date(Date.now() - STUCK_ACCEPTED_MINUTES * 60 * 1000).toISOString();

  const [{ data: stuckPending, error: pendingError }, { data: stuckAccepted, error: acceptedError }, { data: failedPayments, error: failedError }] =
    await Promise.all([
      client
        .from("consultation_requests")
        .select(
          "*, patient:profiles!consultation_requests_patient_id_fkey(full_name), doctor:profiles!consultation_requests_doctor_id_fkey(full_name)",
        )
        .eq("status", "pending")
        .lt("created_at", pendingCutoff)
        .order("created_at", { ascending: true }),
      client
        .from("consultation_requests")
        .select(
          "*, patient:profiles!consultation_requests_patient_id_fkey(full_name), doctor:profiles!consultation_requests_doctor_id_fkey(full_name)",
        )
        .eq("status", "accepted")
        .lt("accepted_at", acceptedCutoff)
        .order("accepted_at", { ascending: true }),
      client
        .from("payments")
        .select(
          "*, patient:profiles!payments_patient_id_fkey(full_name), doctor:profiles!payments_doctor_id_fkey(full_name)",
        )
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (pendingError) throw pendingError;
  if (acceptedError) throw acceptedError;
  if (failedError) throw failedError;

  return {
    stuckPending: (stuckPending ?? []) as unknown as RecentRequestRow[],
    stuckAccepted: (stuckAccepted ?? []) as unknown as RecentRequestRow[],
    failedPayments: (failedPayments ?? []) as unknown as RecentPaymentRow[],
  };
}
