import type { Database } from '@xolt/shared';

import { supabase } from '@/lib/supabase';

export type DoctorProfileRow = Database['public']['Tables']['doctor_profiles']['Row'];
export type DoctorProfileInput = {
  specialty: string;
  yearsOfExperience: number | null;
  consultationFee: number | null;
  bio: string;
  licenseNumber: string;
  clinicName: string;
  clinicAddress: string;
};

export async function getMyDoctorProfile(): Promise<DoctorProfileRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('doctor_profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Upsert — a doctor's first save creates the row, later saves update it in place. */
export async function saveMyDoctorProfile(input: DoctorProfileInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');

  const { error } = await supabase.from('doctor_profiles').upsert({
    id: userData.user.id,
    specialty: input.specialty || null,
    years_of_experience: input.yearsOfExperience,
    consultation_fee: input.consultationFee,
    bio: input.bio || null,
    license_number: input.licenseNumber || null,
    clinic_name: input.clinicName || null,
    clinic_address: input.clinicAddress || null,
  });
  if (error) throw error;
}

export type DoctorVerificationRow = Database['public']['Tables']['doctor_verifications']['Row'];

/** Most recent verification attempt, if any — null means never submitted. */
export async function getMyLatestVerification(): Promise<DoctorVerificationRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('doctor_verifications')
    .select('*')
    .eq('doctor_id', userData.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Starts a new verification attempt — RLS only allows this while no pending/under_review row exists. */
export async function startVerification(): Promise<DoctorVerificationRow> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('doctor_verifications')
    .insert({ doctor_id: userData.user.id, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type DoctorDocumentType = Database['public']['Tables']['doctor_verification_documents']['Row']['document_type'];

/**
 * Uploads a picked file to the private verification-documents bucket and
 * records it. Path is {doctor_id}/{verification_id}/{filename} — storage
 * RLS checks the leading segment against auth.uid(), see the admin-side
 * migration for the matching policy.
 */
export async function uploadVerificationDocument(
  verificationId: string,
  documentType: DoctorDocumentType,
  file: { uri: string; name: string; mimeType?: string | null },
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const filePath = `${userData.user.id}/${verificationId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('doctor-verification-documents')
    .upload(filePath, blob, { contentType: file.mimeType ?? undefined });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('doctor_verification_documents').insert({
    verification_id: verificationId,
    doctor_id: userData.user.id,
    document_type: documentType,
    file_path: filePath,
    file_name: file.name,
  });
  if (insertError) throw insertError;
}

export type DoctorDocumentRow = Database['public']['Tables']['doctor_verification_documents']['Row'];

export async function getMyVerificationDocuments(verificationId: string): Promise<DoctorDocumentRow[]> {
  const { data, error } = await supabase
    .from('doctor_verification_documents')
    .select('*')
    .eq('verification_id', verificationId)
    .order('uploaded_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
