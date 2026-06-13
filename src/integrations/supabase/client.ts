import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key — safe to ship in browser code.
const SUPABASE_URL = "https://vtroxkoqedpunsncmdhz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_f9WzPWLTMTBvqde2_q9ELQ_RyhZjdcc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export const STORAGE_BUCKET = "shared-files";