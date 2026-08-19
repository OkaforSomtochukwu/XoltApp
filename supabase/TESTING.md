# Testing the profiles/doctor-verification schema end-to-end

Backend: the `xolt-app` Supabase project (ref `axjluxmdikthmmpwylsp`), created
fresh for this. Email confirmation is disabled on it (`enable_confirmations =
false`, pushed via `supabase config push`) so `signUp` returns a usable
session immediately — don't assume that's on for a production project.

```
SUPABASE_URL=https://axjluxmdikthmmpwylsp.supabase.co
ANON_KEY=<apps/patient/.env or apps/doctor/.env — EXPO_PUBLIC_SUPABASE_ANON_KEY>
```

## 1. Sign up from the real apps

```bash
pnpm --filter patient start --web   # opens the patient app
pnpm --filter doctor start --web    # opens the doctor app, different port
```

Each app's home screen now has a signup card (full name / email / password).
Sign up **two patients** (Patient A, Patient B — you'll need both for the
cross-read test below) from the patient app, and **one doctor** from the
doctor app. On success the card shows "Signed up — session active for
<email>."

## 2. Confirm the `profiles` row was created correctly

`profiles` is auto-populated by a `security definer` trigger on
`auth.users` insert — there's nothing else to do for this table. Confirm it
with each user's own access token (grab it from the browser's
`localStorage`/AsyncStorage session under the `sb-...-auth-token` key, or
just re-sign-in via curl per step 3 to get a fresh one):

```bash
curl "$SUPABASE_URL/rest/v1/profiles?select=*" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer <their access_token>"
```

Expect exactly one row back: their own `id`, the `role` you signed up with
(`patient` or `doctor`), `full_name`, `email`. RLS scopes this to their own
row regardless of the query — there's no `id=eq....` filter needed or even
possible to bypass here.

Note: `patient_profiles`, `patient_medical_info`, and `doctor_profiles` are
**not** auto-created — only `profiles` is. Inserting those is a future
feature (this migration's scope was identity/verification only). Step 4
below creates a `patient_medical_info` row manually via curl so there's
something real to test the cross-read block against.

## 3. Get a fresh JWT for any user via curl (Auth API)

Useful if you didn't capture the token from the app, or want a clean
Postman-able flow:

```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "patient-a@example.com", "password": "..."}'
```

The response's `.access_token` is the JWT to use as `Authorization: Bearer
...` below; `.user.id` is that user's `profiles.id`.

## 4. The actual RLS test — patient A reading patient B's medical info

Set these from step 1/3:

```bash
A_TOKEN=<patient A's access_token>
B_TOKEN=<patient B's access_token>
B_ID=<patient B's user id>
SERVICE_ROLE_KEY=<never ships in an app — from `supabase projects api-keys`, for this verification step only>
```

**a. Patient B creates their own medical info row** (self-insert is allowed):

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/patient_medical_info" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $B_TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"id\": \"$B_ID\", \"blood_group\": \"O+\", \"allergies\": [\"penicillin\"]}"
```

Expect the inserted row back (HTTP 201).

**b. Confirm the row genuinely exists**, using the service_role key (which
bypasses RLS entirely — this is the control, proving step (c) below is a
real RLS block and not just "no row exists"):

```bash
curl -s "$SUPABASE_URL/rest/v1/patient_medical_info?id=eq.$B_ID" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Expect one row.

**c. The real test** — Patient A tries to read Patient B's row with
Patient A's own JWT:

```bash
curl -s -i "$SUPABASE_URL/rest/v1/patient_medical_info?id=eq.$B_ID" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $A_TOKEN"
```

Expect **HTTP 200 with an empty array `[]`**, not a 403/permission error —
that's the correct RLS behavior: the row is filtered out of the result set
entirely rather than surfaced as an access-denied error, so Patient A can't
even tell whether the row exists. Combined with (b), that confirms it's a
real block, not an absent row.

**d. Sanity check the positive case** — Patient A reading their *own* row
(insert one first, same as step (a) with `A_TOKEN`/`A_ID`) should return that
one row. If (c) is empty but (d) also comes back empty, something is
mis-scoped (e.g. RLS blocking everyone, or the row wasn't actually created) —
don't read (c) as a pass on its own without (b) and (d) both checking out.

## Cleanup

This is a disposable test project — when you're done, either leave it (free
tier, no cost) or delete the two test patients / one test doctor via
Authentication → Users in the dashboard so they don't linger.
