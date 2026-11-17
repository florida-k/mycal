import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

const { data, error } = await supabase.auth.signInAnonymously();

if (error) {
  console.error("Anonymous sign-in failed:", error.message);
  process.exit(1);
}

console.log("Anonymous sign-in successful!");
console.log("User ID:", data.user.id);
console.log("Anonymous:", data.user.is_anonymous);
console.log("Session created:", Boolean(data.session));