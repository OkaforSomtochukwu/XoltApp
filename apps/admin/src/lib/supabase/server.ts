import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@xolt/shared";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server Component / Server Action / Route Handler client — reads the
 * signed-in admin's session from cookies, so every query goes through RLS
 * as that admin. There is no service-role client anywhere in this app:
 * admin access is real is_admin() RLS, not a client-side role check with a
 * privileged backend behind it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component that can't set cookies — the
          // middleware below refreshes the session on every request, so
          // this is safe to ignore.
        }
      },
    },
  });
}
