import type { XoltSupabaseClient } from "./supabase-client";

export type VideoTokenResult = {
  token: string;
  apiKey: string;
  userId: string;
  callId: string;
};

/**
 * Mints a short-lived Stream Video token for the calling party — the
 * Edge Function verifies they're actually a participant on an in_progress
 * request before handing one out.
 */
export async function getVideoToken(
  client: XoltSupabaseClient,
  requestId: string,
): Promise<VideoTokenResult> {
  const { data, error } = await client.functions.invoke<VideoTokenResult>("video-token", {
    body: { request_id: requestId },
  });
  if (error) throw error;
  if (!data) throw new Error("video-token returned no data.");
  return data;
}
