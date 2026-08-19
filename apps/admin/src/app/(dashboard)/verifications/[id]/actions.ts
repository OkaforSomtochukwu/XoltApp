"use server";

import { createClient } from "@/lib/supabase/server";
import { setVerificationStatus } from "@/lib/admin-queries";
import { revalidatePath } from "next/cache";

export async function approveVerificationAction(id: string) {
  const supabase = await createClient();
  await setVerificationStatus(supabase, id, "verified");
  revalidatePath("/verifications");
  revalidatePath(`/verifications/${id}`);
}

export async function rejectVerificationAction(id: string, reason: string) {
  const supabase = await createClient();
  await setVerificationStatus(supabase, id, "rejected", reason);
  revalidatePath("/verifications");
  revalidatePath(`/verifications/${id}`);
}

export async function moveToReviewAction(id: string) {
  const supabase = await createClient();
  await setVerificationStatus(supabase, id, "under_review");
  revalidatePath("/verifications");
  revalidatePath(`/verifications/${id}`);
}
