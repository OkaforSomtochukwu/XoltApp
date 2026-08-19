import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { XoltSupabaseClient } from "./supabase-client";

export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

/** Chat history for a request — RLS scopes this to participants on an in_progress/completed request. */
export async function getMessages(
  client: XoltSupabaseClient,
  requestId: string,
): Promise<MessageRow[]> {
  const { data, error } = await client
    .from("messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Sends a chat message. sender_id is derived from the caller's own session — RLS only allows this while the request is in_progress. */
export async function sendMessage(
  client: XoltSupabaseClient,
  requestId: string,
  body: string,
): Promise<MessageRow> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Not signed in.");

  const { data, error } = await client
    .from("messages")
    .insert({ request_id: requestId, sender_id: userData.user.id, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Realtime subscription for a request's chat — returns an unsubscribe function. */
export function subscribeToMessages(
  client: XoltSupabaseClient,
  requestId: string,
  onChange: (payload: RealtimePostgresChangesPayload<MessageRow>) => void,
): () => void {
  // Unique suffix per call — see subscribeToConsultationRequest in
  // consultation.ts for why (a channel-name collision throws when .on() is
  // called on an already-subscribed channel).
  const channel = client
    .channel(`messages:request_id:${requestId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `request_id=eq.${requestId}` },
      onChange,
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
