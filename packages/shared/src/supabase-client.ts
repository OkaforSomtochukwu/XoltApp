import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/** The shape every app's own `src/lib/supabase.ts` client should satisfy. */
export type XoltSupabaseClient = SupabaseClient<Database>;
