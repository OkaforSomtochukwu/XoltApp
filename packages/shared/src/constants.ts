/** Default "find nearby doctors" search radius, in kilometers.
 * Keep this in sync with the `p_radius_km` default in the
 * `get_available_doctors` SQL function (supabase/migrations) — this is the
 * single source of truth on the app side; pass it explicitly to the RPC
 * call rather than relying on the SQL default. */
export const DEFAULT_SEARCH_RADIUS_KM = 25;

/** How long getCurrentLocation() waits before giving up, in milliseconds. */
export const LOCATION_TIMEOUT_MS = 8000;
