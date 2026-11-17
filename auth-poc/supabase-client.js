
import { createClient } from "@supabase/supabase-js";
import { chromeStorage } from "./chrome-storage.js";

const SUPABASE_URL = "https://xktyfeqvvvmuiutusojo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1h2Nhn_P0Ob9EsYCEPIvHA_SH5f0bZH";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: chromeStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);
